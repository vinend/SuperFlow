from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import record
from .auth import can_read, current_user, require_manage
from .config import settings
from .db import get_db
from .embeddings import content_hash, index_embeddings
from .models import Document, User

router = APIRouter(prefix="/api/rag", tags=["RAG document management"])


@router.get("/status")
def status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_manage(user)
    result = []
    for document in db.scalars(
        select(Document).where(Document.context_run_id.is_(None)).order_by(Document.title)
    ):
        if not can_read(user, document):
            continue
        chunks = [c for v in document.versions for c in v.chunks]
        ready = sum(
            any(
                e.model == settings.embedding_model and e.content_hash == content_hash(c)
                for e in c.embeddings
            )
            for c in chunks
        )
        result.append(
            {
                "id": document.id,
                "title": document.title,
                "chunks": len(chunks),
                "indexed": ready,
                "ready": bool(chunks) and ready == len(chunks),
            }
        )
    return {
        "engine": settings.retrieval_engine,
        "model": settings.embedding_model,
        "documents": result,
        "total_chunks": sum(d["chunks"] for d in result),
        "indexed_chunks": sum(d["indexed"] for d in result),
    }


class IndexInput(BaseModel):
    document_id: str = Field(max_length=40)


@router.post("/index")
def index(value: IndexInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_manage(user)
    document = db.scalar(select(Document).where(Document.id == value.document_id).with_for_update())
    if not document or document.context_run_id or not can_read(user, document):
        raise HTTPException(404, "Document not found or unavailable to this role.")
    count = index_embeddings([c for v in document.versions for c in v.chunks])
    record(
        db,
        user,
        document.id,
        "document_embeddings_indexed",
        entity_type="document",
        indexed_chunks=count,
        model=settings.embedding_model,
    )
    db.commit()
    return {"document_id": document.id, "indexed_chunks": count}
