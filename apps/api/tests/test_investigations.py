"""Phase 7 synthetic domain, bounded tools, Guard and independent checker."""

from sqlalchemy import func, select

from superflow.auth import can_read
from superflow.investigation_contracts import AgentAction
from superflow.investigations import (
    MAX_AGENT_STEPS,
    _ollama_plan,
    detect_evidence_conflict,
    deterministic_plan,
    triage_priority,
)
from superflow.models import (
    AuditEvent,
    CaseEvidence,
    Document,
    DocumentChunk,
    DocumentVersion,
    Investigation,
    ToolRun,
    User,
)

ANALYST = {"X-User-Id": "compliance"}
CHECKER = {"X-User-Id": "compliance_checker"}


def create(client, scenario="complete"):
    response = client.post("/api/investigations", headers=ANALYST, json={"scenario": scenario})
    assert response.status_code == 201, response.text
    return response.json()


def post(client, item, suffix, *, actor=ANALYST, extra=None):
    response = client.post(
        f"/api/investigations/{item['id']}{suffix}",
        headers=actor,
        json={"expected_revision": item["revision"], **(extra or {})},
    )
    return response


def recommendation(client, item):
    response = post(
        client,
        item,
        "/recommendation",
        extra={
            "notes": "Synthetic records reviewed by analyst.",
            "recommendation": (
                "Request independent checker review of the recorded synthetic indicators."
            ),
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_complete_investigation_persists_and_checker_is_independent(client, db):
    item = create(client)
    assert item["reliability"]["status"] == "BLOCKED"
    assert len([e for e in item["evidence"] if e["required"] and e["status"] == "available"]) == 3
    assert db.get(Investigation, item["id"]).template_id == "synthetic-alert-review-v1"
    collected = post(client, item, "/agent/run")
    assert collected.status_code == 200, collected.text
    item = collected.json()
    assert item["reliability"]["status"] == "VERIFIED"
    assert len([e for e in item["evidence"] if e["required"] and e["status"] == "available"]) == 5
    assert len(item["tool_runs"]) == 4
    for key in item["template"]["required"]:
        assert item["provenance"][key]["tool_run_id"] in {run["id"] for run in item["tool_runs"]}
    item = recommendation(client, item)
    submit = post(client, item, "/submit")
    assert submit.status_code == 200, submit.text
    item = submit.json()
    assert item["workflow_run_id"] and item["approval_id"]
    assert item["approval_status"] == "PENDING"
    assert client.get(f"/api/investigations/{item['id']}", headers=ANALYST).json()["submitted_at"]
    assert client.get(f"/api/investigations/{item['id']}", headers=CHECKER).status_code == 200
    self_decision = client.post(
        f"/api/approvals/{item['approval_id']}/approve",
        headers=ANALYST,
        json={"expected_revision": item["revision"], "reason": "Self approval"},
    )
    assert self_decision.status_code == 403
    checker = client.post(
        f"/api/approvals/{item['approval_id']}/approve",
        headers=CHECKER,
        json={
            "expected_revision": item["revision"],
            "reason": "Evidence and recommendation reviewed.",
        },
    )
    assert checker.status_code == 200, checker.text
    assert checker.json()["status"] == "COMPLETED"
    assert client.get(f"/api/investigations/{item['id']}", headers=ANALYST).json()["completed_at"]
    duplicate = client.post(
        f"/api/approvals/{item['approval_id']}/approve",
        headers=CHECKER,
        json={"expected_revision": checker.json()["revision"], "reason": "Again"},
    )
    assert duplicate.status_code == 409
    events = list(
        db.scalars(select(AuditEvent.event_type).where(AuditEvent.entity_id == item["id"]))
    )
    for event in (
        "investigation_created",
        "tool_completed",
        "evidence_collected",
        "agent_run_started",
        "investigation_submitted_to_checker",
        "checker_decision_recorded",
        "investigation_completed",
    ):
        assert event in events


def test_failed_tool_retries_stop_and_evidence_remains_missing(client, db):
    item = create(client, "failed_evidence")
    result = post(client, item, "/agent/run")
    assert result.status_code == 200, result.text
    item = result.json()
    assert item["reliability"]["status"] == "BLOCKED"
    assert "Watchlist screening" in " ".join(item["reliability"]["reasons"])
    assert [
        r["status"] for r in item["tool_runs"] if r["tool_name"] == "run_watchlist_screening"
    ] == ["failed", "failed"]
    assert (
        next(e for e in item["evidence"] if e["key"] == "watchlist_screening")["status"]
        == "missing"
    )
    assert post(client, item, "/submit").status_code == 409
    assert post(client, item, "/tools/run_watchlist_screening/retry").status_code == 409
    assert (
        db.scalar(
            select(func.count())
            .select_from(CaseEvidence)
            .where(CaseEvidence.case_id == item["id"], CaseEvidence.key == "watchlist_screening")
        )
        == 1
    )


def test_conflict_is_review_required_and_checker_reason_is_required(client):
    item = create(client, "conflict")
    item = post(client, item, "/agent/run").json()
    assert item["reliability"]["status"] == "REVIEW_REQUIRED"
    assert item["reliability"]["checks"]["conflict_detection"]["passed"] is False
    assert "salary-only" in item["reliability"]["checks"]["conflict_detection"]["details"]
    item = recommendation(client, item)
    item = post(client, item, "/submit").json()
    blank = client.post(
        f"/api/approvals/{item['approval_id']}/approve",
        headers=CHECKER,
        json={"expected_revision": item["revision"]},
    )
    assert blank.status_code == 422
    assert (
        client.post(
            f"/api/approvals/{item['approval_id']}/approve",
            headers=CHECKER,
            json={
                "expected_revision": item["revision"],
                "reason": (
                    "Conflict reviewed with analyst; recommendation accepted for this "
                    "synthetic exercise."
                ),
            },
        ).status_code
        == 200
    )


def test_checker_request_for_more_information_reuses_case_evidence_and_guard(client, db):
    item = create(client)
    item = post(client, item, "/agent/run").json()
    item = recommendation(client, item)
    item = post(client, item, "/submit").json()
    requested = client.post(
        f"/api/approvals/{item['approval_id']}/request-evidence",
        headers=CHECKER,
        json={
            "expected_revision": item["revision"],
            "reason": "Please attach the current approved procedure reference.",
            "evidence_label": "Approved procedure reference",
        },
    )
    assert requested.status_code == 200, requested.text
    case = requested.json()
    assert case["status"] == "WAITING_FOR_EVIDENCE"
    assert case["reliability"]["status"] == "BLOCKED"
    requirement = "request-" + item["approval_id"]
    assert any(e["key"] == requirement and e["status"] == "missing" for e in case["evidence"])
    analyst = db.get(User, "compliance")
    chunk_id = next(
        chunk.id
        for chunk, version, document in db.execute(
            select(DocumentChunk, DocumentVersion, Document)
            .join(DocumentVersion, DocumentChunk.version_id == DocumentVersion.id)
            .join(Document, DocumentVersion.document_id == Document.id)
            .where(DocumentVersion.status == "active", Document.authority_level >= 4)
        )
        if can_read(analyst, document)
    )
    attached = client.post(
        f"/api/cases/{item['id']}/evidence",
        headers=ANALYST,
        json={
            "expected_revision": case["revision"],
            "requirement_key": requirement,
            "chunk_ids": [chunk_id],
        },
    )
    assert attached.status_code == 200, attached.text
    case = attached.json()
    assert case["reliability"]["status"] == "VERIFIED"
    resumed = client.post(
        f"/api/workflow-runs/{item['workflow_run_id']}/advance",
        headers=ANALYST,
        json={"expected_revision": case["revision"]},
    )
    assert resumed.status_code == 200, resumed.text
    assert any(a["status"] == "PENDING" for a in resumed.json()["approvals"])


def test_roles_cannot_read_or_mutate_raw_investigation(client):
    item = create(client)
    for role in ("employee", "finance", "manager", "governance"):
        headers = {"X-User-Id": role}
        response = client.get(f"/api/investigations/{item['id']}", headers=headers)
        assert response.status_code in (403, 404)
        assert "Rizky" not in response.text
        assert client.post(
            f"/api/investigations/{item['id']}/agent/run",
            headers=headers,
            json={"expected_revision": item["revision"]},
        ).status_code in (403, 404)
        assert item["id"] not in {c["id"] for c in client.get("/api/cases", headers=headers).json()}
    assert client.get("/api/investigations", headers=CHECKER).json() == []


def test_tool_registry_idempotency_revision_and_model_validation(client, db):
    item = create(client)
    invalid = post(client, item, "/tools/arbitrary_external_lookup")
    assert invalid.status_code == 422
    assert (
        db.scalar(
            select(func.count()).select_from(ToolRun).where(ToolRun.investigation_id == item["id"])
        )
        == 2
    )
    tool = post(
        client, item, "/tools/run_watchlist_screening", extra={"idempotency_key": "watchlist-001"}
    )
    assert tool.status_code == 200, tool.text
    updated = tool.json()
    repeated = post(
        client, item, "/tools/run_watchlist_screening", extra={"idempotency_key": "watchlist-001"}
    )
    assert repeated.status_code == 200
    assert repeated.json()["revision"] == updated["revision"]
    assert post(client, item, "/tools/search_adverse_news").status_code == 409
    assert post(client, updated, "/tools/run_watchlist_screening").status_code == 409
    assert (
        db.scalar(
            select(func.count())
            .select_from(ToolRun)
            .where(
                ToolRun.investigation_id == item["id"],
                ToolRun.tool_name == "run_watchlist_screening",
            )
        )
        == 1
    )
    plan = deterministic_plan(db, db.get(Investigation, item["id"]))
    assert plan.next_action.value == "search_adverse_news"
    assert MAX_AGENT_STEPS == 8
    try:
        AgentAction.model_validate(
            {
                "next_action": "browse_the_web",
                "evidence_requirement": "news",
                "reason": "Unknown external action",
                "stop": False,
            }
        )
        assert False, "Unknown action should fail closed"
    except ValueError:
        pass


def test_malformed_synthetic_tool_result_fails_without_collecting_evidence(client, monkeypatch):
    item = create(client)
    monkeypatch.setattr(
        "superflow.investigations._tool_fixture",
        lambda _investigation, _tool: {"unexpected": "unvalidated result"},
    )
    response = post(client, item, "/tools/run_watchlist_screening")
    assert response.status_code == 200, response.text
    item = response.json()
    attempt = next(r for r in item["tool_runs"] if r["tool_name"] == "run_watchlist_screening")
    assert attempt["status"] == "failed"
    assert attempt["error_code"] == "INVALID_SYNTHETIC_RESULT"
    assert (
        next(e for e in item["evidence"] if e["key"] == "watchlist_screening")["status"]
        == "missing"
    )
    assert item["reliability"]["status"] == "BLOCKED"


def test_triage_rule_and_guard_provenance_fail_closed(client, db):
    assert triage_priority([]) == "LOW"
    assert triage_priority(["velocity", "new beneficiary"]) == "MEDIUM"
    assert triage_priority(["velocity", "new beneficiary", "baseline mismatch"]) == "HIGH"
    assert detect_evidence_conflict(
        {"declared_source_of_funds": "Monthly salary"},
        {"narrative": "Business settlement"},
    )
    assert (
        detect_evidence_conflict(
            {"declared_source_of_funds": "Monthly salary"},
            {"narrative": "Rapid movement to new beneficiaries"},
        )
        is None
    )
    item = create(client)
    item = post(client, item, "/agent/run").json()
    assert item["context"]["triage_level"] == "HIGH"
    row = db.get(Investigation, item["id"])
    row.provenance = {}
    db.commit()
    blocked = client.get(f"/api/investigations/{item['id']}", headers=ANALYST).json()
    assert blocked["reliability"]["status"] == "BLOCKED"
    assert blocked["reliability"]["checks"]["citation_coverage"]["passed"] is False
    row.template_id = "unknown-template"
    db.commit()
    blocked = client.get(f"/api/investigations/{item['id']}", headers=ANALYST).json()
    assert blocked["reliability"]["checks"]["version_validity"]["passed"] is False


def test_ollama_planner_accepts_only_current_allowlisted_action(monkeypatch, db):
    import json

    from superflow.config import settings

    monkeypatch.setattr(settings, "llm_provider", "ollama")
    allowed = AgentAction(
        next_action="run_watchlist_screening",
        evidence_requirement="watchlist_screening",
        reason="Required watchlist evidence is missing.",
        stop=False,
    )

    class Response:
        def __init__(self, content):
            self.content = content

        def raise_for_status(self):
            return None

        def json(self):
            return {"message": {"content": self.content}}

    class Client:
        content = ""

        def __init__(self, **_):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def post(self, *_args, **_kwargs):
            return Response(self.content)

    monkeypatch.setattr("superflow.investigations.httpx.Client", Client)
    Client.content = "not json"
    assert _ollama_plan(db, object(), allowed) is allowed
    Client.content = json.dumps(
        {
            "next_action": "arbitrary_external_lookup",
            "evidence_requirement": "watchlist_screening",
            "reason": "Try external tool",
            "stop": False,
        }
    )
    assert _ollama_plan(db, object(), allowed) is allowed
    Client.content = json.dumps(
        {
            "next_action": "search_adverse_news",
            "evidence_requirement": "adverse_news",
            "reason": "Wrong allowed action",
            "stop": False,
        }
    )
    assert _ollama_plan(db, object(), allowed) is allowed
    Client.content = allowed.model_dump_json()
    assert _ollama_plan(db, object(), allowed).next_action == allowed.next_action
