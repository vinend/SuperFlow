import pytest
from sqlalchemy import select

from superflow.models import Case, DocumentChunk, QuestionRun


def headers(role):
    return {"X-User-Id": role}


def request(client, path, value, role="employee", code=200):
    response = client.post("/api/" + path, json=value, headers=headers(role))
    assert response.status_code == code, response.text
    return response.json()


def create(client, scenario="verified", role="employee"):
    questions = {
        "verified": {
            "question": "How many annual leave days do I get?",
            "document_ids": ["leave-policy"],
        },
        "historical": {
            "question": "annual leave days historical v1",
            "document_ids": ["leave-policy"],
            "include_outdated": True,
        },
        "missing": {
            "question": "Can I reimburse an expense without a receipt?",
            "document_ids": ["expense-sop"],
        },
        "conflict": {"question": "How often are access rights reviewed?"},
        "restricted": {"question": "What is the investment approval authority?"},
    }
    answer = request(client, "ask", questions[scenario], role, 201)
    case = request(
        client,
        "cases",
        {
            "title": "Knowledge review " + scenario,
            "question_run_id": answer["id"],
            "allow_recovery": True,
        },
        role,
        403 if scenario == "restricted" else 201,
    )
    return case


def mutate(client, case, path, role="employee", **extra):
    return request(client, path, {"expected_revision": case["revision"], **extra}, role)


def start(client, case):
    return mutate(client, case, "workflows/generic-review-v1/start", case_id=case["id"])


def complete_task(client, case):
    return mutate(client, case, "tasks/" + case["workflow"]["tasks"][0]["id"] + "/complete")


def pending(case):
    return next(a for a in case["approvals"] if a["status"] == "PENDING")


def test_verified_case_workflow_approval_persists_and_audits(client):
    case = start(client, create(client))
    assert case["workflow"]["tasks"][0]["owner_id"] == "employee"
    case = mutate(client, case, "tasks/" + case["workflow"]["tasks"][0]["id"] + "/start")
    assert case["workflow"]["tasks"][0]["status"] == "IN_PROGRESS"
    case = complete_task(client, case)
    assert case["workflow"]["status"] == "WAITING_FOR_APPROVAL"
    approval = pending(case)
    assert approval["requested_from"] == "manager"
    case = mutate(
        client,
        case,
        "approvals/" + approval["id"] + "/approve",
        "manager",
        reason="Current evidence inspected.",
    )
    assert case["status"] == case["workflow"]["status"] == "COMPLETED"
    read = client.get("/api/cases/" + case["id"], headers=headers("employee")).json()
    assert read["workflow"] == case["workflow"]
    events = {a["event_type"] for a in read["activity"]}
    assert {
        "case_created",
        "workflow_started",
        "task_created",
        "task_started",
        "task_completed",
        "workflow_advanced",
        "approval_requested",
        "approval_approved",
        "workflow_completed",
    } <= events


def test_manual_case_missing_evidence_request_resume(client):
    case = request(client, "cases", {"title": "Review annual leave documentation"}, code=201)
    case = complete_task(client, start(client, case))
    assert case["workflow"]["status"] == "WAITING_FOR_EVIDENCE"
    approval = pending(case)
    case = mutate(
        client,
        case,
        "approvals/" + approval["id"] + "/request-evidence",
        "manager",
        reason="Attach the current leave policy section.",
        evidence_label="Current approved leave policy",
    )
    required = next(e for e in case["evidence"] if e["key"].startswith("request-"))
    assert required["status"] == "missing"
    doc = client.get("/api/documents/leave-policy", headers=headers("employee")).json()
    chunk = next(v for v in doc["versions"] if v["status"] == "active")["chunks"][0]["id"]
    case = mutate(
        client,
        case,
        "cases/" + case["id"] + "/evidence",
        chunk_ids=[chunk],
        requirement_key=required["key"],
    )
    assert case["reliability"]["status"] == "VERIFIED"
    case = mutate(client, case, "workflow-runs/" + case["workflow"]["id"] + "/advance")
    case = mutate(client, case, "approvals/" + pending(case)["id"] + "/approve", "manager")
    assert case["status"] == "COMPLETED"


def test_conflict_routes_sme_requires_reason_preserves_guard(client):
    case = complete_task(client, start(client, create(client, "conflict")))
    approval = pending(case)
    assert approval["requested_from"] == "sme"
    request(
        client,
        "approvals/" + approval["id"] + "/approve",
        {"expected_revision": case["revision"]},
        "sme",
        422,
    )
    case = mutate(
        client,
        case,
        "approvals/" + approval["id"] + "/approve",
        "sme",
        reason="Record the conflicting guidance for owner review; no automatic policy replacement.",
    )
    assert case["status"] == "COMPLETED"
    assert case["reliability"]["status"] == "REVIEW_REQUIRED"


@pytest.mark.parametrize("scenario", ["missing", "historical"])
def test_unsafe_guard_cannot_be_approved_or_overridden(client, scenario):
    case = complete_task(client, start(client, create(client, scenario)))
    assert case["workflow"]["status"] == "WAITING_FOR_EVIDENCE"
    approval = pending(case)
    request(
        client,
        "approvals/" + approval["id"] + "/approve",
        {"expected_revision": case["revision"]},
        "manager",
        409,
    )
    request(
        client,
        "approvals/" + approval["id"] + "/override",
        {"expected_revision": case["revision"], "reason": "Cannot bypass prerequisites."},
        "governance",
        409,
    )


def test_restricted_answer_case_denied_and_existing_case_revoked(client, db):
    create(client, "restricted")
    case = create(client)
    from superflow.models import Document

    doc = db.get(Document, "leave-policy")
    doc.access_roles = ["finance"]
    db.commit()
    response = client.get("/api/cases/" + case["id"], headers=headers("employee"))
    assert response.status_code == 404
    assert "15" not in response.text
    assert client.get("/api/cases", headers=headers("employee")).json() == []
    assert request(
        client,
        "cases/" + case["id"] + "/evidence",
        {"expected_revision": 0, "chunk_ids": ["unknown"]},
        code=404,
    )


def test_case_ownership_and_unauthorized_actions(client):
    case = create(client)
    assert client.get("/api/cases/" + case["id"], headers=headers("finance")).status_code == 404
    response = client.patch(
        "/api/cases/" + case["id"],
        headers=headers("employee"),
        json={"expected_revision": 0, "owner_id": "manager"},
    )
    assert response.status_code == 403
    case = complete_task(client, start(client, case))
    approval = pending(case)
    request(
        client,
        "approvals/" + approval["id"] + "/approve",
        {"expected_revision": case["revision"]},
        code=403,
    )
    request(
        client,
        "workflow-runs/" + case["workflow"]["id"] + "/advance",
        {"expected_revision": case["revision"]},
        "manager",
        403,
    )
    request(
        client,
        "tasks/" + case["workflow"]["tasks"][0]["id"] + "/complete",
        {"expected_revision": case["revision"]},
        "manager",
        403,
    )


def test_duplicate_task_transition_and_approval_conflict_idempotency(client):
    case = start(client, create(client))
    path = "tasks/" + case["workflow"]["tasks"][0]["id"] + "/complete"
    value = {"expected_revision": case["revision"], "idempotency_key": "task-complete-001"}
    case = request(client, path, value)
    duplicate = request(client, path, value)
    assert duplicate["revision"] == case["revision"]
    request(client, path, {"expected_revision": case["revision"]}, code=409)
    approval = pending(case)
    path = "approvals/" + approval["id"] + "/approve"
    value = {"expected_revision": case["revision"], "idempotency_key": "approve-action-001"}
    case = request(client, path, value, "manager")
    assert request(client, path, value, "manager")["status"] == "COMPLETED"
    request(
        client,
        "approvals/" + approval["id"] + "/reject",
        {"expected_revision": case["revision"], "reason": "Stale decision"},
        "manager",
        409,
    )


def test_invalid_advance_and_retry_after_completion(client):
    case = start(client, create(client))
    request(
        client,
        "workflow-runs/" + case["workflow"]["id"] + "/advance",
        {"expected_revision": case["revision"]},
        code=409,
    )
    request(
        client,
        "workflow-runs/" + case["workflow"]["id"] + "/retry",
        {"expected_revision": case["revision"]},
        code=409,
    )


def test_retry_attempts_maximum_fallback_no_unsafe_override(client, db):
    case = start(client, create(client))
    context = db.get(QuestionRun, db.get(Case, case["id"]).context_run_id)
    context.answer = "Unsupported claim"
    db.commit()
    case = complete_task(client, case)
    assert case["workflow"]["status"] == "FAILED"
    run_id = case["workflow"]["id"]
    case = mutate(client, case, "workflow-runs/" + run_id + "/retry")
    assert case["workflow"]["status"] == "FAILED"
    case = mutate(client, case, "workflow-runs/" + run_id + "/retry")
    assert case["workflow"]["current_step"] == "manual_review"
    assert case["workflow"]["status"] == "WAITING_FOR_APPROVAL"
    failed = next(s for s in case["workflow"]["steps"] if s["key"] == "validate")
    assert failed["retry_count"] == 2 and len(failed["attempts"]) == 3
    assert all(a["outcome"] == "FAILED" for a in failed["attempts"])
    assert "fallback_triggered" in {a["event_type"] for a in case["activity"]}
    request(
        client,
        "workflow-runs/" + run_id + "/retry",
        {"expected_revision": case["revision"]},
        code=409,
    )
    request(
        client,
        "approvals/" + pending(case)["id"] + "/approve",
        {"expected_revision": case["revision"]},
        "sme",
        409,
    )


def test_retry_recovery_uses_guard(client, db):
    case = start(client, create(client))
    run = db.get(QuestionRun, db.get(Case, case["id"]).context_run_id)
    original = run.answer
    run.answer = "Unsupported claim"
    db.commit()
    case = complete_task(client, case)
    run.answer = original
    db.commit()
    case = mutate(client, case, "workflow-runs/" + case["workflow"]["id"] + "/retry")
    assert case["workflow"]["status"] == "WAITING_FOR_APPROVAL"


def test_escalation_override_mandatory_reason_and_authority(client):
    case = complete_task(client, start(client, create(client)))
    approval = pending(case)
    case = mutate(
        client,
        case,
        "approvals/" + approval["id"] + "/escalate",
        "manager",
        reason="Need higher authority.",
    )
    assert case["workflow"]["status"] == "ESCALATED"
    approval = pending(case)
    assert approval["requested_from"] == "governance"
    request(
        client,
        "approvals/" + approval["id"] + "/override",
        {"expected_revision": case["revision"], "reason": " "},
        "governance",
        422,
    )
    case = mutate(
        client,
        case,
        "approvals/" + approval["id"] + "/override",
        "governance",
        reason="Reviewed current approved evidence and recorded exception.",
    )
    assert case["status"] == "COMPLETED"
    assert case["approvals"][-1]["override_reason"]


def test_reject_closes_tasks_workflow(client):
    case = complete_task(client, start(client, create(client)))
    case = mutate(
        client,
        case,
        "approvals/" + pending(case)["id"] + "/reject",
        "manager",
        reason="Request withdrawn.",
    )
    assert case["status"] == "CANCELLED" and case["workflow"]["status"] == "CANCELLED"


def test_stale_revision_prevents_double_transition(client):
    case = create(client)
    original_revision = case["revision"]
    case = start(client, case)
    request(
        client,
        "workflows/generic-review-v1/start",
        {"case_id": case["id"], "expected_revision": original_revision},
        code=409,
    )
    assert len(client.get("/api/workflow-runs", headers=headers("employee")).json()) == 1


def test_historical_current_replacement_can_resume(client):
    case = complete_task(client, start(client, create(client, "historical")))
    doc = client.get("/api/documents/leave-policy", headers=headers("employee")).json()
    chunk = next(v for v in doc["versions"] if v["status"] == "active")["chunks"][0]["id"]
    case = mutate(client, case, "cases/" + case["id"] + "/evidence", chunk_ids=[chunk])
    assert case["reliability_status"] == "VERIFIED"
    assert all(s["status"] == "active" for s in case["sources"])
    case = mutate(client, case, "workflow-runs/" + case["workflow"]["id"] + "/advance")
    assert case["workflow"]["status"] == "WAITING_FOR_APPROVAL"


def test_task_escalation_does_not_bypass_task_or_guard(client):
    case = start(client, create(client))
    case = mutate(
        client,
        case,
        "workflow-runs/" + case["workflow"]["id"] + "/escalate",
        reason="Need higher authority before collecting evidence.",
    )
    request(
        client,
        "tasks/" + case["workflow"]["tasks"][0]["id"] + "/complete",
        {"expected_revision": case["revision"]},
        code=409,
    )
    case = mutate(client, case, "approvals/" + pending(case)["id"] + "/approve", "governance")
    assert case["workflow"]["tasks"][0]["status"] == "TODO"
    case = complete_task(client, case)
    assert case["workflow"]["status"] == "WAITING_FOR_APPROVAL"
    assert pending(case)["requested_from"] == "manager"


@pytest.mark.parametrize(
    "case_type,reviewer",
    [("investment", "finance"), ("regulatory_review", "compliance"), ("audit", "sme")],
)
def test_selected_case_types_route_to_domain_reviewer(client, case_type, reviewer):
    case = create(client)
    # Classification is metadata only; no domain analysis is performed.
    response = request(
        client,
        "cases",
        {
            "title": "Domain neutral classified review",
            "type": case_type,
            "question_run_id": case["question_run_id"],
        },
        code=201,
    )
    result = complete_task(client, start(client, response))
    assert pending(result)["requested_from"] == reviewer


def test_workflow_demo_is_resettable_idempotent_and_real(db):
    from superflow.models import WorkflowRun
    from superflow.workflow_demo import seed_workflow_demo

    assert seed_workflow_demo(db) == 3
    assert seed_workflow_demo(db) == 0
    assert len(list(db.scalars(select(WorkflowRun)))) == 3


def test_denied_evidence_never_enters_case_context(client, db):
    case = create(client)
    from superflow.models import DocumentVersion

    chunk = db.scalar(
        select(DocumentChunk.id)
        .join(DocumentVersion)
        .where(DocumentVersion.document_id == "approval-policy")
    )
    request(
        client,
        "cases/" + case["id"] + "/evidence",
        {"expected_revision": case["revision"], "chunk_ids": [chunk]},
        code=404,
    )
    run = db.get(QuestionRun, db.get(Case, case["id"]).context_run_id)
    assert all(ref["chunk_id"] != chunk for ref in run.source_refs)


def test_case_context_does_not_bypass_requirements_via_ask_history(client, db):
    case = create(client)
    context_id = db.get(Case, case["id"]).context_run_id
    history = client.get("/api/ask", headers=headers("employee")).json()
    assert context_id not in {row["id"] for row in history}
    assert case["question_run_id"] in {row["id"] for row in history}
    assert client.get("/api/ask/" + context_id, headers=headers("employee")).status_code == 404
    assert (
        client.get("/api/ask/" + case["question_run_id"], headers=headers("employee")).status_code
        == 200
    )
