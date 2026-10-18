"""Durable, permission-aware Ask conversations using the existing answer pipeline."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .auth import current_user
from .config import settings
from .db import SessionLocal, get_db
from .models import Case, ChatSession, ChatTurn, QuestionRun, User, now
from .providers import strip_citation_markers
from .schemas import AskInput
from .workspace_intent import (
    IntentChoice,
    OllamaIntentProvider,
    WorkspaceResolution,
    resolve_workspace,
)

router = APIRouter(prefix="/api/chats", tags=["conversations"])
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


class ChatInput(AskInput):
    workspace: IntentChoice | None = None


class ChatTitle(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ProposedWorkspace:
    def __init__(self, choice: IntentChoice):
        self.choice = choice

    def choose(self, _prompt):
        return self.choice


def owned_chat(db: Session, user: User, chat_id: str, *, lock=False) -> ChatSession:
    statement = select(ChatSession).where(ChatSession.id == chat_id, ChatSession.user_id == user.id)
    chat = db.scalar(statement.with_for_update() if lock else statement)
    if chat is None:
        raise HTTPException(404, "Chat not found.")
    return chat


def summary(chat: ChatSession):
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
    }


def turns_for(db: Session, chat_id: str):
    return list(
        db.scalars(
            select(ChatTurn).where(ChatTurn.session_id == chat_id).order_by(ChatTurn.ordinal)
        )
    )


def turn_payload(db: Session, user: User, turn: ChatTurn):
    from .main import run_payload

    answer = None
    error = turn.error
    resolution = turn.resolution
    if resolution and resolution.get("intent") != "knowledge_answer":
        # Re-evaluate role and case access; saved routing is not authority.
        resolution = resolve_workspace(
            db,
            user,
            turn.question,
            ProposedWorkspace(
                IntentChoice.model_validate(
                    {"intent": resolution["intent"], "view": resolution.get("view")}
                )
            )
            if resolution.get("intent")
            else None,
        ).model_dump(mode="json")
    if turn.run_id:
        run = db.get(QuestionRun, turn.run_id)
        if run:
            try:
                answer = run_payload(db, user, run)
            except HTTPException:
                error = "Saved evidence is no longer available to your role. Ask again."
    return {
        "id": turn.id,
        "question": turn.question,
        "status": turn.status,
        "resolution": resolution,
        "answer": answer,
        "events": turn.events,
        "error": error,
        "created_at": turn.created_at,
        "scope": {
            key: turn.query.get(key)
            for key in (
                "domain",
                "document_ids",
                "include_outdated",
                "web_search",
                "web_query",
                "web_urls",
            )
        },
    }


@router.get("")
def list_chats(db: Db, user: Actor, before: str | None = None):
    statement = select(ChatSession).where(ChatSession.user_id == user.id)
    if before:
        boundary = owned_chat(db, user, before)
        statement = statement.where(
            or_(
                ChatSession.updated_at < boundary.updated_at,
                and_(ChatSession.updated_at == boundary.updated_at, ChatSession.id > boundary.id),
            )
        )
    rows = db.scalars(statement.order_by(ChatSession.updated_at.desc(), ChatSession.id).limit(100))
    return [summary(chat) for chat in rows]


@router.post("", status_code=201)
def create_chat(db: Db, user: Actor):
    chat = ChatSession(user_id=user.id, title="New chat")
    db.add(chat)
    db.commit()
    return {**summary(chat), "turns": []}


@router.get("/{chat_id}")
def read_chat(chat_id: str, db: Db, user: Actor):
    chat = owned_chat(db, user, chat_id)
    result = {**summary(chat), "turns": [turn_payload(db, user, t) for t in turns_for(db, chat_id)]}
    db.commit()
    return result


@router.patch("/{chat_id}")
def rename_chat(chat_id: str, value: ChatTitle, db: Db, user: Actor):
    chat = owned_chat(db, user, chat_id, lock=True)
    if not value.title.strip():
        raise HTTPException(422, "Enter a chat title.")
    chat.title = value.title.strip()
    db.commit()
    return summary(chat)


@router.get("/{chat_id}/turns/{turn_id}")
def read_turn(chat_id: str, turn_id: str, db: Db, user: Actor):
    owned_chat(db, user, chat_id)
    turn = db.get(ChatTurn, turn_id)
    if turn is None or turn.session_id != chat_id:
        raise HTTPException(404, "Message not found.")
    result = turn_payload(db, user, turn)
    db.commit()
    return result


@router.post("/from-answer/{run_id}", status_code=201)
def continue_saved_answer(run_id: str, db: Db, user: Actor):
    from .main import run_payload

    run = db.get(QuestionRun, run_id)
    if (
        run is None
        or run.user_id != user.id
        or not run.answer
        or db.scalar(select(Case.id).where(Case.context_run_id == run_id))
    ):
        raise HTTPException(404, "Question not found.")
    run_payload(db, user, run)
    existing = db.scalar(
        select(ChatSession)
        .join(ChatTurn)
        .where(ChatSession.user_id == user.id, ChatTurn.run_id == run_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(1)
    )
    if existing:
        result = {
            **summary(existing),
            "turns": [turn_payload(db, user, turn) for turn in turns_for(db, existing.id)],
        }
        db.commit()
        return result
    chat = ChatSession(user_id=user.id, title=run.question[:120])
    db.add(chat)
    db.flush()
    turn = ChatTurn(
        session_id=chat.id,
        ordinal=1,
        question=run.question,
        query=run.filters,
        status="complete",
        run_id=run.id,
        resolution=WorkspaceResolution(
            status="ready", intent="knowledge_answer", message="Your saved cited answer."
        ).model_dump(mode="json"),
        events=[
            {
                "stage": "restored",
                "message": "Saved answer reopened; original stage timings were not recorded.",
                "at": now().isoformat(),
            }
        ],
    )
    db.add(turn)
    db.commit()
    return {**summary(chat), "turns": [turn_payload(db, user, turn)]}


@router.post("/{chat_id}/turns", status_code=202)
def submit_turn(chat_id: str, value: ChatInput, db: Db, user: Actor):
    from .main import web_search_pool

    # Serialize submissions per identity as well as per chat. One local worker bounds RAM.
    # NO KEY UPDATE serializes submissions without blocking on the answer
    # transaction's foreign-key KEY SHARE lock during slow local inference.
    db.scalar(select(User).where(User.id == user.id).with_for_update(key_share=True))
    chat = owned_chat(db, user, chat_id, lock=True)
    pending = db.scalar(
        select(ChatTurn.id)
        .join(ChatSession)
        .where(ChatSession.user_id == user.id, ChatTurn.status.in_(["queued", "running"]))
    )
    if pending:
        raise HTTPException(
            409, "A reply is still running. Open that chat and wait for it to finish."
        )
    count = db.scalar(
        select(func.count()).select_from(ChatTurn).where(ChatTurn.session_id == chat.id)
    )
    if count >= 100:
        raise HTTPException(422, "This chat has 100 messages. Start a new chat to continue.")
    turn = ChatTurn(
        session_id=chat.id,
        ordinal=count + 1,
        question=value.question,
        query=value.model_dump(exclude={"question"}),
        status="queued",
        events=[
            {
                "stage": "queued",
                "message": "Request saved and queued on this device.",
                "at": now().isoformat(),
            }
        ],
    )
    db.add(turn)
    if not count:
        chat.title = value.question[:120]
    chat.updated_at = now()
    db.commit()
    web_search_pool.submit(process_turn, turn.id)
    return {"id": turn.id, "status": turn.status}


def process_turn(turn_id: str):
    from .main import execute_question, run_payload

    def progress(stage: str, message: str):
        # Separate row/transaction makes actual stages visible during slow inference.
        with SessionLocal() as stage_db:
            row = stage_db.get(ChatTurn, turn_id)
            if row:
                row.events = [
                    *row.events,
                    {"stage": stage, "message": message, "at": now().isoformat()},
                ][-20:]
                stage_db.commit()

    with SessionLocal() as db:
        turn = db.get(ChatTurn, turn_id)
        if turn is None or turn.status != "queued":
            return
        try:
            chat = db.get(ChatSession, turn.session_id)
            user = db.get(User, chat.user_id)
            if not user or not user.active:
                raise HTTPException(403, "This identity is unavailable.")
            turn.status = "running"
            db.commit()
            progress("routing", "Selecting an approved workspace for this message.")
            value = ChatInput(question=turn.question, **turn.query)
            previous_turns = [t for t in turns_for(db, chat.id) if t.ordinal < turn.ordinal]
            intent_provider = (
                ProposedWorkspace(value.workspace)
                if value.workspace
                else OllamaIntentProvider()
                if settings.llm_provider == "ollama" and not previous_turns
                else None
            )
            scoped = bool(
                value.domain or value.document_ids or value.include_outdated or value.web_search
            )
            resolution = (
                WorkspaceResolution(
                    status="ready",
                    intent="knowledge_answer",
                    message="Searching within your selected knowledge sources.",
                )
                if scoped
                else resolve_workspace(
                    db,
                    user,
                    value.question,
                    intent_provider,
                )
            )
            turn.resolution = resolution.model_dump(mode="json")
            db.commit()
            result_run_id = None
            if resolution.status == "ready" and resolution.intent == "knowledge_answer":
                conversation = []
                previous = [
                    t
                    for t in turns_for(db, chat.id)
                    if t.ordinal < turn.ordinal and t.status == "complete" and t.run_id
                ][-4:]
                for earlier in previous:
                    # Never feed inaccessible saved answers back into the model.
                    answer = run_payload(db, user, db.get(QuestionRun, earlier.run_id))
                    conversation.append(
                        {
                            "question": earlier.question[:1000],
                            "answer": strip_citation_markers(answer["answer"])[:1200],
                            "source_titles": list(
                                dict.fromkeys(source["title"] for source in answer["sources"])
                            )[:3],
                        }
                    )
                if conversation:
                    progress(
                        "context",
                        f"Reading {len(conversation)} earlier replies "
                        "after rechecking evidence access.",
                    )
                result = execute_question(
                    AskInput.model_validate(value.model_dump()),
                    db,
                    user,
                    progress=progress,
                    conversation=conversation,
                )
                result_run_id = result["id"]
            # Refresh after callbacks so the final write preserves persisted events.
            db.refresh(turn)
            turn.run_id = result_run_id
            turn.status = "complete"
            turn.events = [
                *turn.events,
                {
                    "stage": "complete",
                    "message": "Cited reply ready."
                    if turn.run_id
                    else "Access checked; this workspace is unavailable for your role."
                    if resolution.status == "denied"
                    else "Approved workspace ready; domain controls remain in place.",
                    "at": now().isoformat(),
                },
            ]
            chat.updated_at = now()
            db.commit()
        except Exception as error:
            logging.getLogger(__name__).exception("Chat turn failed: %s", turn_id)
            db.rollback()
            turn = db.get(ChatTurn, turn_id)
            if turn:
                turn.status = "failed"
                turn.error = (
                    str(error.detail)
                    if isinstance(error, HTTPException)
                    else "This reply could not complete. Check the local services and try again."
                )
                turn.events = [
                    *turn.events,
                    {"stage": "failed", "message": turn.error, "at": now().isoformat()},
                ]
                db.commit()


def recover_chats():
    """Fail interrupted work explicitly instead of silently replaying browser/model calls."""
    try:
        with SessionLocal() as db:
            for turn in db.scalars(
                select(ChatTurn).where(ChatTurn.status.in_(["queued", "running"]))
            ):
                turn.status = "failed"
                turn.error = (
                    "The service restarted during this reply. Send the question again to retry."
                )
                turn.events = [
                    *turn.events,
                    {"stage": "failed", "message": turn.error, "at": now().isoformat()},
                ]
            db.commit()
    except SQLAlchemyError:
        logging.getLogger(__name__).warning("Chat recovery needs a migrated database.")
