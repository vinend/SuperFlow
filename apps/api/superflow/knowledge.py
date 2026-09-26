import hashlib
import uuid
from datetime import date, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import can_read
from .models import Document, DocumentChunk, DocumentVersion, User
from .parsing import ParsedChunk, parse_file
from .schemas import Metadata, VersionInput


def accessible_document(db: Session, user: User, document_id: str, lock=False) -> Document:
    statement = select(Document).where(Document.id == document_id)
    if lock:
        statement = statement.with_for_update()
    document = db.scalar(statement)
    if document is None or not can_read(user, document):
        # Identical result for unknown and inaccessible identifiers.
        raise HTTPException(404, "Document not found or unavailable to this role.")
    return document


def validate_metadata(db: Session, user: User, metadata: Metadata) -> None:
    owner = db.get(User, metadata.owner_id)
    if owner is None or not owner.active:
        raise HTTPException(422, "Choose an active document owner.")
    if user.role_id != "governance" and user.role_id not in metadata.access_roles:
        raise HTTPException(422, "Keep your managing role in the document access list.")
    for document_id in metadata.related_document_ids:
        accessible_document(db, user, document_id)


def version_payload(version: DocumentVersion) -> dict:
    return {
        "id": version.id,
        "version": version.version,
        "status": version.status,
        "effective_date": version.effective_date,
        "filename": version.filename,
        "media_type": version.media_type,
        "checksum": version.checksum,
        "chunk_count": len(version.chunks),
        "created_at": version.created_at,
    }


def document_payload(db: Session, user: User, document: Document, detail=False) -> dict:
    if not can_read(user, document):
        raise HTTPException(404, "Document not found or unavailable to this role.")
    visible_related = [
        related_id
        for related_id in document.related_document_ids
        if (related := db.get(Document, related_id)) is not None and can_read(user, related)
    ]
    versions = sorted(
        document.versions,
        key=lambda version: version.created_at.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    result = {
        "id": document.id,
        "title": document.title,
        "domain": document.domain,
        "owner_id": document.owner_id,
        "owner_name": document.owner.name,
        "authority_level": document.authority_level,
        "access_roles": document.access_roles,
        "related_document_ids": visible_related,
        "created_at": document.created_at,
        "versions": [version_payload(version) for version in versions],
    }
    if detail:
        result["versions"] = [
            {
                **version_payload(version),
                "chunks": [
                    {"id": chunk.id, "section_path": chunk.section_path, "text": chunk.text}
                    for chunk in version.chunks
                ],
            }
            for version in versions
        ]
    return result


def index_chunks(version: DocumentVersion, chunks: list[ParsedChunk]) -> None:
    version.chunks = [
        DocumentChunk(
            id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{version.id}:{number}")),
            ordinal=number,
            section_path=chunk.section,
            text=chunk.text,
        )
        for number, chunk in enumerate(chunks)
    ]


def activate(db: Session, document: Document, effective_date: date) -> None:
    if effective_date > date.today():
        raise HTTPException(422, "A future-effective version must remain draft until effective.")
    for current in document.versions:
        if current.status == "active":
            current.status = "outdated"
    db.flush()


def add_version(
    db: Session,
    document: Document,
    version_input: VersionInput,
    filename: str,
    data: bytes,
) -> DocumentVersion:
    if any(version.version == version_input.version for version in document.versions):
        raise HTTPException(409, "This document already has that version label.")
    media_type, chunks = parse_file(filename, data)
    if version_input.status == "active":
        activate(db, document, version_input.effective_date)
    version = DocumentVersion(
        id=str(uuid.uuid4()),
        document_id=document.id,
        **version_input.model_dump(),
        filename=filename,
        media_type=media_type,
        checksum=hashlib.sha256(data).hexdigest(),
        file_content=data,
    )
    index_chunks(version, chunks)
    document.versions.append(version)
    db.flush()
    return version


def citation_payload(
    db: Session,
    user: User,
    chunk_id: str,
    citation_id: int,
    score: float = 0,
) -> dict:
    chunk = db.get(DocumentChunk, chunk_id)
    if chunk is None:
        raise HTTPException(409, "A cited chunk is unavailable. Ask the question again.")
    version = db.get(DocumentVersion, chunk.version_id)
    document = accessible_document(db, user, version.document_id)
    return {
        "citation_id": citation_id,
        "document_id": document.id,
        "version_id": version.id,
        "chunk_id": chunk.id,
        "title": document.title,
        "domain": document.domain,
        "version": version.version,
        "status": version.status,
        "effective_date": version.effective_date,
        "owner": document.owner.name,
        "authority_level": document.authority_level,
        "section_path": chunk.section_path,
        "excerpt": chunk.text,
        "score": round(score, 4),
    }
