from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from .auth import current_user
from .cases import begin_mutation, get_case
from .db import get_db
from .investment import (
    analysis_view,
    create_analysis,
    get_analysis,
    list_analyses,
    proposal_sources,
    require_preparer,
    select_assumption,
    submit_analysis,
    update_memo,
)
from .investment_contracts import (
    AnalysisCreate,
    AssumptionSelect,
    InvestmentSummary,
    InvestmentView,
    MemoUpdate,
    ProposalSourceView,
)
from .models import User
from .workflow_contracts import Mutation

router = APIRouter(prefix="/api/investment-analyses")
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


def returned(db, user, case):
    db.flush()
    payload = analysis_view(db, user, case)
    db.commit()
    return payload


def analysed_case(db, user, analysis_id, *, lock=False):
    case = get_case(db, user, analysis_id, lock=lock)
    get_analysis(db, case)
    return case


@router.get("/sources", response_model=list[ProposalSourceView])
def sources(db: Db, user: Actor):
    return proposal_sources(db, user)


@router.get("", response_model=list[InvestmentSummary])
def analyses(db: Db, user: Actor):
    return list_analyses(db, user)


@router.post("", status_code=201, response_model=InvestmentView)
def start_analysis(value: AnalysisCreate, response: Response, db: Db, user: Actor):
    case, created = create_analysis(db, user, value)
    if not created:
        response.status_code = 200  # The open analysis for this proposal version is reused.
    return returned(db, user, case)


@router.get("/{analysis_id}", response_model=InvestmentView)
def read_analysis(analysis_id: str, db: Db, user: Actor):
    return returned(db, user, analysed_case(db, user, analysis_id))


@router.post("/{analysis_id}/select", response_model=InvestmentView)
def select(analysis_id: str, value: AssumptionSelect, db: Db, user: Actor):
    case = analysed_case(db, user, analysis_id, lock=True)
    analysis = require_preparer(db, user, case)
    if begin_mutation(db, user, case, value, "select:" + value.assumption_id):
        select_assumption(db, user, case, analysis, value)
    return returned(db, user, case)


@router.post("/{analysis_id}/memo", response_model=InvestmentView)
def memo(analysis_id: str, value: MemoUpdate, db: Db, user: Actor):
    case = analysed_case(db, user, analysis_id, lock=True)
    analysis = require_preparer(db, user, case)
    if begin_mutation(db, user, case, value, "memo"):
        update_memo(db, user, case, analysis, value)
    return returned(db, user, case)


@router.post("/{analysis_id}/submit", response_model=InvestmentView)
def submit(analysis_id: str, value: Mutation, db: Db, user: Actor):
    case = analysed_case(db, user, analysis_id, lock=True)
    analysis = require_preparer(db, user, case)
    if begin_mutation(db, user, case, value, "submit"):
        submit_analysis(db, user, case, analysis)
    return returned(db, user, case)
