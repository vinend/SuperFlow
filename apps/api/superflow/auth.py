from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Document, User
from .password_auth import session_user


def current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    x_user_id: Annotated[str | None, Header()] = None,
) -> User:
    if settings.auth_mode == "password":
        return session_user(db, request)
    user = db.get(User, x_user_id) if x_user_id else None
    if user is None or not user.active:
        raise HTTPException(401, "Select an active demo user using X-User-Id.")
    return user


def can_read(user: User, document: Document) -> bool:
    if document.context_run_id is not None:
        return user.id == document.owner_id
    return user.role_id == "governance" or user.role_id in document.access_roles


def require_manage(user: User) -> None:
    if "knowledge:write" not in user.role.permissions:
        raise HTTPException(
            403, "This demo role cannot manage knowledge. Switch to SME or Governance."
        )
