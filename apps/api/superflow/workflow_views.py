"""Typed projections. Permissions and available actions come from backend state."""

from sqlalchemy import select

from .cases import activity, context, domain_kind, summary
from .models import Approval, StepAttempt, Task, WorkflowDefinition, WorkflowRun, WorkflowStep
from .reliability_contracts import ReliabilityStatus
from .workflow_contracts import ApprovalStatus as AS
from .workflow_contracts import CaseStatus as CS
from .workflow_contracts import StepType as ST
from .workflow_contracts import TaskStatus as TS
from .workflow_contracts import WorkflowStatus as WS
from .workflows import config, decision_allowed, step_config, step_row


def approval_view(db, user, case, approval, guard):
    actions = []
    run = db.get(WorkflowRun, approval.workflow_run_id)
    step = db.get(WorkflowStep, approval.step_id)
    if (
        approval.status == AS.PENDING
        and run.current_step == step.key
        and decision_allowed(user, case, approval)
    ):
        actions = ["reject", "request-evidence"]
        if approval.requested_role != "governance":
            actions.append("escalate")
        if guard.status in {ReliabilityStatus.VERIFIED, ReliabilityStatus.REVIEW_REQUIRED}:
            actions.insert(0, "approve")
            if user.role_id == "governance":
                actions.append("override")
    return {
        key: getattr(approval, key)
        for key in [
            "id",
            "case_id",
            "workflow_run_id",
            "step_id",
            "requested_from",
            "requested_by",
            "requested_role",
            "status",
            "decision_reason",
            "override_reason",
            "decided_by",
            "requested_at",
            "decided_at",
            "reason_required",
        ]
    } | {"case_title": case.title, "allowed_actions": actions}


def task_view(user, case, task, run):
    actions = []
    if (task.owner_id == user.id or user.role_id == "governance") and run.status not in {
        WS.COMPLETED,
        WS.CANCELLED,
        WS.ESCALATED,
    }:
        if task.status == TS.TODO:
            actions.append("start")
        if task.status in {TS.TODO, TS.IN_PROGRESS}:
            actions.append("complete")
    return {
        key: getattr(task, key)
        for key in [
            "id",
            "workflow_run_id",
            "step_id",
            "title",
            "description",
            "owner_id",
            "status",
            "due_at",
            "created_at",
            "completed_at",
        ]
    } | {"case_id": case.id, "allowed_actions": actions}


def workflow_view(db, user, case, run):
    definition = db.get(WorkflowDefinition, run.definition_id)
    cfg, current = step_config(run), step_row(db, run)
    editor = user.id in {case.owner_id, case.created_by} or user.role_id == "governance"
    actions = []
    if editor and run.status not in {WS.COMPLETED, WS.CANCELLED}:
        if cfg.type == ST.GUARD and run.status == WS.WAITING_FOR_EVIDENCE:
            actions.append("advance")
        if (
            cfg.type == ST.GUARD
            and run.status == WS.FAILED
            and current.retry_count < cfg.max_retries
        ):
            actions.append("retry")
        if run.status != WS.ESCALATED:
            actions.append("escalate")
    steps = []
    for cfg in config(run).steps:
        step = db.scalar(
            select(WorkflowStep).where(
                WorkflowStep.workflow_run_id == run.id, WorkflowStep.key == cfg.id
            )
        )
        attempts = [
            {
                key: getattr(a, key)
                for key in [
                    "id",
                    "number",
                    "outcome",
                    "reason",
                    "actor_id",
                    "guard_id",
                    "created_at",
                ]
            }
            for a in db.scalars(
                select(StepAttempt)
                .where(StepAttempt.step_id == step.id)
                .order_by(StepAttempt.number)
            )
        ]
        steps.append(
            {
                key: getattr(step, key)
                for key in [
                    "id",
                    "key",
                    "title",
                    "type",
                    "status",
                    "owner_id",
                    "retry_count",
                    "started_at",
                    "completed_at",
                ]
            }
            | {"attempts": attempts}
        )
    return {
        key: getattr(run, key)
        for key in [
            "id",
            "case_id",
            "definition_id",
            "current_step",
            "status",
            "escalation_reason",
            "escalated_by",
            "escalated_at",
            "created_at",
            "completed_at",
        ]
    } | {
        "definition_name": definition.name,
        "definition_version": definition.version,
        "steps": steps,
        "tasks": [
            task_view(user, case, t, run)
            for t in db.scalars(select(Task).where(Task.workflow_run_id == run.id))
        ],
        "allowed_actions": actions,
    }


def case_view(db, user, case):
    guard, sources = context(db, user, case)
    workflow = db.scalar(select(WorkflowRun).where(WorkflowRun.case_id == case.id))
    editor = user.id in {case.owner_id, case.created_by} or user.role_id == "governance"
    actions = []
    if editor and case.status not in {CS.COMPLETED, CS.CANCELLED}:
        domain = domain_kind(db, case)
        actions = ["edit", "cancel"]
        # Investment evidence can still be supplied when a reviewer requests information.
        if domain != "regulatory":
            actions.insert(1, "attach_evidence")
        if not workflow and not domain and guard.status != ReliabilityStatus.ACCESS_RESTRICTED:
            actions.append("start_workflow")
    return summary(db, case) | {
        "reliability": guard,
        "sources": sources if guard.status != ReliabilityStatus.ACCESS_RESTRICTED else [],
        "evidence": guard.evidence,
        "workflow": workflow_view(db, user, case, workflow) if workflow else None,
        "approvals": [
            approval_view(db, user, case, a, guard)
            for a in db.scalars(
                select(Approval)
                .where(Approval.case_id == case.id)
                .order_by(Approval.requested_at, Approval.id)
            )
        ],
        "activity": activity(db, case),
        "allowed_actions": actions,
    }
