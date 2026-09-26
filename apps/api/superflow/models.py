import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def identifier() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    permissions: Mapped[list[str]] = mapped_column(JSON)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    department: Mapped[str] = mapped_column(String(100))
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"))
    active: Mapped[bool] = mapped_column(default=True)
    role: Mapped[Role] = relationship()


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (CheckConstraint("authority_level BETWEEN 1 AND 5"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    title: Mapped[str] = mapped_column(String(200))
    domain: Mapped[str] = mapped_column(String(50))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    authority_level: Mapped[int]
    access_roles: Mapped[list[str]] = mapped_column(JSON)
    related_document_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    owner: Mapped[User] = relationship()
    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentVersion.created_at",
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version", name="uq_document_version"),
        CheckConstraint("status IN ('active', 'outdated', 'draft')"),
        Index(
            "uq_active_version",
            "document_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
            sqlite_where=text("status = 'active'"),
        ),
    )
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    version: Mapped[str] = mapped_column(String(30))
    effective_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20))
    filename: Mapped[str] = mapped_column(String(200))
    media_type: Mapped[str] = mapped_column(String(100))
    checksum: Mapped[str] = mapped_column(String(64))
    file_content: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    document: Mapped[Document] = relationship(back_populates="versions")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        cascade="all, delete-orphan", order_by="DocumentChunk.ordinal"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (UniqueConstraint("version_id", "ordinal"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    version_id: Mapped[str] = mapped_column(ForeignKey("document_versions.id", ondelete="CASCADE"))
    ordinal: Mapped[int]
    section_path: Mapped[str] = mapped_column(String(300))
    text: Mapped[str] = mapped_column(Text)


class QuestionRun(Base):
    __tablename__ = "question_runs"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    outcome: Mapped[str] = mapped_column(String(30))
    filters: Mapped[dict] = mapped_column(JSON)
    source_refs: Mapped[list[dict]] = mapped_column(JSON)
    provider: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
