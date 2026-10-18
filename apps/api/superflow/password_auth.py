"""Local PostgreSQL accounts; Argon2id passwords and hashed opaque sessions."""

import hashlib
import secrets
from datetime import timedelta, timezone
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pwdlib import PasswordHash
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from .audit import record
from .config import settings
from .db import get_db
from .models import AuthSession, LoginThrottle, User, UserCredential, now

router = APIRouter(prefix="/api/auth", tags=["authentication"])
Db = Annotated[Session, Depends(get_db)]
passwords = PasswordHash.recommended()


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def cookie_name():
    return (
        "__Host-superflow-session" if settings.app_environment != "local" else "superflow-session"
    )


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def check_origin(request):
    if request.headers.get("origin") != settings.public_app_url.rstrip("/"):
        raise HTTPException(403, "Request origin is not authorized.")


def session_user(db, request):
    token = request.cookies.get(cookie_name(), "")
    session = db.get(AuthSession, token_digest(token)) if token else None
    user = db.get(User, session.user_id) if session and aware(session.expires_at) > now() else None
    if not user or not user.active or not db.get(UserCredential, user.id):
        raise HTTPException(401, "Sign in to SuperFlow.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        check_origin(request)
    return user


def user_view(user):
    return {
        "id": user.id,
        "name": user.name,
        "role_id": user.role_id,
        "role_name": user.role.name,
        "department": user.department,
        "permissions": user.role.permissions,
    }


@lru_cache(maxsize=1)
def dummy_hash():
    return passwords.hash(secrets.token_urlsafe(32))


def set_password(db, user, password):
    if not 15 <= len(password) <= 128:
        raise ValueError("Use a password between 15 and 128 characters.")
    credential = db.get(UserCredential, user.id)
    if not credential:
        credential = UserCredential(user_id=user.id, password_hash="")
        db.add(credential)
    credential.password_hash = passwords.hash(password)
    credential.failed_attempts, credential.locked_until, credential.changed_at = 0, None, now()
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    record(db, user, user.id, "password_changed", entity_type="user")


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: SecretStr = Field(min_length=1, max_length=128)


@router.get("/config")
def auth_config():
    return {"mode": settings.auth_mode, "environment": settings.app_environment}


@router.get("/me")
def me(request: Request, db: Db):
    return user_view(session_user(db, request))


@router.post("/login")
def login(value: LoginInput, request: Request, response: Response, db: Db):
    if settings.auth_mode != "password":
        raise HTTPException(404, "Password sign-in is not enabled.")
    check_origin(request)
    # Do not trust forwarded IP headers. Deploy one API instance behind private ingress.
    key = token_digest(request.client.host if request.client else "unknown")
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": int(key[:15], 16)})
    throttle = db.get(LoginThrottle, key)
    if not throttle:
        throttle = LoginThrottle(key=key, attempts=0, window_start=now())
        db.add(throttle)
    if aware(throttle.window_start) < now() - timedelta(minutes=15):
        throttle.attempts, throttle.window_start = 0, now()
    throttle.attempts += 1
    if throttle.attempts > 30:
        db.commit()
        raise HTTPException(429, "Too many sign-in attempts. Try again later.")
    user = db.scalar(select(User).where(User.email == value.email.strip().lower()))
    credential = db.get(UserCredential, user.id) if user else None
    locked = credential and credential.locked_until and aware(credential.locked_until) > now()
    valid = passwords.verify(
        value.password.get_secret_value(), credential.password_hash if credential else dummy_hash()
    )
    if not user or not user.active or not credential or locked or not valid:
        if credential:
            credential.failed_attempts += 1
            if credential.failed_attempts >= 5:
                credential.locked_until = now() + timedelta(minutes=15)
            record(db, user, user.id, "sign_in_failed", entity_type="user")
        db.commit()
        raise HTTPException(401, "Sign-in failed. Check credentials or try again later.")
    credential.failed_attempts, credential.locked_until = 0, None
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= now()))
    old_token = request.cookies.get(cookie_name())
    if old_token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == token_digest(old_token)))
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            token_hash=token_digest(token),
            user_id=user.id,
            expires_at=now() + timedelta(hours=settings.session_hours),
        )
    )
    record(db, user, user.id, "signed_in", entity_type="user")
    db.commit()
    response.set_cookie(
        cookie_name(),
        token,
        max_age=settings.session_hours * 3600,
        httponly=True,
        secure=settings.app_environment != "local",
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return user_view(user)


@router.post("/logout")
def logout(request: Request, response: Response, db: Db):
    user = session_user(db, request)
    db.execute(
        delete(AuthSession).where(
            AuthSession.token_hash == token_digest(request.cookies[cookie_name()])
        )
    )
    record(db, user, user.id, "signed_out", entity_type="user")
    db.commit()
    response.delete_cookie(
        cookie_name(),
        path="/",
        secure=settings.app_environment != "local",
        httponly=True,
        samesite="lax",
    )
    return {"signed_out": True}
