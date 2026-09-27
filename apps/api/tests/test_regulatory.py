import json
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from superflow.models import AuditEvent, Case, DocumentChunk, RegulatoryFinding, WorkflowRun
from superflow.regulatory_analysis import (
    Candidate,
    DeterministicComparator,
    DeterministicGapAnalyzer,
    ReferenceTopicMapper,
    Section,
    quantities,
)

DUE = (date.today() + timedelta(days=30)).isoformat()


def headers(role):
    return {"X-User-Id": role}


def call(client, path, value=None, role="compliance", code=200):
    response = client.post("/api/" + path, json=value or {}, headers=headers(role))
    assert response.status_code == code, response.text
    return response.json()


def start(client, role="compliance", code=201):
    return call(client, "regulatory-reviews", {"document_id": "regulation"}, role, code)


def finding(review, document_id):
    return next(f for f in review["findings"] if f["impacted"]["document_id"] == document_id)


def decide(client, review, item, action, role="compliance", code=200, **extra):
    path = f"regulatory-reviews/{review['id']}/findings/{item['id']}/{action}"
    return call(client, path, {"expected_revision": review["revision"], **extra}, role, code)


def confirm(client, review, document_id, owner, **extra):
    item = finding(review, document_id)
    return decide(client, review, item, "confirm", owner_id=owner, due_date=DUE, **extra)


def reject(client, review, document_id, reason="Covered by the procedure-level control."):
    return decide(client, review, finding(review, document_id), "reject", reason=reason)


def remediation(client, review, document_id, role):
    case_id = finding(review, document_id)["remediation"]["case_id"]
    response = client.get(f"/api/cases/{case_id}", headers=headers(role))
    assert response.status_code == 200, response.text
    return response.json()


def mutate(client, case, path, role, **extra):
    return call(client, path, {"expected_revision": case["revision"], **extra}, role)


def test_sources_list_regulation_versions_for_compliance_only(client):
    response = client.get("/api/regulatory-reviews/sources", headers=headers("compliance"))
    assert response.status_code == 200
    [source] = response.json()
    assert source["document_id"] == "regulation"
    assert (source["previous"]["version"], source["previous"]["status"]) == ("1.0", "outdated")
    assert (source["current"]["version"], source["current"]["status"]) == ("2.0", "active")
    assert source["open_review_id"] is None
    for role in ["employee", "manager", "sme", "finance", "governance"]:
        denied = client.get("/api/regulatory-reviews/sources", headers=headers(role))
        assert denied.status_code == 403
    assert start(client, "manager", 403)["detail"].startswith("Regulatory Review")


def test_comparison_identifies_material_changes_with_real_citations(client, db):
    review = start(client)
    assert review["phase"] == "GAP_REVIEW" and review["status"] == "IN_PROGRESS"
    assert review["previous"]["version"] == "1.0" and review["current"]["version"] == "2.0"
    changes = {change["key"]: change for change in review["changes"]}
    assert set(changes) == {
        "article-4-access-review",
        "article-7-incident-reporting",
        "article-9-retention",
    }
    assert all(
        change["material"] and change["change_type"] == "MODIFIED" for change in changes.values()
    )
    assert changes["article-4-access-review"]["requirement_changes"] == [
        {"kind": "frequency", "before": "every 12 months", "after": "every 6 months"}
    ]
    assert changes["article-7-incident-reporting"]["requirement_changes"][0]["after"] == (
        "within 24 hours"
    )
    assert changes["article-9-retention"]["requirement_changes"][0] == {
        "kind": "duration",
        "before": "3 years",
        "after": "5 years",
    }
    assert changes["article-4-access-review"]["new_obligations"] == [
        "Evidence must identify the reviewer and record revoked permissions."
    ]
    access = changes["article-4-access-review"]
    assert access["previous"]["status"] == "outdated" and access["current"]["status"] == "active"
    assert {(i["source"]["document_id"], i["basis"]) for i in access["impacts"]} == {
        ("access-sop", "explicit_reference"),
        ("access-review-policy", "topic_match"),
    }
    # Every citation resolves to a stored chunk with the exact excerpt.
    for change in review["changes"]:
        for source in [change["previous"], change["current"]] + [
            impact["source"] for impact in change["impacts"]
        ]:
            assert db.get(DocumentChunk, source["chunk_id"]).text == source["excerpt"]
    assert review["reliability"]["status"] in {"VERIFIED", "REVIEW_REQUIRED"}
    assert review["reliability"]["checks"]["conflict_detection"]["passed"] is False
    assert [event["event_type"] for event in review["activity"]][-1] == (
        "regulatory_review_started"
    )


def test_gap_proposals_are_pending_human_decisions(client):
    review = start(client)
    assert review["finding_count"] == review["pending_count"] == 4
    assert {f["impacted"]["document_id"] for f in review["findings"]} == {
        "access-sop",
        "access-review-policy",
        "incident-sop",
        "retention-sop",
    }
    access = finding(review, "access-sop")
    assert [issue["kind"] for issue in access["issues"]] == [
        "requirement_mismatch",
        "missing_obligation",
    ]
    assert access["issues"][0]["current"] == "every 12 months"
    assert access["suggested_owner_id"] == "governance"
    assert access["status"] == "PROPOSED" and access["allowed_actions"] == ["confirm", "reject"]
    policy = finding(review, "access-review-policy")
    assert [issue["kind"] for issue in policy["issues"]] == ["missing_obligation"]
    assert review["allowed_actions"] == []


def test_starting_again_reuses_open_review_and_is_hidden_from_ask_history(client, db):
    first = start(client)
    again = start(client, code=200)
    assert again["id"] == first["id"]
    assert db.scalar(select(func.count()).select_from(Case)) == 1
    sources = client.get("/api/regulatory-reviews/sources", headers=headers("compliance")).json()
    assert sources[0]["open_review_id"] == first["id"]
    assert client.get("/api/ask", headers=headers("compliance")).json() == []
    listed = client.get("/api/regulatory-reviews", headers=headers("compliance")).json()
    assert [item["id"] for item in listed] == [first["id"]]


def test_restricted_procedures_are_never_mapped_or_leaked(client, admin):
    metadata = {
        "title": "Privileged Vault Access Standard",
        "domain": "Governance",
        "owner_id": "governance",
        "authority_level": 5,
        "access_roles": ["governance"],
        "related_document_ids": ["regulation"],
    }
    text = b"## Access review\nVault owners review access rights every 24 months. Article 4."
    response = client.post(
        "/api/documents",
        headers=admin,
        data={"metadata": json.dumps(metadata), "version": "1.0", "effective_date": "2026-01-01"},
        files={"file": ("vault.md", text)},
    )
    assert response.status_code == 201
    restricted_id = response.json()["id"]
    review = start(client)
    body = json.dumps(review)
    assert restricted_id not in body and "Vault" not in body and "24 months" not in body
    assert review["finding_count"] == 4


def test_confirm_creates_owned_remediation_with_due_date_and_audit(client, db):
    review = start(client)
    edited = "Access Review SOP must move to a six-month cycle and record reviewer identity."
    review = confirm(client, review, "access-sop", "governance", summary=edited, reason="Agreed.")
    item = finding(review, "access-sop")
    assert item["status"] == "CONFIRMED" and item["reviewer_summary"] == edited
    assert item["decided_by"] == "compliance" and item["allowed_actions"] == []
    assert item["remediation"]["owner_id"] == "governance"
    assert item["remediation"]["due_date"] == DUE
    assert item["remediation"]["workflow_status"] == "RUNNING"
    case = remediation(client, review, "access-sop", "governance")
    assert case["type"] == "remediation" and case["created_by"] == "compliance"
    assert case["description"] == edited
    task = case["workflow"]["tasks"][0]
    due = datetime.fromisoformat(task["due_at"]).astimezone(timezone.utc)
    assert task["owner_id"] == "governance" and due.date().isoformat() == DUE
    assert task["allowed_actions"] == ["start", "complete"]
    # Remediation context carries the current requirement and every mapped control.
    assert {s["document_id"] for s in case["sources"]} == {
        "regulation",
        "access-sop",
        "access-review-policy",
    }
    assert all(s["status"] == "active" for s in case["sources"])
    events = [e["event_type"] for e in review["activity"]]
    assert "finding_confirmed" in events
    assert "remediation_assigned" in [e["event_type"] for e in case["activity"]]
    assert review["phase"] == "GAP_REVIEW" and review["confirmed_count"] == 1


def test_confirm_validates_owner_access_due_date_and_authority(client, db):
    review = start(client)
    item = finding(review, "access-sop")
    denied = decide(client, review, item, "confirm", code=403, owner_id="employee", due_date=DUE)
    assert "cannot access" in denied["detail"]
    past = (date.today() - timedelta(days=1)).isoformat()
    decide(client, review, item, "confirm", code=422, owner_id="governance", due_date=past)
    decide(client, review, item, "confirm", "governance", 403, owner_id="sme", due_date=DUE)
    decide(client, review, item, "confirm", "manager", 404, owner_id="sme", due_date=DUE)
    assert db.scalar(select(func.count()).select_from(Case)) == 1
    fresh = client.get(f"/api/regulatory-reviews/{review['id']}", headers=headers("compliance"))
    assert finding(fresh.json(), "access-sop")["status"] == "PROPOSED"


def test_reject_requires_reason_and_stale_or_repeated_decisions_conflict(client):
    review = start(client)
    item = finding(review, "access-review-policy")
    decide(client, review, item, "reject", code=422, reason="  ")
    updated = reject(client, review, "access-review-policy")
    rejected = finding(updated, "access-review-policy")
    assert rejected["status"] == "REJECTED" and rejected["decision_reason"]
    decide(client, review, finding(review, "access-sop"), "reject", code=409, reason="Stale.")
    decide(client, updated, rejected, "reject", code=409, reason="Again.")
    assert "finding_rejected" in [event["event_type"] for event in updated["activity"]]


def test_idempotent_confirm_does_not_duplicate_remediation(client, db):
    review = start(client)
    item = finding(review, "incident-sop")
    value = {"owner_id": "compliance", "due_date": DUE, "idempotency_key": "confirm-incident-1"}
    first = decide(client, review, item, "confirm", **value)
    replay = decide(client, review, item, "confirm", **value)
    assert replay["revision"] == first["revision"]
    assert db.scalar(select(func.count()).select_from(Case)) == 2
    conflict = decide(client, review, item, "confirm", code=409, **{**value, "owner_id": "sme"})
    assert "Idempotency" in conflict["detail"]


def test_review_case_cannot_enter_generic_workflow_or_take_evidence(client, db):
    review = start(client)
    case = client.get(f"/api/cases/{review['id']}", headers=headers("compliance")).json()
    assert "start_workflow" not in case["allowed_actions"]
    assert "attach_evidence" not in case["allowed_actions"]
    value = {"expected_revision": case["revision"], "case_id": case["id"]}
    call(client, "workflows/generic-review-v1/start", value, code=409)
    chunk = case["sources"][0]["chunk_id"]
    evidence = {"expected_revision": case["revision"], "chunk_ids": [chunk]}
    call(client, f"cases/{case['id']}/evidence", evidence, code=409)


def run_remediation(client, review, document_id, owner, reason=""):
    case = remediation(client, review, document_id, owner)
    case = mutate(client, case, f"tasks/{case['workflow']['tasks'][0]['id']}/complete", owner)
    assert case["workflow"]["status"] == "WAITING_FOR_APPROVAL", case["reliability"]["reasons"]
    approval = next(a for a in case["approvals"] if a["status"] == "PENDING")
    assert approval["requested_from"] == "manager"
    case = mutate(client, case, f"approvals/{approval['id']}/approve", "manager", reason=reason)
    assert case["status"] == "COMPLETED"
    return case


def test_full_regulation_to_action_flow_closes_after_approved_remediation(client, db):
    review = start(client)
    review = reject(client, review, "access-review-policy")
    review = confirm(client, review, "access-sop", "governance")
    review = confirm(client, review, "incident-sop", "compliance")
    review = confirm(client, review, "retention-sop", "compliance")
    assert review["phase"] == "REMEDIATION" and review["remediation_total"] == 3
    call(
        client,
        f"regulatory-reviews/{review['id']}/complete",
        {"expected_revision": review["revision"]},
        code=409,
    )
    # The access context still contains the SOP/policy conflict, so approval needs a reason.
    access = run_remediation(client, review, "access-sop", "governance", "Six-month cycle adopted.")
    assert access["reliability"]["status"] == "REVIEW_REQUIRED"
    incident = run_remediation(client, review, "incident-sop", "compliance")
    assert incident["reliability"]["status"] == "VERIFIED"
    run_remediation(client, review, "retention-sop", "compliance")
    review = client.get(
        f"/api/regulatory-reviews/{review['id']}", headers=headers("compliance")
    ).json()
    assert review["phase"] == "READY_TO_CLOSE" and review["remediation_completed"] == 3
    assert review["allowed_actions"] == ["complete"]
    closed = call(
        client,
        f"regulatory-reviews/{review['id']}/complete",
        {"expected_revision": review["revision"]},
    )
    assert closed["phase"] == "COMPLETED" and closed["status"] == "COMPLETED"
    assert closed["activity"][-1]["event_type"] == "regulatory_review_completed"
    assert all(item["allowed_actions"] == [] for item in closed["findings"])
    stored = db.scalar(
        select(AuditEvent).where(AuditEvent.event_type == "regulatory_review_completed")
    )
    assert stored.payload == {"confirmed_count": 3, "rejected_count": 1}


def test_rejected_remediation_can_be_reassigned(client, db):
    review = start(client)
    review = confirm(client, review, "retention-sop", "compliance")
    case = remediation(client, review, "retention-sop", "compliance")
    case = mutate(
        client, case, f"tasks/{case['workflow']['tasks'][0]['id']}/complete", "compliance"
    )
    approval = next(a for a in case["approvals"] if a["status"] == "PENDING")
    mutate(
        client, case, f"approvals/{approval['id']}/reject", "manager", reason="Owner unavailable."
    )
    review = client.get(
        f"/api/regulatory-reviews/{review['id']}", headers=headers("compliance")
    ).json()
    item = finding(review, "retention-sop")
    assert item["remediation"]["status"] == "CANCELLED" and item["allowed_actions"] == ["reassign"]
    review = decide(client, review, item, "confirm", owner_id="governance", due_date=DUE)
    item = finding(review, "retention-sop")
    assert item["remediation"]["owner_id"] == "governance"
    assert item["remediation"]["status"] == "IN_PROGRESS"
    assert "remediation_reassigned" in [event["event_type"] for event in review["activity"]]
    assert db.scalar(select(func.count()).select_from(WorkflowRun)) == 2


def test_governance_can_inspect_but_not_decide_and_others_cannot_open(client):
    review = start(client)
    oversight = client.get(f"/api/regulatory-reviews/{review['id']}", headers=headers("governance"))
    assert oversight.status_code == 200
    assert all(item["allowed_actions"] == [] for item in oversight.json()["findings"])
    for role in ["employee", "manager", "finance"]:
        response = client.get(f"/api/regulatory-reviews/{review['id']}", headers=headers(role))
        assert response.status_code == 404
        assert client.get("/api/regulatory-reviews", headers=headers(role)).json() == []


def test_findings_persist_and_reset_clears_regulatory_state(client, db):
    from superflow.seed import reset_synthetic

    review = start(client)
    assert db.scalar(select(func.count()).select_from(RegulatoryFinding)) == 4
    reset_synthetic(db)
    assert db.scalar(select(func.count()).select_from(RegulatoryFinding)) == 0
    response = client.get(f"/api/regulatory-reviews/{review['id']}", headers=headers("compliance"))
    assert response.status_code == 404


@pytest.mark.parametrize(
    "text,expected",
    [
        ("reviewed every six months", ("every", 6, "month")),
        ("reported within 24 hours of confirmation", ("within", 24, "hour")),
        ("retained for five years with a log", ("for", 5, "year")),
    ],
)
def test_quantity_extraction(text, expected):
    [item] = quantities(text)
    assert (item.phrase, item.value, item.unit) == expected


def test_comparator_detects_added_removed_unchanged_and_bounds():
    base = [
        Section("b1", "Article 1 — Scope", "Applies to all systems."),
        Section("b2", "Article 2 — Logs", "Logs must be kept for two years."),
        Section("b3", "Article 3 — Legacy", "Legacy rule."),
    ]
    target = [
        Section("t1", "Article 1 — Scope", "Applies to all systems."),
        Section("t2", "Article 2 — Logs", "Logs must be kept for one year."),
        Section("t4", "Article 4 — Keys", "Keys must be rotated every 90 days."),
    ]
    changes = {c.key: c for c in DeterministicComparator().compare(base, target)}
    assert changes["article-1-scope"].change_type == "UNCHANGED"
    assert not changes["article-1-scope"].material
    assert changes["article-2-logs"].requirement_changes[0]["after"] == "1 year"
    assert changes["article-3-legacy"].change_type == "REMOVED"
    assert changes["article-4-keys"].change_type == "ADDED" and changes["article-4-keys"].material
    # A procedure keeping logs longer than required satisfies a lower "for" bound.
    stricter = Candidate("sop", "c1", "Logs", "Logs are kept for three years. Article 2.", True)
    assert DeterministicGapAnalyzer().issues(changes["article-2-logs"], stricter) == []
    looser = Candidate("sop", "c2", "Rotation", "Keys are rotated every 180 days.", False)
    mapped = ReferenceTopicMapper().map(changes["article-4-keys"], [looser])
    assert mapped == [(looser, "topic_match")]
    issues = DeterministicGapAnalyzer().issues(changes["article-4-keys"], looser)
    assert issues[0]["kind"] == "requirement_mismatch"
