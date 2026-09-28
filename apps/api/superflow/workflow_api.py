from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import current_user
from .cases import (
    add_evidence,
    begin_mutation,
    can_access_case,
    context,
    domain_kind,
    get_case,
    log,
    new_case,
    references_allowed,
    require_edit,
    summary,
)
from .db import get_db
from .models import (
    Approval,
    Case,
    QuestionRun,
    Task,
    User,
    WorkflowDefinition,
    WorkflowRun,
    WorkflowStep,
    now,
)
from .workflow_contracts import (
    ApprovalView,
    CaseCreate,
    CasePatch,
    CaseSummary,
    CaseView,
    DecisionAction,
    DecisionInput,
    DefinitionView,
    EvidenceAdd,
    Mutation,
    TaskView,
    WorkflowStart,
    WorkflowView,
)
from .workflow_contracts import TaskStatus as TS
from .workflow_views import approval_view, case_view, task_view, workflow_view
from .workflows import advance, cancel, decide, escalate, retry, start_workflow

router = APIRouter(prefix="/api")
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


def returned(db, user, case):
    db.flush()
    payload = case_view(db, user, case)
    db.commit()
    return payload


@router.post("/cases", status_code=201, response_model=CaseView)
def create_case(value: CaseCreate, db: Db, user: Actor):
    return returned(db, user, new_case(db, user, value))


@router.get("/cases", response_model=list[CaseSummary])
def list_cases(db: Db, user: Actor):
    result = []
    for case in db.scalars(select(Case).order_by(Case.updated_at.desc())):
        if can_access_case(db, user, case):
            context(db, user, case)
            result.append(summary(db, case))
    db.commit()
    return result


@router.get("/cases/{case_id}", response_model=CaseView)
def read_case(case_id: str, db: Db, user: Actor):
    return returned(db, user, get_case(db, user, case_id))


@router.patch("/cases/{case_id}", response_model=CaseView)
def patch_case(case_id: str, value: CasePatch, db: Db, user: Actor):
    case = get_case(db, user, case_id, lock=True)
    require_edit(user, case)
    if begin_mutation(db, user, case, value, "patch"):
        if value.owner_id and value.owner_id != case.owner_id:
            if user.role_id not in {"manager", "governance"}:
                raise HTTPException(403, "Only Manager or Governance may reassign ownership.")
            if db.scalar(select(WorkflowRun.id).where(WorkflowRun.case_id == case.id)):
                raise HTTPException(409, "Reassign ownership before starting a workflow.")
            owner = db.get(User, value.owner_id)
            if (
                not owner
                or not owner.active
                or not references_allowed(db, owner, db.get(QuestionRun, case.context_run_id))
            ):
                raise HTTPException(422, "Owner is unavailable or cannot access case context.")
            case.owner_id = owner.id
        for key in ["title", "description"]:
            if getattr(value, key) is not None:
                setattr(case, key, getattr(value, key))
        if value.cancel:
            cancel(db, user, case)
        log(db, user, case, "case_updated", revision=case.revision, owner_id=case.owner_id)
    return returned(db, user, case)


@router.post("/cases/{case_id}/evidence", response_model=CaseView)
def attach_evidence(case_id: str, value: EvidenceAdd, db: Db, user: Actor):
    case = get_case(db, user, case_id, lock=True)
    require_edit(user, case)
    if domain_kind(db, case) == "regulatory":
        raise HTTPException(409, "Regulatory review sources are fixed by the comparison.")
    if begin_mutation(db, user, case, value, "evidence"):
        add_evidence(db, user, case, value)
    return returned(db, user, case)


@router.get("/workflow-definitions", response_model=list[DefinitionView])
def definitions(db: Db, user: Actor):
    return list(db.scalars(select(WorkflowDefinition).order_by(WorkflowDefinition.name)))


@router.post("/workflows/{definition_id}/start", response_model=CaseView)
def start(definition_id: str, value: WorkflowStart, db: Db, user: Actor):
    case = get_case(db, user, value.case_id, lock=True)
    require_edit(user, case)
    definition = db.get(WorkflowDefinition, definition_id)
    if not definition:
        raise HTTPException(404, "Workflow definition not found.")
    if domain_kind(db, case):
        raise HTTPException(409, "Submit this work from its own workspace.")
    if begin_mutation(db, user, case, value, "start:" + definition_id):
        start_workflow(db, user, case, definition)
    return returned(db, user, case)


def workflow_case(db, user, run_id, *, lock=False):
    run = db.get(WorkflowRun, run_id)
    if not run:
        raise HTTPException(404, "Workflow not found.")
    case = get_case(db, user, run.case_id, lock=lock)
    db.refresh(run)
    return case, run


@router.get("/workflow-runs", response_model=list[WorkflowView])
def runs(db: Db, user: Actor):
    result = []
    for run in db.scalars(select(WorkflowRun).order_by(WorkflowRun.created_at.desc())):
        case = db.get(Case, run.case_id)
        if can_access_case(db, user, case):
            result.append(workflow_view(db, user, case, run))
    return result


@router.get("/workflow-runs/{run_id}", response_model=CaseView)
def read_run(run_id: str, db: Db, user: Actor):
    case, _ = workflow_case(db, user, run_id)
    return returned(db, user, case)


@router.post("/workflow-runs/{run_id}/{action}", response_model=CaseView)
def workflow_action(run_id: str, action: str, value: Mutation, db: Db, user: Actor):
    case, run = workflow_case(db, user, run_id, lock=True)
    require_edit(user, case)
    if action not in {"advance", "retry", "escalate"}:
        raise HTTPException(404, "Workflow action not found.")
    if begin_mutation(db, user, case, value, action + ":" + run.id):
        if action == "advance":
            advance(db, user, case, run)
        elif action == "retry":
            retry(db, user, case, run)
        else:
            escalate(db, user, case, run, value.reason)
    return returned(db, user, case)


@router.get("/tasks", response_model=list[TaskView])
def tasks(db: Db, user: Actor):
    result = []
    for task in db.scalars(select(Task).order_by(Task.due_at)):
        run = db.get(WorkflowRun, task.workflow_run_id)
        case = db.get(Case, run.case_id)
        if can_access_case(db, user, case):
            result.append(task_view(user, case, task, run))
    return result


@router.post("/tasks/{task_id}/{action}", response_model=CaseView)
def task_action(task_id: str, action: str, value: Mutation, db: Db, user: Actor):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found.")
    case, run = workflow_case(db, user, task.workflow_run_id, lock=True)
    db.refresh(task)
    if task.owner_id != user.id and user.role_id != "governance":
        raise HTTPException(403, "Only the task owner or Governance may complete this task.")
    if action not in {"start", "complete"}:
        raise HTTPException(404, "Task action not found.")
    if begin_mutation(db, user, case, value, action + ":" + task_id):
        step = db.get(WorkflowStep, task.step_id)
        if run.status == "ESCALATED":
            raise HTTPException(409, "Resolve the escalation before continuing the assigned task.")
        if run.current_step != step.key or task.status not in {TS.TODO, TS.IN_PROGRESS}:
            raise HTTPException(409, "Task is already completed, cancelled, or no longer current.")
        if action == "start":
            if task.status != TS.TODO:
                raise HTTPException(409, "Task is already in progress.")
            task.status = TS.IN_PROGRESS
        else:
            task.status, task.completed_at = TS.DONE, now()
        log(
            db,
            user,
            case,
            "task_started" if action == "start" else "task_completed",
            task_id=task.id,
            workflow_run_id=run.id,
            owner_id=task.owner_id,
        )
        if action == "complete":
            advance(db, user, case, run)
    return returned(db, user, case)


@router.get("/approvals", response_model=list[ApprovalView])
def approvals(db: Db, user: Actor):
    result = []
    for approval in db.scalars(select(Approval).order_by(Approval.requested_at.desc())):
        case = db.get(Case, approval.case_id)
        if can_access_case(db, user, case):
            guard, _ = context(db, user, case)
            result.append(approval_view(db, user, case, approval, guard))
    db.commit()
    return result


@router.get("/approvals/{approval_id}", response_model=CaseView)
def read_approval(approval_id: str, db: Db, user: Actor):
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(404, "Approval not found.")
    return returned(db, user, get_case(db, user, approval.case_id))


@router.post("/approvals/{approval_id}/{action}", response_model=CaseView)
def approval_action(
    approval_id: str, action: DecisionAction, value: DecisionInput, db: Db, user: Actor
):
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(404, "Approval not found.")
    case = get_case(db, user, approval.case_id, lock=True)
    db.refresh(approval)
    if begin_mutation(db, user, case, value, action + ":" + approval_id):
        decide(db, user, case, approval, action, value)
    return returned(db, user, case)
