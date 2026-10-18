"""Transactional persistent state machine. Callers hold the case row lock."""

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select

from .cases import context, log, references_allowed
from .config import settings
from .models import (
    Approval,
    CaseEvidence,
    QuestionRun,
    StepAttempt,
    Task,
    User,
    UserCredential,
    WorkflowRun,
    WorkflowStep,
    now,
)
from .reliability_contracts import EvidenceItem, ReliabilityStatus
from .workflow_contracts import (
    ApprovalStatus as AS,
)
from .workflow_contracts import (
    CaseStatus as CS,
)
from .workflow_contracts import (
    DefinitionConfig,
)
from .workflow_contracts import (
    StepStatus as SS,
)
from .workflow_contracts import (
    StepType as ST,
)
from .workflow_contracts import (
    TaskStatus as TS,
)
from .workflow_contracts import (
    WorkflowStatus as WS,
)


def config(run):
    return DefinitionConfig.model_validate(run.config)


def step_config(run, key=None):
    return next(step for step in config(run).steps if step.id == (key or run.current_step))


def step_row(db, run):
    return db.scalar(
        select(WorkflowStep).where(
            WorkflowStep.workflow_run_id == run.id, WorkflowStep.key == run.current_step
        )
    )


def select_reviewer(db, case, role):
    run = db.get(QuestionRun, case.context_run_id)
    roles = (
        ["compliance"]
        if case.type == "aml_investigation"
        else list(dict.fromkeys([role, "governance"]))
    )
    for requested_role in roles:
        for candidate in db.scalars(
            select(User)
            .where(User.role_id == requested_role, User.active.is_(True))
            .order_by(User.id)
        ):
            if settings.auth_mode == "password" and not db.get(UserCredential, candidate.id):
                continue
            if candidate.id not in {case.created_by, case.owner_id} and references_allowed(
                db, candidate, run
            ):
                return candidate
    raise HTTPException(409, "No independent authorized reviewer is available. Reassign the case.")


def request_approval(db, user, case, run, step, role, reason):
    existing = db.scalar(
        select(Approval).where(Approval.step_id == step.id, Approval.status == AS.PENDING)
    )
    if existing:
        return existing
    reviewer = select_reviewer(db, case, role)
    approval = Approval(
        case_id=case.id,
        workflow_run_id=run.id,
        step_id=step.id,
        requested_from=reviewer.id,
        requested_role=reviewer.role_id,
        requested_by=user.id,
        reason_required=reason,
    )
    db.add(approval)
    db.flush()
    step.owner_id = reviewer.id
    log(
        db,
        user,
        case,
        "approval_requested",
        approval_id=approval.id,
        workflow_run_id=run.id,
        step_id=step.id,
        requested_from=reviewer.id,
        guard_id=case.guard_id,
        guard_status=case.reliability_status,
    )
    return approval


def attempt(db, user, case, step, outcome, reason):
    db.flush()
    count = len(list(db.scalars(select(StepAttempt.id).where(StepAttempt.step_id == step.id))))
    db.add(
        StepAttempt(
            step_id=step.id,
            number=count + 1,
            outcome=outcome,
            reason=reason,
            actor_id=user.id,
            guard_id=case.guard_id,
        )
    )


def finish_step(db, user, case, run, step):
    step.status, step.completed_at = SS.COMPLETED, now()
    log(
        db,
        user,
        case,
        "workflow_advanced",
        workflow_run_id=run.id,
        step_id=step.id,
        step_key=step.key,
        guard_id=case.guard_id,
        guard_status=case.reliability_status,
    )


def enter(db, user, case, run, key):
    run.current_step = key
    step = step_row(db, run)
    cfg = step_config(run)
    step.status, step.started_at = SS.ACTIVE, step.started_at or now()
    run.status, case.status = WS.RUNNING, CS.IN_PROGRESS
    if cfg.type == ST.TASK:
        task = db.scalar(select(Task).where(Task.step_id == step.id))
        if task is None:
            task = Task(
                workflow_run_id=run.id,
                step_id=step.id,
                title=step.title,
                description="Inspect the supporting sources and attach any required evidence.",
                owner_id=case.owner_id,
                due_at=now() + timedelta(days=2),
            )
            db.add(task)
            db.flush()
            log(
                db,
                user,
                case,
                "task_created",
                task_id=task.id,
                workflow_run_id=run.id,
                owner_id=task.owner_id,
            )
        step.owner_id = task.owner_id
    elif cfg.type == ST.GUARD:
        evaluate_step(db, user, case, run)
    elif cfg.type == ST.CONDITION:
        guard, _ = context(db, user, case)
        destination = (
            cfg.review_next if guard.status == ReliabilityStatus.REVIEW_REQUIRED else cfg.next
        )
        finish_step(db, user, case, run, step)
        enter(db, user, case, run, destination)
    elif cfg.type == ST.APPROVAL:
        guard, _ = context(db, user, case)
        role = cfg.reviewer_role
        # Type-based routing belongs to the generic review; domain definitions name the role.
        if role == "manager" and run.definition_id == "generic-review-v1":
            role = {"investment": "finance", "regulatory_review": "compliance", "audit": "sme"}.get(
                case.type, role
            )
        request_approval(db, user, case, run, step, role, guard.summary)
        step.status, run.status, case.status = (
            SS.WAITING,
            WS.WAITING_FOR_APPROVAL,
            CS.WAITING_FOR_REVIEW,
        )
    elif cfg.type == ST.TERMINAL:
        finish_step(db, user, case, run, step)
        for pending in db.scalars(
            select(WorkflowStep).where(
                WorkflowStep.workflow_run_id == run.id, WorkflowStep.status == SS.PENDING
            )
        ):
            pending.status = SS.SKIPPED
        run.status, run.completed_at, case.status = WS.COMPLETED, now(), CS.COMPLETED
        log(db, user, case, "workflow_completed", workflow_run_id=run.id)


def evaluate_step(db, user, case, run):
    step = step_row(db, run)
    cfg = step_config(run)
    guard, _ = context(db, user, case)
    failed = guard.checks["citation_coverage"].passed is False and bool(guard.source_refs)
    failed |= guard.checks["source_validity"].passed is False and bool(guard.source_refs)
    if failed:
        step.status, run.status = SS.FAILED, WS.FAILED
        attempt(db, user, case, step, SS.FAILED, guard.summary)
        log(
            db,
            user,
            case,
            "step_failed",
            workflow_run_id=run.id,
            step_id=step.id,
            guard_id=guard.id,
            guard_status=guard.status.value,
            retry_count=step.retry_count,
        )
        if cfg.fallback and step.retry_count >= cfg.max_retries:
            log(
                db,
                user,
                case,
                "fallback_triggered",
                workflow_run_id=run.id,
                step_id=step.id,
                destination=cfg.fallback,
            )
            enter(db, user, case, run, cfg.fallback)
        return
    if guard.status in {
        ReliabilityStatus.BLOCKED,
        ReliabilityStatus.OUTDATED,
        ReliabilityStatus.ACCESS_RESTRICTED,
    }:
        step.status, run.status, case.status = (
            SS.WAITING,
            WS.WAITING_FOR_EVIDENCE,
            CS.WAITING_FOR_EVIDENCE,
        )
        attempt(db, user, case, step, SS.WAITING, guard.summary)
        request_approval(
            db,
            user,
            case,
            run,
            step,
            "manager",
            "Supporting evidence must be repaired before continuation. " + guard.summary,
        )
        return
    attempt(db, user, case, step, SS.COMPLETED, guard.summary)
    # Any recovery review request is now obsolete, preserved rather than deleted.
    for approval in db.scalars(
        select(Approval).where(Approval.step_id == step.id, Approval.status == AS.PENDING)
    ):
        approval.status, approval.decided_at = AS.EVIDENCE_REQUESTED, now()
        approval.decision_reason = "Evidence supplied; a new material decision will be requested."
        log(db, user, case, "approval_superseded", approval_id=approval.id)
    finish_step(db, user, case, run, step)
    enter(db, user, case, run, cfg.next)


def start_workflow(db, user, case, definition):
    if db.scalar(select(WorkflowRun).where(WorkflowRun.case_id == case.id)):
        raise HTTPException(409, "A workflow already exists for this case.")
    validated = DefinitionConfig.model_validate(definition.config)
    run = WorkflowRun(
        case_id=case.id,
        definition_id=definition.id,
        config=validated.model_dump(mode="json"),
        current_step=validated.steps[0].id,
    )
    db.add(run)
    db.flush()
    for cfg in validated.steps:
        db.add(WorkflowStep(workflow_run_id=run.id, key=cfg.id, title=cfg.title, type=cfg.type))
    db.flush()
    log(
        db,
        user,
        case,
        "workflow_started",
        workflow_run_id=run.id,
        definition_id=definition.id,
        definition_version=definition.version,
    )
    enter(db, user, case, run, run.current_step)
    return run


def advance(db, user, case, run):
    if run.status in {WS.COMPLETED, WS.CANCELLED}:
        raise HTTPException(409, "Workflow is already closed.")
    cfg, step = step_config(run), step_row(db, run)
    if cfg.type == ST.GUARD and run.status == WS.WAITING_FOR_EVIDENCE:
        evaluate_step(db, user, case, run)
    elif cfg.type == ST.TASK:
        task = db.scalar(select(Task).where(Task.step_id == step.id))
        if task.status != TS.DONE:
            raise HTTPException(409, "Complete the assigned task before advancing.")
        finish_step(db, user, case, run, step)
        enter(db, user, case, run, cfg.next)
    else:
        raise HTTPException(409, "This step requires a task, retry, evidence, or human decision.")


def retry(db, user, case, run):
    cfg, step = step_config(run), step_row(db, run)
    if cfg.type != ST.GUARD or step.status != SS.FAILED or step.retry_count >= cfg.max_retries:
        raise HTTPException(409, "This step is not retryable or its retry limit has been reached.")
    step.retry_count += 1
    log(
        db,
        user,
        case,
        "retry_requested",
        workflow_run_id=run.id,
        step_id=step.id,
        retry_count=step.retry_count,
    )
    evaluate_step(db, user, case, run)


def cancel(db, user, case):
    case.status = CS.CANCELLED
    run = db.scalar(select(WorkflowRun).where(WorkflowRun.case_id == case.id))
    if run:
        run.status, run.completed_at = WS.CANCELLED, now()
        for step in db.scalars(select(WorkflowStep).where(WorkflowStep.workflow_run_id == run.id)):
            if step.status not in {SS.COMPLETED, SS.SKIPPED}:
                step.status = SS.CANCELLED
        for task in db.scalars(select(Task).where(Task.workflow_run_id == run.id)):
            if task.status != TS.DONE:
                task.status = TS.CANCELLED
        for approval in db.scalars(
            select(Approval).where(
                Approval.workflow_run_id == run.id, Approval.status == AS.PENDING
            )
        ):
            approval.status, approval.decided_at = AS.REJECTED, now()
            approval.decision_reason, approval.decided_by = "Case cancelled.", user.id
    log(db, user, case, "case_cancelled", workflow_run_id=run.id if run else None)


def decision_allowed(user, case, approval):
    if case.type == "aml_investigation":
        return (
            user.role_id == "compliance"
            and user.id == approval.requested_from
            and user.id not in {case.created_by, case.owner_id}
        )
    return (
        (user.id == approval.requested_from or user.role_id == "governance")
        and user.id not in {case.created_by, case.owner_id}
        and user.role_id != "employee"
    )


def escalate(db, user, case, run, reason, approval=None):
    if case.type == "aml_investigation":
        raise HTTPException(
            409, "Escalation requires an assigned independent Compliance authority."
        )
    if not reason.strip():
        raise HTTPException(422, "Escalation requires a reason.")
    if run.status in {WS.COMPLETED, WS.CANCELLED}:
        raise HTTPException(409, "Closed workflows cannot be escalated.")
    reviewer = select_reviewer(db, case, "governance")
    if approval and approval.requested_role == "governance":
        raise HTTPException(409, "No higher demo authority is available.")
    if run.status == WS.ESCALATED:
        raise HTTPException(409, "Workflow is already escalated.")
    step = step_row(db, run)
    for pending in db.scalars(
        select(Approval).where(Approval.workflow_run_id == run.id, Approval.status == AS.PENDING)
    ):
        pending.status, pending.decision_reason, pending.decided_by, pending.decided_at = (
            AS.ESCALATED,
            reason,
            user.id,
            now(),
        )
    run.status, run.escalation_reason, run.escalated_by, run.escalated_at = (
        WS.ESCALATED,
        reason,
        user.id,
        now(),
    )
    case.status = CS.WAITING_FOR_REVIEW
    request_approval(db, user, case, run, step, reviewer.role_id, "Escalated review: " + reason)
    log(
        db,
        user,
        case,
        "escalation_created",
        workflow_run_id=run.id,
        requested_from=reviewer.id,
        reason=reason,
    )


def decide(db, user, case, approval, action, value):
    run = db.get(WorkflowRun, approval.workflow_run_id)
    step = db.get(WorkflowStep, approval.step_id)
    if not decision_allowed(user, case, approval):
        raise HTTPException(403, "You do not have independent approval authority for this request.")
    if approval.status != AS.PENDING or run.current_step != step.key:
        raise HTTPException(409, "This approval is stale or already decided.")
    guard, sources = context(db, user, case)
    if action in {"approve", "override"}:
        if guard.status not in {ReliabilityStatus.VERIFIED, ReliabilityStatus.REVIEW_REQUIRED}:
            raise HTTPException(
                409, "Guard prerequisites must be satisfied before any approval or override."
            )
        if guard.status == ReliabilityStatus.REVIEW_REQUIRED and not value.reason:
            raise HTTPException(422, "A reason is required to resolve review-required guidance.")
    if action == "override" and (user.role_id != "governance" or not value.reason):
        raise HTTPException(
            422 if not value.reason else 403,
            "Override requires Governance authority and a recorded reason.",
        )
    if action in {"reject", "request-evidence", "escalate"} and not value.reason:
        raise HTTPException(422, "Record a reason for this decision.")
    if action == "escalate":
        escalate(db, user, case, run, value.reason, approval)
        return
    if case.type == "aml_investigation":
        log(
            db,
            user,
            case,
            "checker_decision_recorded",
            action=action,
            approval_id=approval.id,
            reason=value.reason,
        )
    approval.decision_reason, approval.decided_by, approval.decided_at = (
        value.reason,
        user.id,
        now(),
    )
    if action == "request-evidence":
        if not value.evidence_label:
            raise HTTPException(422, "Specify the required evidence.")
        item = EvidenceItem(
            key="request-" + approval.id,
            label=value.evidence_label,
            required=True,
            status="missing",
            details=value.reason,
        )
        db.add(CaseEvidence(case_id=case.id, key=item.key, item=item.model_dump(mode="json")))
        approval.status = AS.EVIDENCE_REQUESTED
        # Resume at Guard after evidence is supplied; previous decision remains immutable history.
        run.current_step = next(s.id for s in config(run).steps if s.type == ST.GUARD)
        gate = step_row(db, run)
        gate.status = SS.WAITING
        run.status, case.status = WS.WAITING_FOR_EVIDENCE, CS.WAITING_FOR_EVIDENCE
        if step.key != gate.key:
            step.status, step.completed_at = SS.PENDING, None
        log(
            db,
            user,
            case,
            "evidence_requested",
            approval_id=approval.id,
            requirement_key=item.key,
            label=item.label,
            reason=value.reason,
        )
        context(db, user, case)
    elif action == "reject":
        approval.status = AS.REJECTED
        log(db, user, case, "approval_rejected", approval_id=approval.id, reason=value.reason)
        cancel(db, user, case)
    else:
        approval.status = AS.OVERRIDDEN if action == "override" else AS.APPROVED
        approval.override_reason = value.reason if action == "override" else None
        log(
            db,
            user,
            case,
            "override_performed" if action == "override" else "approval_approved",
            approval_id=approval.id,
            reason=value.reason,
            guard_id=guard.id,
            guard_status=guard.status.value,
            source_refs=[ref.model_dump() for ref in guard.source_refs],
        )
        # A human records a decision; Guard REVIEW_REQUIRED is preserved, never relabelled VERIFIED.
        if step.type == ST.APPROVAL:
            finish_step(db, user, case, run, step)
            enter(db, user, case, run, step_config(run).next)
            if case.type == "aml_investigation" and run.status == WS.COMPLETED:
                from .models import Investigation

                investigation = db.get(Investigation, case.id)
                investigation.completed_at = now()
                log(db, user, case, "investigation_completed", approval_id=approval.id)
        else:
            # Escalated TASK/GUARD must still satisfy the normal progression.
            run.status = WS.WAITING_FOR_EVIDENCE if step.type == ST.GUARD else WS.RUNNING
            case.status = CS.WAITING_FOR_EVIDENCE if step.type == ST.GUARD else CS.IN_PROGRESS
