"""Synthetic FIU API. Every read and mutation reuses Case authorization."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import current_user
from .cases import begin_mutation, can_access_case, log
from .db import get_db
from .investigation_contracts import InvestigationCreate, RecommendationInput, ToolInput
from .investigations import (
    MAX_AGENT_STEPS,
    agent_step,
    create_investigation,
    evaluate_investigation_case,
    execute_tool,
    require_analyst,
    require_investigation,
    submit_investigation,
    update_recommendation,
    view,
)
from .models import Case, Investigation, User

router = APIRouter(prefix="/api/investigations", tags=["investigations"])
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


@router.get("")
def list_investigations(db: Db, user: Actor):
    if user.role_id != "compliance":
        raise HTTPException(403, "Investigation Review is available to assigned Compliance staff.")
    result = []
    for investigation in db.scalars(select(Investigation).order_by(Investigation.created_at)):
        case = db.get(Case, investigation.case_id)
        if can_access_case(db, user, case):
            result.append(view(db, user, case, investigation))
    db.commit()
    return result


@router.post("", status_code=201)
def create(value: InvestigationCreate, db: Db, user: Actor):
    investigation = create_investigation(db, user, value.scenario)
    case = db.get(Case, investigation.case_id)
    result = view(db, user, case, investigation)
    db.commit()
    return result


@router.get("/{investigation_id}")
def read(investigation_id: str, db: Db, user: Actor):
    case, investigation = require_investigation(db, user, investigation_id)
    result = view(db, user, case, investigation)
    db.commit()
    return result


def changed(db, user, case, investigation):
    db.flush()
    result = view(db, user, case, investigation)
    db.commit()
    return result


@router.post("/{investigation_id}/tools/{tool_name}")
def run_tool(investigation_id: str, tool_name: str, value: ToolInput, db: Db, user: Actor):
    case, investigation = require_investigation(db, user, investigation_id, lock=True)
    require_analyst(user, case, investigation)
    if begin_mutation(db, user, case, value, "tool:" + tool_name):
        execute_tool(db, user, case, investigation, tool_name, retry=False)
    return changed(db, user, case, investigation)


@router.post("/{investigation_id}/tools/{tool_name}/retry")
def retry_tool(investigation_id: str, tool_name: str, value: ToolInput, db: Db, user: Actor):
    case, investigation = require_investigation(db, user, investigation_id, lock=True)
    require_analyst(user, case, investigation)
    if begin_mutation(db, user, case, value, "retry-tool:" + tool_name):
        execute_tool(db, user, case, investigation, tool_name, retry=True)
    return changed(db, user, case, investigation)


@router.post("/{investigation_id}/agent/run")
def run_agent(investigation_id: str, value: ToolInput, db: Db, user: Actor):
    case, investigation = require_investigation(db, user, investigation_id, lock=True)
    require_analyst(user, case, investigation)
    if begin_mutation(db, user, case, value, "agent-run"):
        log(db, user, case, "agent_run_started", max_steps=MAX_AGENT_STEPS)
        for _ in range(MAX_AGENT_STEPS):
            plan = agent_step(db, user, case, investigation)
            if plan.stop:
                break
        else:
            log(db, user, case, "agent_step_limit_reached", max_steps=MAX_AGENT_STEPS)
        evaluate_investigation_case(db, user, case)
    return changed(db, user, case, investigation)


@router.post("/{investigation_id}/recommendation")
def recommendation(investigation_id: str, value: RecommendationInput, db: Db, user: Actor):
    case, investigation = require_investigation(db, user, investigation_id, lock=True)
    require_analyst(user, case, investigation)
    if begin_mutation(db, user, case, value, "recommendation"):
        update_recommendation(db, user, case, investigation, value.notes, value.recommendation)
    return changed(db, user, case, investigation)


@router.post("/{investigation_id}/submit")
def submit(investigation_id: str, value: ToolInput, db: Db, user: Actor):
    case, investigation = require_investigation(db, user, investigation_id, lock=True)
    require_analyst(user, case, investigation)
    if begin_mutation(db, user, case, value, "submit-investigation"):
        submit_investigation(db, user, case, investigation)
    return changed(db, user, case, investigation)
