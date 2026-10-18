import json
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import date
from pathlib import PurePath
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from . import ask_progress
from .analytics_api import router as analytics_router
from .audit import record
from .auth import can_read, current_user, require_manage
from .config import settings
from .conversations import recover_chats
from .conversations import router as chat_router
from .db import SessionLocal, get_db
from .embeddings import EmbeddingUnavailable, index_embeddings
from .investigation_api import router as investigation_router
from .investment_api import router as investment_router
from .knowledge import (
    accessible_document,
    activate,
    add_version,
    citation_payload,
    document_payload,
    validate_metadata,
)
from .models import (
    AuditEvent,
    Case,
    Document,
    DocumentVersion,
    QuestionRun,
    User,
    UserCredential,
    WebsiteCapture,
)
from .ojk import router as ojk_router
from .parsing import MAX_BYTES, ParseError, parse_file
from .password_auth import router as auth_router
from .password_auth import session_user, user_view
from .providers import AnswerProvider, ProviderUnavailable, configured_answer_provider
from .rag_api import router as rag_router
from .regulatory_api import router as regulatory_router
from .reliability import digest, evaluate_run, presented_answer
from .reliability_contracts import GuardResult, ReliabilityStatus
from .retrieval import Retriever, configured_retriever
from .schemas import AskInput, AskOutput, Metadata, VersionInput, VersionStatus
from .web_search import collect as collect_web_context
from .website_capture import router as website_capture_router
from .workflow_api import router as workflow_router
from .workspace_intent import router as workspace_intent_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    recover_web_searches()
    recover_chats()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="SuperFlow Knowledge API",
    version="0.6.0",
    description="Knowledge-to-action API. PostgreSQL password sessions in staging; "
    "test identity selection is restricted to explicit local mode.",
)
app.include_router(workflow_router)
app.include_router(regulatory_router)
app.include_router(investment_router)
app.include_router(investigation_router)
app.include_router(analytics_router)
app.include_router(workspace_intent_router)
app.include_router(website_capture_router)
app.include_router(ojk_router)
app.include_router(rag_router)
app.include_router(chat_router)
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "X-User-Id", "X-Ask-Progress"],
)
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]
retriever: Retriever = configured_retriever()
provider: AnswerProvider = configured_answer_provider(settings)


@app.exception_handler(ParseError)
async def parse_error(_, error: ParseError):
    return JSONResponse(status_code=422, content={"detail": str(error)})


@app.exception_handler(EmbeddingUnavailable)
async def embedding_error(_, error: EmbeddingUnavailable):
    return JSONResponse(status_code=503, content={"detail": str(error)})


@app.exception_handler(IntegrityError)
async def integrity_error(_, error: IntegrityError):
    return JSONResponse(
        status_code=409, content={"detail": "A conflicting record exists. Refresh and retry."}
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(_, error: SQLAlchemyError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Database unavailable. Check PostgreSQL and migrations."},
    )


@app.get("/api/health")
def health(db: Db):
    users = db.scalar(select(func.count()).select_from(User))
    return {
        "status": "ok",
        "database": db.bind.dialect.name,
        "seeded_users": users,
        "scope": "phase-0-8",
        "environment": settings.app_environment,
        "authentication": settings.auth_mode,
        "investigation_provider": settings.investigation_provider,
        "inference_provider": provider.name,
        "inference_model": settings.ollama_model if settings.llm_provider == "ollama" else None,
        "retrieval_provider": settings.retrieval_provider,
        "retrieval_engine": settings.retrieval_engine,
        "embedding_model": settings.embedding_model
        if settings.retrieval_provider == "hybrid"
        else None,
        "ocr_enabled": settings.ocr_enabled,
        "web_capture_enabled": settings.web_capture_enabled,
        "vision_model": settings.vision_model,
    }


@app.get("/api/users")
def users(db: Db, request: Request):
    if settings.auth_mode == "password":
        session_user(db, request)
        # A staff directory supports assignment and readable reviewer names. It
        # exposes neither credentials nor a way to change the authenticated actor.
        return [
            user_view(user)
            for user in db.scalars(
                select(User)
                .join(UserCredential, UserCredential.user_id == User.id)
                .where(User.active.is_(True))
                .order_by(User.name)
            )
        ]
    # Public synthetic identities enable the explicitly mocked role switcher.
    return [
        {
            "id": user.id,
            "name": user.name,
            "role_id": user.role_id,
            "role_name": user.role.name,
            "department": user.department,
            "permissions": user.role.permissions,
        }
        for user in db.scalars(select(User).where(User.active.is_(True)).order_by(User.id))
    ]


@app.get("/api/documents")
def documents(db: Db, user: Actor, domain: str | None = None, search: str = ""):
    return [
        document_payload(db, user, document)
        for document in db.scalars(
            select(Document).where(Document.context_run_id.is_(None)).order_by(Document.title)
        )
        if can_read(user, document)
        and (not domain or document.domain == domain)
        and search.lower() in document.title.lower()
    ]


@app.get("/api/documents/{document_id}")
def document_detail(document_id: str, db: Db, user: Actor):
    return document_payload(db, user, accessible_document(db, user, document_id), detail=True)


async def uploaded(file: UploadFile) -> tuple[str, bytes]:
    data = await file.read(MAX_BYTES + 1)
    # Windows and Unix filenames are sanitized without using them as filesystem paths.
    filename = PurePath((file.filename or "upload.txt").replace("\\", "/")).name[:200]
    return filename, data


def parsed_metadata(value: str) -> Metadata:
    try:
        return Metadata.model_validate(json.loads(value))
    except (ValidationError, ValueError, TypeError) as error:
        raise HTTPException(
            422, "Invalid document metadata. Check title, domain, owner, authority, and roles."
        ) from error


@app.post("/api/documents", status_code=201)
async def create_document(
    db: Db,
    user: Actor,
    metadata: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    version: Annotated[str, Form()] = "1.0",
    effective_date: Annotated[date, Form()] = date(2026, 1, 1),
    status: Annotated[VersionStatus, Form()] = "active",
):
    require_manage(user)
    meta = parsed_metadata(metadata)
    validate_metadata(db, user, meta)
    version_input = make_version_input(version, effective_date, status)
    filename, data = await uploaded(file)
    document = Document(**meta.model_dump())
    db.add(document)
    db.flush()
    await run_in_threadpool(add_version, db, document, version_input, filename, data)
    db.commit()
    return document_payload(db, user, document, detail=True)


def make_version_input(version: str, effective_date: date, status: str) -> VersionInput:
    try:
        return VersionInput(version=version, effective_date=effective_date, status=status)
    except ValidationError as error:
        raise HTTPException(422, "Invalid version label, date, or status.") from error


@app.patch("/api/documents/{document_id}")
def update_metadata(document_id: str, metadata: Metadata, db: Db, user: Actor):
    require_manage(user)
    document = accessible_document(db, user, document_id, lock=True)
    validate_metadata(db, user, metadata)
    if document_id in metadata.related_document_ids:
        raise HTTPException(422, "A document cannot be related to itself.")
    for key, value in metadata.model_dump().items():
        setattr(document, key, value)
    db.commit()
    db.refresh(document)
    return document_payload(db, user, document, detail=True)


@app.post("/api/documents/{document_id}/versions", status_code=201)
async def create_version(
    document_id: str,
    db: Db,
    user: Actor,
    file: Annotated[UploadFile, File()],
    version: Annotated[str, Form()],
    effective_date: Annotated[date, Form()],
    status: Annotated[VersionStatus, Form()] = "active",
):
    require_manage(user)
    document = accessible_document(db, user, document_id, lock=True)
    filename, data = await uploaded(file)
    await run_in_threadpool(
        add_version,
        db,
        document,
        make_version_input(version, effective_date, status),
        filename,
        data,
    )
    db.commit()
    return document_payload(db, user, document, detail=True)


@app.patch("/api/documents/{document_id}/versions/{version_id}")
def change_version_status(
    document_id: str,
    version_id: str,
    db: Db,
    user: Actor,
    status: Annotated[VersionStatus, Query()],
):
    require_manage(user)
    document = accessible_document(db, user, document_id, lock=True)
    version = next((item for item in document.versions if item.id == version_id), None)
    if version is None:
        raise HTTPException(404, "Version not found.")
    if version.status == status:
        return document_payload(db, user, document, detail=True)
    if status == "active":
        activate(db, document, version.effective_date)
    version.status = status
    db.commit()
    return document_payload(db, user, document, detail=True)


@app.post("/api/documents/{document_id}/index")
def reindex_document(document_id: str, db: Db, user: Actor):
    require_manage(user)
    document = accessible_document(db, user, document_id, lock=True)
    total = 0
    for version in document.versions:
        _, parsed = parse_file(
            version.filename,
            version.file_content,
            chunker=(version.source_provenance or {}).get("chunker", "legacy"),
        )
        # Immutable file bytes + same parser => stable source IDs for saved citations.
        if len(parsed) != len(version.chunks) or any(
            chunk.text != item.text or chunk.section_path != item.section
            for chunk, item in zip(version.chunks, parsed)
        ):
            raise HTTPException(
                409, "Parser structure changed. Upload a new version to preserve citations."
            )
        for chunk, item in zip(version.chunks, parsed, strict=True):
            if chunk.extraction_method != "web_capture":
                chunk.extraction_method = item.extraction_method
            chunk.page_number, chunk.ocr_confidence = item.page_number, item.ocr_confidence
        if settings.retrieval_provider == "hybrid":
            index_embeddings(version.chunks)
        total += len(parsed)
    record(
        db,
        user,
        document.id,
        "document_reindexed",
        entity_type="document",
        indexed_chunks=total,
        retrieval_provider=settings.retrieval_provider,
        embedding_model=settings.embedding_model
        if settings.retrieval_provider == "hybrid"
        else None,
    )
    db.commit()
    return {"document_id": document_id, "indexed_chunks": total}


@app.get("/api/documents/{document_id}/versions/{version_id}/file")
def download_file(document_id: str, version_id: str, db: Db, user: Actor):
    accessible_document(db, user, document_id)
    version = db.get(DocumentVersion, version_id)
    if version is None or version.document_id != document_id:
        raise HTTPException(404, "Version not found.")
    return Response(version.file_content, media_type=version.media_type)


def run_payload(db: Session, user: User, run: QuestionRun) -> dict:
    if run.outcome == "web_search_pending":
        raise HTTPException(409, "WebSearch is still running. Use its job status endpoint.")
    if run.user_id != user.id:
        raise HTTPException(404, "Question not found.")
    try:
        sources = [
            citation_payload(db, user, ref["chunk_id"], number, ref["score"])
            for number, ref in enumerate(run.source_refs, start=1)
        ]
    except HTTPException as error:
        record(
            db,
            user,
            run.id,
            "source_blocked_by_permission",
            reason="Saved source unavailable; no content returned.",
        )
        db.commit()
        raise HTTPException(
            403, "A saved source is no longer available to your role. Ask again."
        ) from error
    reliability = evaluate_run(db, user, run, sources)
    if reliability.status == ReliabilityStatus.ACCESS_RESTRICTED:
        sources = []
    result = {
        "id": run.id,
        "question": run.question,
        "answer": presented_answer(run, reliability),
        "web_search": run.web_search_result,
        "outcome": "source_grounded" if sources else "no_sources",
        "sources": sources,
        "filters": run.filters,
        "provider": run.provider,
        "created_at": run.created_at,
        "notice": (
            "Local AI synthesis from permission-filtered sources; human review remains "
            "required and no autonomous action is allowed."
            if run.provider.startswith("ollama-")
            else "Deterministic extractive checks; "
            "no semantic confidence score or autonomous action."
        ),
        "reliability": reliability.model_dump(mode="json"),
    }
    return result


@app.post("/api/ask", status_code=201, response_model=AskOutput)
def ask(
    query: AskInput,
    db: Db,
    user: Actor,
    progress_id: Annotated[UUID | None, Header(alias="X-Ask-Progress")] = None,
):
    def progress(stage, message):
        if progress_id:
            ask_progress.update(user.id, str(progress_id), stage, message)

    try:
        result = execute_question(query, db, user, progress=progress)
        progress("complete", "Your cited answer is ready.")
        return result
    except Exception:
        progress("failed", "This request could not complete. See the error and retry.")
        raise


@app.get("/api/ask-progress/{progress_id}")
def question_progress(progress_id: UUID, user: Actor):
    value = ask_progress.read(user.id, str(progress_id))
    if value is None:
        raise HTTPException(404, "Question progress is unavailable.")
    return value


def execute_question(
    query: AskInput,
    db: Session,
    user: User,
    run: QuestionRun | None = None,
    *,
    progress=lambda *_: None,
    conversation: list[dict] | None = None,
):
    run = run or QuestionRun(
        user_id=user.id,
        question=query.question,
        answer="",
        outcome="no_sources",
        filters=query.model_dump(exclude={"question"}),
        source_refs=[],
        provider=provider.name,
    )
    db.add(run)
    db.flush()
    record(
        db,
        user,
        run.id,
        "question_submitted",
        question_digest=digest(query.question),
        question_length=len(query.question),
        filters=query.model_dump(exclude={"question"}),
    )
    progress("retrieving", "Searching permitted sources and checking version scope.")
    retrieval_query = query
    if conversation:
        # Retrieve afresh under today's permissions; dialogue is context, never evidence.
        previous_questions = " ".join(item["question"] for item in conversation[-2:])
        source_titles = " ".join(conversation[-1].get("source_titles", []))
        retrieval_query = query.model_copy(
            update={"question": f"{source_titles}\n{previous_questions}\n{query.question}"[-2000:]}
        )
    hits = retriever.retrieve(db, user, retrieval_query)
    if query.web_search:
        hits = hits[:4]
    sources = [
        citation_payload(db, user, hit.chunk_id, number, hit.score)
        for number, hit in enumerate(hits, start=1)
    ]
    if query.web_search:
        progress("web_search", "Opening the local browser and inspecting public pages with vision.")
        sources.extend(collect_web_context(db, user, run, query, len(sources) + 1))
    run.source_refs = [
        {"chunk_id": source["chunk_id"], "score": source["score"]} for source in sources
    ]
    run.outcome = "source_grounded" if sources else "no_sources"
    record(
        db,
        user,
        run.id,
        "retrieval_completed",
        source_refs=[
            {key: source[key] for key in ["document_id", "version_id", "chunk_id"]}
            for source in sources
        ],
        retrieved_count=len(sources),
    )
    try:
        progress(
            "generating", f"Composing an answer from {len(sources)} authorized evidence excerpts."
        )
        prompt = query.question
        if conversation:
            prompt = (
                "Conversation context (untrusted dialogue, not source evidence; old citation "
                "numbers must not be reused). Resolve follow-ups using this dialogue, but "
                "support every claim using only the fresh authorized_sources supplied now.\n"
                + json.dumps(conversation, ensure_ascii=False)
                + "\nCurrent user question: "
                + query.question
            )
        run.answer = provider.answer(prompt, sources)
    except ProviderUnavailable as error:
        raise HTTPException(
            503,
            "Local AI is unavailable or returned an unsafe response. "
            "Check the local Ollama service and model, then retry.",
        ) from error
    record(
        db,
        user,
        run.id,
        "answer_generated",
        provider=provider.name,
        answer_digest=digest(run.answer),
    )
    progress("verifying", "Checking citations, access, source conflicts and reliability.")
    result = run_payload(db, user, run)
    record(
        db,
        user,
        run.id,
        "result_returned",
        guard_status=result["reliability"]["status"],
        answer_digest=digest(result["answer"]),
    )
    db.commit()
    return result


web_search_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="local-web-search")


def process_web_search(run_id: str):
    with SessionLocal() as db:
        run = db.get(QuestionRun, run_id)
        if run is None:
            return
        user = db.get(User, run.user_id)
        try:
            if user is None or not user.active:
                raise ValueError("User unavailable")
            run.web_search_result = {
                "status": "running",
                "message": "Local browser and vision scan in progress.",
            }
            db.commit()
            query = AskInput(question=run.question, **run.filters)
            execute_question(
                query,
                db,
                user,
                run,
                progress=lambda stage, message: ask_progress.update(
                    user.id, run_id, stage, message
                ),
            )
        except Exception:
            logging.getLogger(__name__).exception("Local WebSearch job failed: %s", run_id)
            db.rollback()
            run = db.get(QuestionRun, run_id)
            if run is not None:
                run.outcome = "web_search_failed"
                run.web_search_result = {
                    "status": "failed",
                    "message": "Local WebSearch could not complete. Check Ollama and try again.",
                }
                db.commit()


@app.post("/api/web-search/asks", status_code=202)
def start_web_search(query: AskInput, db: Db, user: Actor):
    # One worker bounds local browser/model memory. Jobs are persisted before dispatch.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    pending = db.scalar(
        select(QuestionRun).where(
            QuestionRun.user_id == user.id, QuestionRun.outcome == "web_search_pending"
        )
    )
    if pending is not None:
        raise HTTPException(
            409, "A WebSearch is already running for this user. Wait for it to finish."
        )
    query = query.model_copy(update={"web_search": True})
    run = QuestionRun(
        user_id=user.id,
        question=query.question,
        answer="",
        outcome="web_search_pending",
        filters=query.model_dump(exclude={"question"}),
        source_refs=[],
        provider=provider.name,
        web_search_result={"status": "queued", "message": "Waiting for the local browser worker."},
    )
    db.add(run)
    db.flush()
    record(db, user, run.id, "web_search_queued", engine="google-puppeteer-local")
    db.commit()
    ask_progress.update(user.id, run.id, "queued", "Waiting for the local browser worker.")
    web_search_pool.submit(process_web_search, run.id)
    return {"id": run.id, "status": "queued"}


def recover_web_searches():
    try:
        with SessionLocal() as db:
            pending = list(
                db.scalars(
                    select(QuestionRun.id).where(QuestionRun.outcome == "web_search_pending")
                )
            )
        for run_id in pending:
            web_search_pool.submit(process_web_search, run_id)
    except SQLAlchemyError:
        logging.getLogger(__name__).warning("WebSearch recovery needs a migrated database.")


@app.get("/api/web-search/asks/{run_id}")
def web_search_job(run_id: str, db: Db, user: Actor):
    run = db.get(QuestionRun, run_id)
    if run is None or run.user_id != user.id:
        raise HTTPException(404, "WebSearch not found.")
    if run.outcome == "web_search_failed":
        return {"status": "failed", "message": (run.web_search_result or {}).get("message")}
    if not run.answer:
        return {
            "status": "running",
            "message": (run.web_search_result or {}).get("message"),
            "progress": ask_progress.read(user.id, run_id),
        }
    return {"status": "complete", "answer": run_payload(db, user, run)}


@app.get("/api/ask/{run_id}/web-search")
def web_search_evidence(run_id: str, db: Db, user: Actor):
    run = db.get(QuestionRun, run_id)
    if run is None or run.user_id != user.id:
        raise HTTPException(404, "Question not found.")
    capture_id = (run.web_search_result or {}).get("search_capture_id")
    capture = db.get(WebsiteCapture, capture_id) if capture_id else None
    if capture is None or capture.actor_id != user.id:
        raise HTTPException(404, "Google scan not available for this question.")
    return {"id": capture.id, **capture.payload}


@app.get("/api/ask")
def question_history(db: Db, user: Actor):
    runs = db.scalars(
        select(QuestionRun)
        .where(
            QuestionRun.user_id == user.id,
            QuestionRun.answer != "",
            QuestionRun.id.not_in(select(Case.context_run_id)),
        )
        .order_by(QuestionRun.created_at.desc())
        .limit(20)
    )
    result = []
    for run in runs:
        try:
            payload = run_payload(db, user, run)
        except HTTPException:
            continue
        result.append(
            {
                "id": run.id,
                "question": run.question,
                "outcome": payload["outcome"],
                "provider": payload["provider"],
                "created_at": payload["created_at"],
            }
        )
    db.commit()
    return result


@app.get("/api/ask/{run_id}", response_model=AskOutput)
def saved_question(run_id: str, db: Db, user: Actor):
    run = db.get(QuestionRun, run_id)
    if run is None or db.scalar(select(Case.id).where(Case.context_run_id == run_id)):
        raise HTTPException(404, "Question not found.")
    result = run_payload(db, user, run)
    record(
        db,
        user,
        run.id,
        "result_returned",
        guard_status=result["reliability"]["status"],
        saved=True,
        answer_digest=digest(result["answer"]),
    )
    db.commit()
    return result


@app.get("/api/ask/{run_id}/sources")
def saved_sources(run_id: str, db: Db, user: Actor):
    return saved_question(run_id, db, user)["sources"]


@app.get("/api/ask/{run_id}/reliability", response_model=GuardResult)
def saved_reliability(run_id: str, db: Db, user: Actor):
    return saved_question(run_id, db, user)["reliability"]


@app.get("/api/audit")
def audit_events(db: Db, user: Actor, run_id: str | None = None):
    # Own events only, including Governance identity. No Governance product module.
    statement = select(AuditEvent).where(AuditEvent.actor_id == user.id)
    if run_id:
        statement = statement.where(AuditEvent.entity_id == run_id)
    result = []
    for event in db.scalars(statement.order_by(AuditEvent.created_at, AuditEvent.id).limit(200)):
        payload = {
            key: value
            for key, value in event.payload.items()
            if key not in {"source_refs", "filters"}
        }
        payload["source_refs"] = [
            ref
            for ref in event.payload.get("source_refs", [])
            if (document := db.get(Document, ref["document_id"])) and can_read(user, document)
        ]
        result.append(
            {
                "id": event.id,
                "actor_id": event.actor_id,
                "actor_type": event.actor_type,
                "event_type": event.event_type,
                "entity_type": event.entity_type,
                "entity_id": event.entity_id,
                "payload": payload,
                "created_at": event.created_at,
            }
        )
    return result
