import json

import pytest
from sqlalchemy import event, func, select, text
from sqlalchemy.exc import DBAPIError

from superflow.guard import GuardInput, SuperFlowGuard
from superflow.knowledge import citation_payload
from superflow.models import (
    AuditEvent,
    Document,
    DocumentChunk,
    DocumentVersion,
    GuardEvaluation,
    QuestionRun,
    User,
)
from superflow.providers import ExtractiveDemoProvider
from superflow.reliability_contracts import ReliabilityStatus
from superflow.retrieval import KeywordConceptRetriever
from superflow.schemas import AskInput
from superflow.seed import reset_synthetic


def ask(client, question, **filters):
    response = client.post(
        "/api/ask", headers={"X-User-Id": "employee"}, json={"question": question, **filters}
    )
    assert response.status_code == 201, response.text
    return response.json()


def guard_input(db, **overrides):
    user = db.get(User, "employee")
    query = AskInput(question="annual leave days", document_ids=["leave-policy"])
    hits = KeywordConceptRetriever().retrieve(db, user, query)
    sources = [
        citation_payload(db, user, hit.chunk_id, number) for number, hit in enumerate(hits, 1)
    ]
    return GuardInput(
        user=user,
        query=query,
        sources=sources,
        answer=ExtractiveDemoProvider().answer(query.question, sources),
        **overrides,
    )


@pytest.mark.parametrize(
    "question,filters,status",
    [
        ("How many annual leave days do I get?", {"document_ids": ["leave-policy"]}, "VERIFIED"),
        (
            "annual leave days historical v1",
            {"document_ids": ["leave-policy"], "include_outdated": True},
            "OUTDATED",
        ),
        ("What is the investment approval authority?", {}, "ACCESS_RESTRICTED"),
        (
            "Can I reimburse an expense without a receipt?",
            {"document_ids": ["expense-sop"]},
            "BLOCKED",
        ),
        ("How often are access rights reviewed?", {}, "REVIEW_REQUIRED"),
    ],
)
def test_five_states_persist_and_survive_refresh(client, db, employee, question, filters, status):
    answer = ask(client, question, **filters)
    result = answer["reliability"]
    assert result["status"] == status
    assert set(result["checks"]) == {
        "citation_coverage",
        "source_validity",
        "source_authority",
        "version_validity",
        "permission_validity",
        "evidence_completeness",
        "conflict_detection",
        "calculation_validity",
        "human_review_requirement",
    }
    assert result["checks"]["calculation_validity"] == {
        "passed": None,
        "applicable": False,
        "details": "Not applicable: this context involves no calculation.",
    }
    stored = db.get(GuardEvaluation, result["id"])
    assert stored.run_id == answer["id"] and stored.status == status
    reopened = client.get(f"/api/ask/{answer['id']}", headers=employee).json()
    assert reopened["reliability"] == result
    assert client.get(f"/api/ask/{answer['id']}/reliability", headers=employee).json() == result
    assert db.scalar(select(func.count()).select_from(GuardEvaluation)) == 1
    audit = client.get("/api/audit", headers=employee, params={"run_id": answer["id"]}).json()
    assert {
        "question_submitted",
        "retrieval_completed",
        "answer_generated",
        "guard_evaluated",
        "result_returned",
    } <= {item["event_type"] for item in audit}
    assert all(
        item["actor_id"] == "employee" and item["entity_id"] == answer["id"] for item in audit
    )


def test_missing_evidence_is_explicit_and_unsafe_conclusion_removed(client):
    result = ask(
        client, "Can I reimburse an expense without a receipt?", document_ids=["expense-sop"]
    )
    missing = [item for item in result["reliability"]["evidence"] if item["status"] == "missing"]
    assert missing[0]["required"] and missing[0]["label"] == "Receipt exception authority"
    assert result["reliability"]["checks"]["evidence_completeness"]["passed"] is False
    assert "safe conclusion" in result["answer"]
    assert "[1]" not in result["answer"]


def test_conflicting_sources_both_visible_and_not_resolved(client):
    result = ask(client, "How often are access rights reviewed?")
    ids = {source["document_id"] for source in result["sources"]}
    assert {"access-sop", "access-review-policy"} <= ids
    assert "12 months" in result["answer"] and "6 months" in result["answer"]
    assert "not a resolved conclusion" in result["answer"]
    assert result["reliability"]["checks"]["conflict_detection"]["passed"] is False
    conflicting = [
        item for item in result["reliability"]["evidence"] if item["status"] == "conflicting"
    ]
    assert len(conflicting[0]["source_refs"]) == 2


def test_filter_cannot_silently_resolve_conflict(client):
    result = ask(client, "access review interval", document_ids=["access-sop"])
    assert result["reliability"]["status"] == "BLOCKED"
    assert "Access review control policy" in " ".join(result["reliability"]["reasons"])


def test_outdated_replacement_is_real_active_version(client, db):
    result = ask(client, "annual leave days", document_ids=["leave-policy"], include_outdated=True)
    replacement = result["reliability"]["active_replacements"][0]
    version = db.get(DocumentVersion, replacement["version_id"])
    assert version.status == "active" and replacement["version"] == "2.0"
    assert "current authority" in result["answer"]


@pytest.mark.parametrize(
    "tamper", ["missing_marker", "fabricated_claim", "wrong_excerpt", "wrong_relationship"]
)
def test_citation_coverage_and_source_integrity(db, tamper):
    value = guard_input(db)
    sources = [dict(source) for source in value.sources]
    answer = value.answer
    if tamper == "missing_marker":
        answer = answer.replace("[1]", "")
    elif tamper == "fabricated_claim":
        answer += "\n\nEmployees receive 99 days of leave."
    elif tamper == "wrong_excerpt":
        sources[0]["excerpt"] = "Employees receive 99 days of leave."
        answer = ExtractiveDemoProvider().answer(value.query.question, sources)
    else:
        sources[0]["document_id"] = "expense-sop"
    result = SuperFlowGuard().evaluate(
        db,
        GuardInput(
            user=value.user,
            query=value.query,
            sources=sources,
            answer=answer,
        ),
    )
    assert result.status == ReliabilityStatus.BLOCKED
    if tamper in {"missing_marker", "fabricated_claim"}:
        assert result.checks["citation_coverage"].passed is False
    else:
        assert result.checks["source_validity"].passed is False


def test_draft_cannot_be_verified(db):
    value = guard_input(db)
    value.sources[0]["status"] = "draft"
    result = SuperFlowGuard().evaluate(db, value)
    assert result.status == ReliabilityStatus.BLOCKED
    assert result.checks["version_validity"].passed is False


def test_permission_before_retrieval_and_citation_content_read(db):
    statements = []

    def capture(_, __, statement, parameters, ___, ____):
        statements.append((statement, str(parameters)))

    event.listen(db.bind, "before_cursor_execute", capture)
    try:
        user = db.get(User, "employee")
        hits = KeywordConceptRetriever().retrieve(
            db,
            user,
            AskInput(question="Proposal A initial investment", document_ids=["proposal-a"]),
        )
        assert hits == []
        assert not any("document_chunks" in sql for sql, _ in statements)
        version = db.scalar(
            select(DocumentVersion).where(DocumentVersion.document_id == "proposal-a")
        )
        chunk_id = db.scalar(select(DocumentChunk.id).where(DocumentChunk.version_id == version.id))
        statements.clear()
        with pytest.raises(Exception) as error:
            citation_payload(db, user, chunk_id, 1)
        assert error.value.status_code == 404
        assert not any("document_chunks.text" in sql for sql, _ in statements)
    finally:
        event.remove(db.bind, "before_cursor_execute", capture)


def test_restricted_state_never_exposes_source_metadata_or_content(client, employee, db):
    result = ask(client, "investment approval authority")
    assert result["sources"] == []
    guard = result["reliability"]
    assert guard["source_refs"] == [] and guard["evidence"] == []
    for secret in ["Investment Approval Authority", "approval-policy", "committee", "180,000,000"]:
        assert secret not in json.dumps(result)
    assert "inspect_sources" not in guard["allowed_actions"]
    result_unknown = ask(client, "quasar neutrino spectrum", document_ids=["unknown"])
    assert result_unknown["reliability"]["status"] == "BLOCKED"
    assert (
        client.get(f"/api/ask/{result['id']}", headers={"X-User-Id": "finance"}).status_code == 404
    )


def test_saved_guard_rechecks_version_authority_and_permission(client, employee, db):
    result = ask(client, "annual leave days", document_ids=["leave-policy"])
    route = f"/api/ask/{result['id']}"
    document = db.get(Document, "leave-policy")
    document.authority_level = 2
    db.commit()
    reviewed = client.get(route, headers=employee).json()
    assert reviewed["reliability"]["status"] == "REVIEW_REQUIRED"
    assert reviewed["reliability"]["id"] != result["reliability"]["id"]
    document.authority_level = 5
    for version in document.versions:
        version.status = "outdated"
    db.commit()
    assert client.get(route, headers=employee).json()["reliability"]["status"] == "OUTDATED"
    document.access_roles = ["governance"]
    db.commit()
    denied = client.get(route, headers=employee)
    assert denied.status_code == 403 and "15 days" not in denied.text
    assert client.get(route + "/reliability", headers=employee).status_code == 403
    assert client.get(route + "/sources", headers=employee).status_code == 403
    version_id = result["sources"][0]["version_id"]
    assert (
        client.get(
            f"/api/documents/leave-policy/versions/{version_id}/file", headers=employee
        ).status_code
        == 404
    )
    assert result["id"] not in {
        item["id"] for item in client.get("/api/ask", headers=employee).json()
    }
    assert "leave-policy" not in json.dumps(client.get("/api/audit", headers=employee).json())


def test_audit_append_only_and_owner_scoped(client, db, employee):
    result = ask(client, "annual leave days")
    audit = db.scalar(select(AuditEvent).where(AuditEvent.entity_id == result["id"]))
    assert client.get("/api/audit", headers={"X-User-Id": "finance"}).json() == []
    assert client.patch("/api/audit/" + audit.id, headers=employee, json={}).status_code == 404
    with pytest.raises(ValueError, match="append-only"):
        with db.begin_nested():
            audit.event_type = "tampered"
            db.flush()
    if db.bind.dialect.name == "postgresql":
        for command in [
            "UPDATE audit_events SET event_type='tampered'",
            "DELETE FROM audit_events",
            "TRUNCATE audit_events",
        ]:
            with pytest.raises(DBAPIError, match="append-only"):
                with db.begin_nested():
                    db.execute(text(command))
    assert db.scalar(select(func.count()).select_from(AuditEvent)) >= 5


def test_guard_reset_is_repeatable(client, db):
    ask(client, "access review interval")
    assert reset_synthetic(db) == 13
    assert db.scalar(select(func.count()).select_from(GuardEvaluation)) == 0
    assert db.scalar(select(func.count()).select_from(AuditEvent)) == 0
    assert ask(client, "access review interval")["reliability"]["status"] == "REVIEW_REQUIRED"


def test_required_evidence_can_be_satisfied_by_real_upload(client, admin):
    response = client.post(
        "/api/documents",
        headers=admin,
        data={
            "metadata": json.dumps(
                {
                    "title": "Receipt Exception Authority Policy",
                    "domain": "Operations",
                    "owner_id": "sme",
                    "authority_level": 5,
                    "access_roles": ["employee", "sme", "governance"],
                }
            ),
            "effective_date": "2026-01-01",
        },
        files={
            "file": (
                "receipt.md",
                b"# Receipt exception\nA lost receipt requires a replacement receipt "
                b"before reimbursement; no exception is authorized.",
            )
        },
    )
    assert response.status_code == 201
    result = ask(client, "expense without receipt", document_ids=[response.json()["id"]])
    assert result["reliability"]["status"] == "VERIFIED"
    required = [item for item in result["reliability"]["evidence"] if item["required"]]
    assert required[0]["status"] == "available" and required[0]["source_refs"]


def test_actions_remain_blocked_and_finance_check_is_not_faked(db):
    value = guard_input(db, action="approve")
    result = SuperFlowGuard().evaluate(db, value)
    assert result.status == ReliabilityStatus.BLOCKED
    assert result.checks["calculation_validity"].passed is None
    assert result.checks["human_review_requirement"].passed is False
    assert "approve" not in result.allowed_actions


def test_old_phase1_saved_answer_gets_guard_on_first_read(client, db, employee):
    value = guard_input(db)
    run = QuestionRun(
        user_id="employee",
        question=value.query.question,
        answer=value.answer,
        outcome="source_grounded",
        filters=value.query.model_dump(exclude={"question"}),
        source_refs=[{"chunk_id": s["chunk_id"], "score": 0} for s in value.sources],
        provider="deterministic-extractive-v1",
    )
    db.add(run)
    db.commit()
    assert db.scalar(select(func.count()).select_from(GuardEvaluation)) == 0
    result = client.get(f"/api/ask/{run.id}", headers=employee).json()
    assert result["reliability"]["status"] == "VERIFIED"
    assert db.scalar(select(func.count()).select_from(GuardEvaluation)) == 1


def test_unsupported_provider_output_fails_closed(client, monkeypatch):
    import superflow.main as main

    class UnsupportedProvider:
        name = "unsupported-test"

        def answer(self, question, sources):
            return "Employees receive 99 days of leave without evidence."

    monkeypatch.setattr(main, "provider", UnsupportedProvider())
    result = ask(client, "annual leave days", document_ids=["leave-policy"])
    assert result["reliability"]["status"] == "BLOCKED"
    assert "99 days" not in result["answer"]


def test_guard_does_not_read_or_emit_denied_source_content(db):
    value = guard_input(db)
    db.get(Document, "leave-policy").access_roles = ["governance"]
    db.flush()
    result = SuperFlowGuard().evaluate(db, value)
    assert result.status == ReliabilityStatus.ACCESS_RESTRICTED
    assert result.source_refs == [] and result.evidence == []
    assert "15 days" not in result.model_dump_json()
