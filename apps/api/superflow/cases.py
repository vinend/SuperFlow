"""Case authorization and shared knowledge context; Guard remains the evaluator."""

import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import record
from .auth import can_read
from .knowledge import citation_payload
from .models import (
    ActionReceipt,
    Approval,
    AuditEvent,
    Case,
    CaseEvidence,
    Document,
    DocumentChunk,
    DocumentVersion,
    Investigation,
    InvestmentAnalysis,
    QuestionRun,
    RegulatoryReview,
    User,
    WorkflowRun,
    now,
)
from .providers import ExtractiveDemoProvider
from .reliability import digest, evaluate_run
from .reliability_contracts import EvidenceItem, ReliabilityStatus
from .workflow_contracts import CaseCreate, CaseStatus, Mutation

# Domain services register how to resolve calculation inputs for their Case type, so
# every Guard evaluation of that Case (views, workflow steps, decisions) includes them.
CALCULATION_INPUTS = {}


def log(db, user, case, event_type, **payload):
    record(db, user, case.id, event_type, entity_type="case", **payload)


def references_allowed(db: Session, user: User, run: QuestionRun) -> bool:
    # Read IDs only before any chunk text or cached answer is accessed.
    for ref in run.source_refs:
        document_id = db.scalar(
            select(DocumentVersion.document_id)
            .join(DocumentChunk, DocumentChunk.version_id == DocumentVersion.id)
            .where(DocumentChunk.id == ref["chunk_id"])
        )
        doc = db.get(Document, document_id) if document_id else None
        if not doc or not can_read(user, doc):
            return False
    return True


def can_access_case(db, user, case):
    if case.type == "aml_investigation" and user.role_id != "compliance":
        return False
    participant = (
        user.role_id == "governance" and case.type != "aml_investigation"
    ) or user.id in {case.owner_id, case.created_by}
    if not participant:
        participant = (
            db.scalar(
                select(Approval.id).where(
                    Approval.case_id == case.id, Approval.requested_from == user.id
                )
            )
            is not None
        )
    run = db.get(QuestionRun, case.context_run_id)
    return participant and run is not None and references_allowed(db, user, run)


def get_case(db, user, case_id, *, lock=False):
    statement = select(Case).where(Case.id == case_id)
    if lock:
        statement = statement.with_for_update().execution_options(populate_existing=True)
    case = db.scalar(statement)
    if lock and case:
        run = db.get(QuestionRun, case.context_run_id)
        source_ids = list(
            db.scalars(
                select(DocumentVersion.document_id)
                .join(DocumentChunk, DocumentChunk.version_id == DocumentVersion.id)
                .where(DocumentChunk.id.in_([ref["chunk_id"] for ref in run.source_refs]))
            )
        )
        # Source metadata changes serialize with execution. Never lock/read source text
        # before authorization; the document lock contains metadata only.
        if source_ids:
            list(
                db.scalars(
                    select(Document)
                    .where(Document.id.in_(source_ids))
                    .order_by(Document.id)
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
            )
    if not case or not can_access_case(db, user, case):
        raise HTTPException(404, "Case not found or its context is unavailable to your role.")
    return case


def require_edit(user, case):
    if case.type == "aml_investigation" and (
        user.role_id != "compliance" or user.id not in {case.owner_id, case.created_by}
    ):
        raise HTTPException(
            403, "Only the assigned Compliance analyst may change this investigation."
        )
    if user.id not in {case.owner_id, case.created_by} and user.role_id != "governance":
        raise HTTPException(
            403, "Only the case owner, requester, or Governance may change execution."
        )


def begin_mutation(db, user, case, value: Mutation, action: str) -> bool:
    fingerprint = digest(
        action
        + json.dumps(value.model_dump(mode="json", exclude={"idempotency_key"}), sort_keys=True)
    )
    if value.idempotency_key:
        existing = db.scalar(
            select(ActionReceipt).where(
                ActionReceipt.case_id == case.id,
                ActionReceipt.actor_id == user.id,
                ActionReceipt.key == value.idempotency_key,
            )
        )
        if existing:
            if existing.fingerprint != fingerprint:
                raise HTTPException(409, "Idempotency key already belongs to a different request.")
            return False
    if case.revision != value.expected_revision:
        raise HTTPException(409, "Case changed. Refresh before submitting this action.")
    if case.status in {CaseStatus.COMPLETED, CaseStatus.CANCELLED}:
        raise HTTPException(409, "Case execution is already closed.")
    if value.idempotency_key:
        db.add(
            ActionReceipt(
                case_id=case.id,
                actor_id=user.id,
                key=value.idempotency_key,
                fingerprint=fingerprint,
            )
        )
    case.revision += 1
    case.updated_at = now()
    return True


def context(db, user, case):
    if case.type == "aml_investigation":
        from .investigations import evaluate_investigation_case

        return evaluate_investigation_case(db, user, case), []
    run = db.get(QuestionRun, case.context_run_id)
    if not references_allowed(db, user, run):
        raise HTTPException(404, "Case source context is unavailable to your role.")
    sources = [
        citation_payload(db, user, ref["chunk_id"], i, ref.get("score", 0))
        for i, ref in enumerate(run.source_refs, 1)
    ]
    evidence = tuple(
        EvidenceItem.model_validate(row.item)
        for row in db.scalars(select(CaseEvidence).where(CaseEvidence.case_id == case.id))
    )
    resolver = CALCULATION_INPUTS.get(case.type)
    calculation = resolver(db, case) if resolver else None
    result = evaluate_run(db, user, run, sources, evidence, calculation)
    if case.guard_id != result.id:
        log(
            db,
            user,
            case,
            "guard_evaluated",
            context_run_id=run.id,
            guard_id=result.id,
            guard_status=result.status.value,
            source_refs=[ref.model_dump() for ref in result.source_refs],
        )
    # Reliability is re-evaluated for the actor, never taken from a frontend badge.
    case.reliability_status, case.guard_id = result.status.value, result.id
    return result, sources


def domain_kind(db, case) -> str | None:
    """Domain workspaces own how their Case starts; the generic workflow start is refused."""
    if db.get(RegulatoryReview, case.id) is not None:
        return "regulatory"
    if db.get(InvestmentAnalysis, case.id) is not None:
        return "investment"
    if db.get(Investigation, case.id) is not None:
        return "investigation"
    return None


def new_case(db, user, value: CaseCreate, *, may_assign=False):
    if value.type == "aml_investigation" and (user.role_id != "compliance" or not may_assign):
        raise HTTPException(403, "Create investigations through the Compliance workspace.")
    # may_assign: a domain service (e.g. Compliance assigning remediation) has already
    # checked assignment authority; owner source access is still enforced below.
    owner = db.get(User, value.owner_id or user.id)
    if not owner or not owner.active:
        raise HTTPException(422, "Case owner is unavailable.")
    if owner.id != user.id and not may_assign and user.role_id not in {"manager", "governance"}:
        raise HTTPException(403, "Only Manager or Governance may assign another case owner.")
    origin = db.get(QuestionRun, value.question_run_id) if value.question_run_id else None
    if value.question_run_id and (not origin or origin.user_id != user.id):
        raise HTTPException(404, "Question not found.")
    if origin and not references_allowed(db, user, origin):
        raise HTTPException(403, "Saved answer context is no longer authorized.")
    refs = list(origin.source_refs) if origin else []
    for chunk_id in dict.fromkeys(value.chunk_ids):
        citation_payload(db, user, chunk_id, 1)
        if not any(ref["chunk_id"] == chunk_id for ref in refs):
            refs.append({"chunk_id": chunk_id, "score": 0})
    run = QuestionRun(
        user_id=user.id,
        question=origin.question if origin else value.title,
        answer=origin.answer if origin and not value.chunk_ids else "",
        outcome="source_grounded" if refs else "no_sources",
        filters=origin.filters
        if origin
        else {"domain": None, "document_ids": [], "include_outdated": False},
        source_refs=refs,
        provider=ExtractiveDemoProvider.name,
    )
    if not references_allowed(db, owner, run):
        raise HTTPException(403, "The selected owner cannot access this source context.")
    sources = [
        citation_payload(db, user, ref["chunk_id"], i, ref.get("score", 0))
        for i, ref in enumerate(refs, 1)
    ]
    if not origin or value.chunk_ids:
        run.answer = ExtractiveDemoProvider().answer(run.question, sources)
    db.add(run)
    db.flush()
    result = evaluate_run(db, user, run, sources)
    if result.status == ReliabilityStatus.ACCESS_RESTRICTED:
        raise HTTPException(403, "Restricted knowledge cannot be carried into a case.")
    if origin and result.status == ReliabilityStatus.BLOCKED and not value.allow_recovery:
        raise HTTPException(
            409, "Explicit evidence-recovery consent is required for a blocked answer."
        )
    case = Case(
        type=value.type,
        title=value.title,
        description=value.description,
        owner_id=owner.id,
        created_by=user.id,
        question_run_id=value.question_run_id,
        context_run_id=run.id,
        reliability_status=result.status.value,
        guard_id=result.id,
    )
    db.add(case)
    db.flush()
    log(
        db,
        user,
        case,
        "case_created",
        question_run_id=value.question_run_id,
        context_run_id=run.id,
        guard_id=result.id,
        guard_status=result.status.value,
        source_refs=[ref.model_dump() for ref in result.source_refs],
    )
    return case


def add_evidence(db, user, case, value):
    require_edit(user, case)
    result, _ = context(db, user, case)
    run = db.get(QuestionRun, case.context_run_id)
    additions = [
        citation_payload(db, user, chunk_id, 1) for chunk_id in dict.fromkeys(value.chunk_ids)
    ]
    for principal_id in {case.owner_id, case.created_by}:
        principal = db.get(User, principal_id)
        if any(not can_read(principal, db.get(Document, s["document_id"])) for s in additions):
            raise HTTPException(403, "Case participants must be authorized for attached evidence.")
    # An explicit current replacement removes historical references for that document.
    replacing = {s["document_id"] for s in additions if s["status"] == "active"}
    refs = []
    for ref in run.source_refs:
        s = citation_payload(db, user, ref["chunk_id"], 1)
        if s["status"] == "outdated" and s["document_id"] in replacing:
            continue
        refs.append(ref)
    for s in additions:
        if not any(r["chunk_id"] == s["chunk_id"] for r in refs):
            refs.append({"chunk_id": s["chunk_id"], "score": 0})
    if len(refs) > 30:
        raise HTTPException(422, "Case context is limited to 30 evidence sections.")
    run.source_refs = refs
    sources = [
        citation_payload(db, user, ref["chunk_id"], i, ref.get("score", 0))
        for i, ref in enumerate(refs, 1)
    ]
    if value.requirement_key:
        row = db.scalar(
            select(CaseEvidence).where(
                CaseEvidence.case_id == case.id, CaseEvidence.key == value.requirement_key
            )
        )
        if not row:
            raise HTTPException(422, "Evidence requirement not found.")
        item = EvidenceItem.model_validate(row.item)
        if any(s["status"] != "active" or s["authority_level"] < 4 for s in additions):
            raise HTTPException(422, "Required evidence must reference current approved knowledge.")
        from .guard import reference

        item.source_refs = [reference(s) for s in sources if s["chunk_id"] in value.chunk_ids]
        item.status = "available"
        row.item = item.model_dump(mode="json")
    run.answer = ExtractiveDemoProvider().answer(run.question, sources)
    run.outcome = "source_grounded"
    run.filters = {
        **run.filters,
        "document_ids": [],
        "include_outdated": any(s["status"] == "outdated" for s in sources),
    }
    log(
        db,
        user,
        case,
        "evidence_added",
        requirement_key=value.requirement_key,
        source_refs=[
            {k: s[k] for k in ["document_id", "version_id", "chunk_id"]} for s in additions
        ],
    )
    log(db, user, case, "answer_generated", context_run_id=run.id, answer_digest=digest(run.answer))
    context(db, user, case)


def summary(db, case):
    workflow = db.scalar(select(WorkflowRun).where(WorkflowRun.case_id == case.id))
    return {
        key: getattr(case, key)
        for key in [
            "id",
            "type",
            "title",
            "description",
            "status",
            "owner_id",
            "created_by",
            "revision",
            "question_run_id",
            "reliability_status",
            "created_at",
            "updated_at",
        ]
    } | {"workflow_run_id": workflow.id if workflow else None}


def activity(db, case):
    return [
        {
            "id": e.id,
            "actor_id": e.actor_id,
            "event_type": e.event_type,
            "payload": e.payload,
            "created_at": e.created_at,
        }
        for e in db.scalars(
            select(AuditEvent)
            .where(AuditEvent.entity_type == "case", AuditEvent.entity_id == case.id)
            .order_by(AuditEvent.created_at, AuditEvent.id)
        )
    ]
