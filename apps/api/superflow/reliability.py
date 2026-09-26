import hashlib
import json
from datetime import timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import record
from .guard import GuardInput, SuperFlowGuard, restricted_relevance
from .models import GuardEvaluation, QuestionRun, User
from .reliability_contracts import EvidenceItem, GuardResult, ReliabilityStatus
from .schemas import AskInput

guard = SuperFlowGuard()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def evaluate_run(
    db: Session,
    user: User,
    run: QuestionRun,
    sources: list[dict],
    evidence: tuple[EvidenceItem, ...] = (),
) -> GuardResult:
    query = AskInput(question=run.question, **run.filters)
    result = guard.evaluate(
        db,
        GuardInput(
            user=user,
            query=query,
            sources=sources,
            answer=run.answer,
            restricted_match=restricted_relevance(db, user, query),
            evidence=evidence,
        ),
    )
    payload = result.model_dump(mode="json", exclude={"id", "evaluated_at"})
    fingerprint = digest(json.dumps(payload, sort_keys=True))
    previous = db.scalar(
        select(GuardEvaluation)
        .where(GuardEvaluation.run_id == run.id)
        .order_by(GuardEvaluation.created_at.desc(), GuardEvaluation.id.desc())
    )
    if previous is None or previous.fingerprint != fingerprint:
        evaluation = GuardEvaluation(
            run_id=run.id, status=result.status.value, result=payload, fingerprint=fingerprint
        )
        db.add(evaluation)
        db.flush()
        audit_payload = {
            "guard_id": evaluation.id,
            "guard_status": result.status.value,
            "source_refs": [ref.model_dump() for ref in result.source_refs],
            "policy_version": result.policy_version,
            "reevaluated": previous is not None,
        }
        record(db, user, run.id, "guard_evaluated", **audit_payload)
        special = {
            ReliabilityStatus.OUTDATED: "outdated_source_detected",
            ReliabilityStatus.ACCESS_RESTRICTED: "source_blocked_by_permission",
        }.get(result.status)
        if special:
            record(db, user, run.id, special, **audit_payload)
        if result.checks["conflict_detection"].passed is False:
            record(db, user, run.id, "conflict_detected", **audit_payload)
    else:
        evaluation = previous
    return result.model_copy(
        update={
            "id": evaluation.id,
            "evaluated_at": (
                evaluation.created_at.astimezone(timezone.utc)
                if evaluation.created_at.tzinfo
                else evaluation.created_at.replace(tzinfo=timezone.utc)
            ),
        }
    )


def presented_answer(run: QuestionRun, result: GuardResult) -> str:
    if result.status == ReliabilityStatus.ACCESS_RESTRICTED:
        return result.summary + " " + result.next_step
    if result.status == ReliabilityStatus.BLOCKED:
        return "I could not find supporting evidence sufficient for a safe conclusion. " + " ".join(
            result.reasons
        )
    if result.status == ReliabilityStatus.REVIEW_REQUIRED:
        return (
            "Human review is required; the following extracts are evidence, "
            "not a resolved conclusion.\n\n" + run.answer
        )
    if result.status == ReliabilityStatus.OUTDATED:
        return "Historical extracts are not current authority.\n\n" + run.answer
    return run.answer
