import json
from datetime import date
from pathlib import PurePath
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .analytics_api import router as analytics_router
from .audit import record
from .auth import can_read, current_user, require_manage
from .config import settings
from .db import get_db
from .investment_api import router as investment_router
from .knowledge import (
    accessible_document,
    activate,
    add_version,
    citation_payload,
    document_payload,
    validate_metadata,
)
from .models import AuditEvent, Case, Document, DocumentVersion, QuestionRun, User
from .parsing import MAX_BYTES, ParseError, parse_file
from .providers import AnswerProvider, ProviderUnavailable, configured_answer_provider
from .regulatory_api import router as regulatory_router
from .reliability import digest, evaluate_run, presented_answer
from .reliability_contracts import GuardResult, ReliabilityStatus
from .retrieval import KeywordConceptRetriever, Retriever
from .schemas import AskInput, AskOutput, Metadata, VersionInput, VersionStatus
from .workflow_api import router as workflow_router

app = FastAPI(
    title="SuperFlow Knowledge API",
    version="0.6.0",
    description="Phase 0–6 prototype. X-User-Id is mock authentication only.",
)
app.include_router(workflow_router)
app.include_router(regulatory_router)
app.include_router(investment_router)
app.include_router(analytics_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "X-User-Id"],
)
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]
retriever: Retriever = KeywordConceptRetriever()
provider: AnswerProvider = configured_answer_provider(settings)


@app.exception_handler(ParseError)
async def parse_error(_, error: ParseError):
    return JSONResponse(status_code=422, content={"detail": str(error)})


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
        "scope": "phase-0-6",
        "inference_provider": provider.name,
        "inference_model": settings.ollama_model if settings.llm_provider == "ollama" else None,
    }


@app.get("/api/users")
def users(db: Db):
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
        for document in db.scalars(select(Document).order_by(Document.title))
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
    add_version(db, document, version_input, filename, data)
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
    add_version(db, document, make_version_input(version, effective_date, status), filename, data)
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
        _, parsed = parse_file(version.filename, version.file_content)
        # Immutable file bytes + same parser => stable source IDs for saved citations.
        if len(parsed) != len(version.chunks):
            raise HTTPException(
                409, "Parser structure changed. Upload a new version to preserve citations."
            )
        for chunk, item in zip(version.chunks, parsed, strict=True):
            chunk.section_path, chunk.text = item.section, item.text
        total += len(parsed)
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
def ask(query: AskInput, db: Db, user: Actor):
    run = QuestionRun(
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
    hits = retriever.retrieve(db, user, query)
    sources = [
        citation_payload(db, user, hit.chunk_id, number, hit.score)
        for number, hit in enumerate(hits, start=1)
    ]
    run.source_refs = [{"chunk_id": hit.chunk_id, "score": hit.score} for hit in hits]
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
        run.answer = provider.answer(query.question, sources)
    except ProviderUnavailable as error:
        raise HTTPException(
            503,
            "Local AI is unavailable or returned an unsafe response. "
            "Check the Ollama container and model, then retry.",
        ) from error
    record(
        db,
        user,
        run.id,
        "answer_generated",
        provider=provider.name,
        answer_digest=digest(run.answer),
    )
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


@app.get("/api/ask")
def question_history(db: Db, user: Actor):
    runs = db.scalars(
        select(QuestionRun)
        .where(QuestionRun.user_id == user.id, QuestionRun.id.not_in(select(Case.context_run_id)))
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
