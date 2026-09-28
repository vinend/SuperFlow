import json

import pytest
from sqlalchemy import func, select

from superflow import finance_calc as calc
from superflow.investment_extraction import DeterministicExtractor, SourceChunk, resolve
from superflow.models import Case, DocumentChunk, InvestmentAnalysis


def headers(role):
    return {"X-User-Id": role}


def call(client, path, value=None, role="finance", code=200):
    response = client.post("/api/" + path, json=value or {}, headers=headers(role))
    assert response.status_code == code, response.text
    return response.json()


def start(client, proposal="proposal-a", role="finance", code=201, **extra):
    value = {"proposal_document_id": proposal, **extra}
    return call(client, "investment-analyses", value, role, code)


def act(client, analysis, action, role="finance", code=200, **extra):
    value = {"expected_revision": analysis["revision"], **extra}
    return call(client, f"investment-analyses/{analysis['id']}/{action}", value, role, code)


def entry(analysis, key):
    return next(item for item in analysis["inputs"] if item["key"] == key)


def assumption(analysis, key, label):
    return next(a for a in entry(analysis, key)["assumptions"] if a["label"] == label)


def metric(analysis, key):
    return next(m for m in analysis["calculation"]["metrics"] if m["key"] == key)


def resolve_quote(client, analysis, reason="Vendor quotation is the committed price."):
    chosen = assumption(analysis, "initial_investment", "Quoted implementation cost")
    return act(client, analysis, "select", assumption_id=chosen["id"], reason=reason)


# Deterministic formulas: values reproducible by hand for the seeded Proposal A.
def test_formulas_match_hand_calculation():
    flows = calc.cash_flows(180_000_000, 65_000_000, 4)
    assert flows == [-180_000_000, 65_000_000, 65_000_000, 65_000_000, 65_000_000]
    factor = (1 - 1.1**-4) / 0.1
    assert calc.npv(0.10, flows) == pytest.approx(65_000_000 * factor - 180_000_000)
    assert calc.npv(calc.irr(flows), flows) == pytest.approx(0, abs=1)
    assert calc.roi(flows) == pytest.approx(80 / 180)
    assert calc.payback(flows) == pytest.approx(180 / 65)
    assert calc.break_even_inflow(180_000_000, 0.10, 4) == pytest.approx(180_000_000 / factor)
    assert calc.irr([-100, -10, -5]) is None
    assert calc.payback([-100, 10, 10]) is None
    assert calc.annuity_factor(0, 4) == 4


def test_sensitivity_moves_one_input_at_a_time():
    base = calc.Inputs(180_000_000, 65_000_000, 4, 0.10)
    rows = {row["variable"]: row["npv"] for row in calc.sensitivity(base)}
    center = round(calc.npv(0.10, base.flows))
    assert all(values[2] == center for values in rows.values())
    assert rows["investment"][0] > center > rows["investment"][-1]
    assert rows["annual_inflow"][0] < center < rows["annual_inflow"][-1]
    assert rows["rate"][0] > center > rows["rate"][-1]


def test_extractor_reads_proposal_quotation_projection_and_policy():
    extractor = DeterministicExtractor()
    proposal = extractor.extract(
        SourceChunk(
            "p",
            "Proposal X estimates an initial investment of IDR 100,000,000 and annual net "
            "cash inflows of IDR 30,000,000 for five years. The discount rate is 8 percent.",
        )
    )
    assert {(e.key, e.value) for e in proposal} == {
        ("initial_investment", 100_000_000),
        ("annual_inflow", 30_000_000),
        ("periods", 5),
        ("discount_rate", 8),
    }
    projection = extractor.extract(SourceChunk("c", "Year 0: -90,000,000. Year 1: 30,000,000."))
    assert [(e.key, e.value) for e in projection] == [
        ("initial_investment", 90_000_000),
        ("annual_inflow", 30_000_000),
        ("periods", 1),
    ]
    inputs = {i["key"]: i for i in resolve([e.as_dict() for e in proposal + projection], {})}
    assert inputs["initial_investment"]["status"] == "conflict"
    assert inputs["approval_threshold"]["status"] == "missing"


def test_sources_list_current_proposals_for_finance_only(client):
    response = client.get("/api/investment-analyses/sources", headers=headers("finance"))
    assert response.status_code == 200
    sources = {item["document_id"]: item for item in response.json()}
    assert set(sources) == {"proposal-a", "proposal-b"}
    assert {r["document_id"] for r in sources["proposal-a"]["related"]} == {
        "quote-a",
        "cashflows",
        "approval-policy",
    }
    for role in ["employee", "manager", "compliance", "governance", "sme"]:
        assert client.get("/api/investment-analyses/sources", headers=headers(role)).status_code
        assert start(client, role=role, code=403)["detail"].startswith("Investment Analysis")
    start(client, "quote-a", code=422)


def test_analysis_surfaces_conflict_and_blocks_calculation_until_selected(client, db):
    analysis = start(client)
    assert analysis["phase"] == "CONFLICTS" and analysis["conflict_count"] == 1
    initial = entry(analysis, "initial_investment")
    assert initial["status"] == "conflict" and initial["value"] is None
    assert sorted(a["value"] for a in initial["assumptions"]) == [
        180_000_000,
        180_000_000,
        195_000_000,
    ]
    for item in initial["assumptions"]:
        chunk = db.get(DocumentChunk, item["source"]["chunk_id"])
        assert chunk.text == item["source"]["excerpt"] and item["quote"] in chunk.text
    assert entry(analysis, "annual_inflow")["status"] == "consistent"
    assert entry(analysis, "discount_rate")["value"] == 10
    assert analysis["calculation"] is None and analysis["npv"] is None
    assert "submit" not in analysis["allowed_actions"]
    assert set(analysis["allowed_actions"]) == {"select", "edit_memo"}
    guard = analysis["reliability"]
    assert guard["status"] == "REVIEW_REQUIRED"
    assert guard["checks"]["calculation_validity"] == {
        "passed": False,
        "applicable": True,
        "details": "Calculation waits for missing or conflicting inputs.",
    }
    conflict = next(e for e in guard["evidence"] if e["key"] == "calculation:initial_investment")
    assert conflict["status"] == "conflicting" and len(conflict["source_refs"]) == 3
    assert "unresolved conflict" in analysis["memo"]


def test_selection_requires_reason_and_unlocks_deterministic_results(client):
    analysis = start(client)
    chosen = assumption(analysis, "initial_investment", "Quoted implementation cost")
    act(client, analysis, "select", code=422, assumption_id=chosen["id"], reason=" ")
    agreed = entry(analysis, "annual_inflow")["assumptions"][0]
    act(client, analysis, "select", code=422, assumption_id=agreed["id"], reason="No conflict.")
    analysis = resolve_quote(client, analysis)
    initial = entry(analysis, "initial_investment")
    assert initial["status"] == "resolved" and initial["value"] == 195_000_000
    assert initial["selection"]["selected_by"] == "finance"
    expected = calc.metrics(calc.Inputs(195_000_000, 65_000_000, 4, 0.10))
    assert metric(analysis, "npv")["value"] == expected["npv"] == analysis["npv"]
    assert metric(analysis, "irr")["value"] == round(expected["irr"] * 100, 2)
    assert metric(analysis, "payback_years")["value"] == 3.0
    assert metric(analysis, "break_even_inflow")["unit"] == "IDR per year"
    assert all(m["formula"] and m["period"] for m in analysis["calculation"]["metrics"])
    assert analysis["calculation"]["steps"] == [-20.0, -10.0, 0.0, 10.0, 20.0]
    assert analysis["phase"] == "READY_TO_SUBMIT"
    assert analysis["reliability"]["checks"]["calculation_validity"]["passed"] is True
    route = analysis["approval_route"]
    assert route["route"] == "manager" and route["threshold"] == 250_000_000
    assert route["source"]["document_id"] == "approval-policy"
    assert "submit" in analysis["allowed_actions"]
    assert "Vendor quotation is the committed price." in analysis["memo"]
    events = [e["event_type"] for e in analysis["activity"]]
    assert events.index("assumption_selected") < len(events) - 1  # Guard re-checks after.
    assert events[-1] == "guard_evaluated"


def test_consistent_proposal_is_ready_and_reuses_open_analysis(client, db):
    analysis = start(client, "proposal-b")
    assert analysis["phase"] == "READY_TO_SUBMIT" and analysis["conflict_count"] == 0
    assert analysis["npv"] == calc.metrics(calc.Inputs(240e6, 80e6, 4, 0.12))["npv"]
    assert "select" not in analysis["allowed_actions"]
    again = start(client, "proposal-b", code=200)
    assert again["id"] == analysis["id"]
    assert db.scalar(select(func.count()).select_from(Case)) == 1
    assert client.get("/api/ask", headers=headers("finance")).json() == []


def test_missing_approval_authority_blocks_submission(client):
    analysis = start(client, "proposal-b", supporting_document_ids=["quote-b"])
    assert analysis["phase"] == "MISSING_INFORMATION"
    assert entry(analysis, "approval_threshold")["status"] == "missing"
    assert analysis["reliability"]["status"] == "BLOCKED"
    assert analysis["approval_route"] is None
    act(client, analysis, "submit", code=409)


def test_restricted_supporting_sources_are_never_used_or_leaked(client, admin):
    metadata = {
        "title": "Confidential Vendor C Quotation",
        "domain": "Finance",
        "owner_id": "governance",
        "authority_level": 2,
        "access_roles": ["governance"],
        "related_document_ids": [],
    }
    response = client.post(
        "/api/documents",
        headers=admin,
        data={"metadata": json.dumps(metadata), "version": "1.0", "effective_date": "2026-01-01"},
        files={"file": ("vendor-c.md", b"## Quotation\nVendor C quotes IDR 99,000,000.")},
    )
    restricted = response.json()["id"]
    proposal = client.get("/api/documents/proposal-b", headers=admin).json()
    update = {key: proposal[key] for key in ["title", "domain", "owner_id", "authority_level"]}
    update |= {
        "access_roles": proposal["access_roles"],
        "related_document_ids": proposal["related_document_ids"] + [restricted],
    }
    assert client.patch("/api/documents/proposal-b", headers=admin, json=update).status_code == 200
    analysis = start(client, "proposal-b")
    body = json.dumps(analysis)
    assert restricted not in body and "Vendor C" not in body and "99,000,000" not in body
    assert entry(analysis, "initial_investment")["status"] == "consistent"
    start(client, "proposal-a", supporting_document_ids=[restricted], code=404)


def full_approval(client, analysis, approver, reason="Assumptions inspected."):
    analysis = act(client, analysis, "submit")
    assert analysis["phase"] == "IN_APPROVAL" and analysis["submitted_at"]
    assert analysis["reviewer_id"] == approver and analysis["allowed_actions"] == []
    case = client.get(f"/api/cases/{analysis['id']}", headers=headers(approver)).json()
    approval = next(a for a in case["approvals"] if a["status"] == "PENDING")
    assert "approve" in approval["allowed_actions"]
    value = {"expected_revision": case["revision"], "reason": reason}
    case = call(client, f"approvals/{approval['id']}/approve", value, approver)
    assert case["status"] == "COMPLETED"
    return client.get(f"/api/investment-analyses/{analysis['id']}", headers=headers("finance"))


def test_submission_freezes_snapshot_and_manager_approves(client, db):
    analysis = resolve_quote(client, start(client))
    edited = analysis["memo"] + "\nPrepared by Finance for the October review."
    analysis = act(client, analysis, "memo", memo=edited)
    assert analysis["memo"] == edited and analysis["memo_edited"] is True
    # The manager can inspect the submitted analysis once assigned, before deciding.
    submitted = act(client, analysis, "submit")
    view = client.get(f"/api/investment-analyses/{submitted['id']}", headers=headers("manager"))
    assert view.status_code == 200 and view.json()["memo"] == edited
    assert view.json()["allowed_actions"] == []
    chosen = assumption(submitted, "annual_inflow", "Annual net cash inflow")
    act(client, submitted, "select", code=409, assumption_id=chosen["id"], reason="Late change.")
    act(client, submitted, "memo", code=409, memo="A late memo change after submission.")
    case = client.get(f"/api/cases/{submitted['id']}", headers=headers("manager")).json()
    approval = next(a for a in case["approvals"] if a["status"] == "PENDING")
    assert approval["requested_from"] == "manager"
    # REVIEW_REQUIRED (proposal-level authority) needs a recorded reason.
    value = {"expected_revision": case["revision"]}
    call(client, f"approvals/{approval['id']}/approve", value, "manager", 422)
    value["reason"] = "Quotation price accepted; NPV positive at 10%."
    call(client, f"approvals/{approval['id']}/approve", value, "manager")
    final = client.get(f"/api/investment-analyses/{submitted['id']}", headers=headers("finance"))
    body = final.json()
    assert body["phase"] == "APPROVED" and body["status"] == "COMPLETED"
    stored = db.get(InvestmentAnalysis, submitted["id"])
    assert stored.submitted["route"]["route"] == "manager"
    assert stored.submitted["inputs"]["initial_investment"] == 195_000_000
    events = [e["event_type"] for e in body["activity"]]
    assert {"investment_submitted", "memo_updated", "approval_approved"} <= set(events)


def test_finance_cannot_self_approve_and_others_cannot_open(client):
    analysis = act(client, start(client, "proposal-b"), "submit")
    case = client.get(f"/api/cases/{analysis['id']}", headers=headers("finance")).json()
    approval = next(a for a in case["approvals"] if a["status"] == "PENDING")
    assert approval["allowed_actions"] == []
    value = {"expected_revision": case["revision"], "reason": "Self approval."}
    call(client, f"approvals/{approval['id']}/approve", value, "finance", 403)
    for role in ["employee", "compliance", "sme"]:
        response = client.get(f"/api/investment-analyses/{analysis['id']}", headers=headers(role))
        assert response.status_code == 404
        assert client.get("/api/investment-analyses", headers=headers(role)).json() == []


def test_investment_above_authority_limit_routes_to_committee(client, admin):
    policy = client.get("/api/documents/approval-policy", headers=admin).json()
    text = (
        b"## Approval thresholds\nInvestments up to IDR 200,000,000 require a department "
        b"manager and Finance reviewer. Investments above IDR 200,000,000 require committee "
        b"approval."
    )
    response = client.post(
        "/api/documents/approval-policy/versions",
        headers=admin,
        data={"version": "1.1", "effective_date": "2026-02-01"},
        files={"file": ("approval-policy-v1.1.md", text)},
    )
    assert response.status_code == 201, response.text
    assert policy["versions"][0]["status"] == "active"
    analysis = start(client, "proposal-b")
    assert analysis["approval_route"]["route"] == "committee"
    assert analysis["approval_route"]["threshold"] == 200_000_000
    body = full_approval(client, analysis, "governance").json()
    assert body["phase"] == "APPROVED"


def test_generic_workflow_start_is_refused_for_analysis(client):
    analysis = start(client, "proposal-b")
    value = {"expected_revision": analysis["revision"], "case_id": analysis["id"]}
    call(client, "workflows/generic-review-v1/start", value, code=409)
    case = client.get(f"/api/cases/{analysis['id']}", headers=headers("finance")).json()
    assert "start_workflow" not in case["allowed_actions"]


def test_idempotent_submit_replays_without_second_workflow(client):
    analysis = start(client, "proposal-b")
    first = act(client, analysis, "submit", idempotency_key="submit-proposal-b")
    replay = act(client, analysis, "submit", idempotency_key="submit-proposal-b")
    assert replay["revision"] == first["revision"] and replay["phase"] == "IN_APPROVAL"


def test_request_more_information_returns_to_finance(client):
    analysis = act(client, start(client, "proposal-b"), "submit")
    case = client.get(f"/api/cases/{analysis['id']}", headers=headers("manager")).json()
    approval = next(a for a in case["approvals"] if a["status"] == "PENDING")
    value = {
        "expected_revision": case["revision"],
        "reason": "Attach the signed quotation terms.",
        "evidence_label": "Signed quotation terms",
    }
    call(client, f"approvals/{approval['id']}/request-evidence", value, "manager")
    view = client.get(f"/api/investment-analyses/{analysis['id']}", headers=headers("finance"))
    assert view.json()["phase"] == "INFORMATION_REQUESTED"
    assert view.json()["allowed_actions"] == ["provide_information"]
