from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .analytics import impact_workspace
from .analytics_contracts import ImpactQuery, ImpactWorkspace
from .auth import current_user
from .db import get_db
from .models import User

router = APIRouter(prefix="/api/impact")
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


@router.get("", response_model=ImpactWorkspace)
def overview(db: Db, user: Actor):
    return impact_workspace(db, user, "Show impact across quality, capacity, and delivery")


@router.post("", response_model=ImpactWorkspace)
def ask_impact(value: ImpactQuery, db: Db, user: Actor):
    return impact_workspace(db, user, value.question)
