from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from .auth import current_user
from .cases import begin_mutation, get_case
from .db import get_db
from .models import User
from .regulatory import (
    complete_review,
    confirm_finding,
    create_review,
    finding_for,
    get_review,
    list_reviews,
    regulatory_sources,
    reject_finding,
    require_decider,
    review_view,
)
from .regulatory_contracts import (
    FindingConfirm,
    RegulatoryReviewSummary,
    RegulatoryReviewView,
    RegulatorySourceView,
    ReviewCreate,
)
from .workflow_contracts import Mutation

router = APIRouter(prefix="/api/regulatory-reviews")
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


def returned(db, user, case):
    db.flush()
    payload = review_view(db, user, case)
    db.commit()
    return payload


@router.get("/sources", response_model=list[RegulatorySourceView])
def sources(db: Db, user: Actor):
    return regulatory_sources(db, user)


@router.get("", response_model=list[RegulatoryReviewSummary])
def reviews(db: Db, user: Actor):
    return list_reviews(db, user)


@router.post("", status_code=201, response_model=RegulatoryReviewView)
def start_review(value: ReviewCreate, response: Response, db: Db, user: Actor):
    case, created = create_review(db, user, value)
    if not created:
        response.status_code = 200  # The open review for this version is reused.
    return returned(db, user, case)


def reviewed_case(db, user, review_id, *, lock=False):
    case = get_case(db, user, review_id, lock=lock)
    get_review(db, case)
    return case


@router.get("/{review_id}", response_model=RegulatoryReviewView)
def read_review(review_id: str, db: Db, user: Actor):
    return returned(db, user, reviewed_case(db, user, review_id))


@router.post("/{review_id}/findings/{finding_id}/confirm", response_model=RegulatoryReviewView)
def confirm(review_id: str, finding_id: str, value: FindingConfirm, db: Db, user: Actor):
    case = reviewed_case(db, user, review_id, lock=True)
    require_decider(user, case)
    finding = finding_for(db, case, finding_id)
    if begin_mutation(db, user, case, value, "confirm:" + finding_id):
        confirm_finding(db, user, case, finding, value)
    return returned(db, user, case)


@router.post("/{review_id}/findings/{finding_id}/reject", response_model=RegulatoryReviewView)
def reject(review_id: str, finding_id: str, value: Mutation, db: Db, user: Actor):
    case = reviewed_case(db, user, review_id, lock=True)
    require_decider(user, case)
    finding = finding_for(db, case, finding_id)
    if begin_mutation(db, user, case, value, "reject:" + finding_id):
        reject_finding(db, user, case, finding, value)
    return returned(db, user, case)


@router.post("/{review_id}/{action}", response_model=RegulatoryReviewView)
def review_action(
    review_id: str, action: Literal["complete"], value: Mutation, db: Db, user: Actor
):
    case = reviewed_case(db, user, review_id, lock=True)
    require_decider(user, case)
    if begin_mutation(db, user, case, value, action):
        complete_review(db, user, case)
    return returned(db, user, case)
