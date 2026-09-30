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
    event,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .regulatory_contracts import FindingStatus
from .reliability_contracts import ReliabilityStatus
from .workflow_contracts import ApprovalStatus, CaseStatus, StepStatus, TaskStatus, WorkflowStatus


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


class GuardEvaluation(Base):
    __tablename__ = "guard_results"
    __table_args__ = (
        CheckConstraint(
            "status IN (" + ",".join(repr(item.value) for item in ReliabilityStatus) + ")",
            name="ck_guard_status",
        ),
    )
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("question_runs.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(30))
    result: Mapped[dict] = mapped_column(JSON)
    fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    actor_id: Mapped[str] = mapped_column(String(40), index=True)
    actor_type: Mapped[str] = mapped_column(String(30), default="user")
    event_type: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40), default="question_run")
    entity_id: Mapped[str] = mapped_column(String(40), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


@event.listens_for(AuditEvent, "before_update")
@event.listens_for(AuditEvent, "before_delete")
def prevent_audit_mutation(*_):
    raise ValueError("Audit events are append-only.")


def status_constraint(vocabulary, name):
    return CheckConstraint(
        "status IN (" + ",".join(repr(item.value) for item in vocabulary) + ")", name=name
    )


class Case(Base):
    __tablename__ = "cases"
    __table_args__ = (status_constraint(CaseStatus, "ck_case_status"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default=CaseStatus.OPEN)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    question_run_id: Mapped[str | None] = mapped_column(ForeignKey("question_runs.id"))
    context_run_id: Mapped[str] = mapped_column(ForeignKey("question_runs.id"))
    reliability_status: Mapped[str] = mapped_column(String(30))
    guard_id: Mapped[str | None] = mapped_column(ForeignKey("guard_results.id"))
    revision: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CaseEvidence(Base):
    """Persist the existing EvidenceItem contract, not a second evidence vocabulary."""

    __tablename__ = "case_evidence"
    __table_args__ = (UniqueConstraint("case_id", "key"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(100))
    item: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"
    __table_args__ = (UniqueConstraint("name", "version"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    version: Mapped[str] = mapped_column(String(30))
    domain: Mapped[str] = mapped_column(String(50))
    config: Mapped[dict] = mapped_column(JSON)


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    __table_args__ = (status_constraint(WorkflowStatus, "ck_workflow_status"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), unique=True)
    definition_id: Mapped[str] = mapped_column(ForeignKey("workflow_definitions.id"))
    config: Mapped[dict] = mapped_column(JSON)
    current_step: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(30), default=WorkflowStatus.RUNNING)
    escalation_reason: Mapped[str | None] = mapped_column(Text)
    escalated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    __table_args__ = (
        UniqueConstraint("workflow_run_id", "key"),
        status_constraint(StepStatus, "ck_step_status"),
    )
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    workflow_run_id: Mapped[str] = mapped_column(ForeignKey("workflow_runs.id"))
    key: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default=StepStatus.PENDING)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    retry_count: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StepAttempt(Base):
    __tablename__ = "step_attempts"
    __table_args__ = (UniqueConstraint("step_id", "number"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    step_id: Mapped[str] = mapped_column(ForeignKey("workflow_steps.id"))
    number: Mapped[int]
    outcome: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    guard_id: Mapped[str | None] = mapped_column(ForeignKey("guard_results.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (status_constraint(TaskStatus, "ck_task_status"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    workflow_run_id: Mapped[str] = mapped_column(ForeignKey("workflow_runs.id"))
    step_id: Mapped[str] = mapped_column(ForeignKey("workflow_steps.id"), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(30), default=TaskStatus.TODO)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Approval(Base):
    __tablename__ = "approvals"
    __table_args__ = (status_constraint(ApprovalStatus, "ck_approval_status"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    workflow_run_id: Mapped[str] = mapped_column(ForeignKey("workflow_runs.id"))
    step_id: Mapped[str] = mapped_column(ForeignKey("workflow_steps.id"))
    requested_from: Mapped[str] = mapped_column(ForeignKey("users.id"))
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    requested_role: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default=ApprovalStatus.PENDING)
    reason_required: Mapped[str] = mapped_column(Text)
    decision_reason: Mapped[str | None] = mapped_column(Text)
    override_reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RegulatoryReview(Base):
    """Domain snapshot of one regulation comparison; the Case owns access, audit and revision."""

    __tablename__ = "regulatory_reviews"
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"))
    base_version_id: Mapped[str] = mapped_column(ForeignKey("document_versions.id"))
    target_version_id: Mapped[str] = mapped_column(ForeignKey("document_versions.id"), index=True)
    comparator: Mapped[str] = mapped_column(String(80))
    changes: Mapped[list[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RegulatoryFinding(Base):
    __tablename__ = "regulatory_findings"
    __table_args__ = (
        UniqueConstraint("review_id", "key"),
        status_constraint(FindingStatus, "ck_finding_status"),
    )
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    review_id: Mapped[str] = mapped_column(ForeignKey("regulatory_reviews.case_id"), index=True)
    key: Mapped[str] = mapped_column(String(200))
    change_key: Mapped[str] = mapped_column(String(100))
    target_chunk_id: Mapped[str] = mapped_column(ForeignKey("document_chunks.id"))
    impacted_chunk_id: Mapped[str] = mapped_column(ForeignKey("document_chunks.id"))
    basis: Mapped[str] = mapped_column(String(30))
    issues: Mapped[list[dict]] = mapped_column(JSON)
    proposed_summary: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=FindingStatus.PROPOSED)
    reviewer_summary: Mapped[str | None] = mapped_column(Text)
    decision_reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    remediation_owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    remediation_due_date: Mapped[date | None] = mapped_column(Date)
    remediation_case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class InvestmentAnalysis(Base):
    """Domain snapshot of one investment analysis; the Case owns access, audit and revision."""

    __tablename__ = "investment_analyses"
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), primary_key=True)
    proposal_document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"))
    proposal_version_id: Mapped[str] = mapped_column(ForeignKey("document_versions.id"), index=True)
    supporting: Mapped[list[dict]] = mapped_column(JSON)
    extractor: Mapped[str] = mapped_column(String(80))
    assumptions: Mapped[list[dict]] = mapped_column(JSON)
    selections: Mapped[dict] = mapped_column(JSON, default=dict)
    memo: Mapped[str | None] = mapped_column(Text)
    submitted: Mapped[dict | None] = mapped_column(JSON)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Investigation(Base):
    """Synthetic FIU context; Case owns authority, revision and workflow state."""

    __tablename__ = "investigations"
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), primary_key=True)
    alert_reference: Mapped[str] = mapped_column(String(80), unique=True)
    template_id: Mapped[str] = mapped_column(String(80))
    scenario: Mapped[str] = mapped_column(String(30))
    subject_reference: Mapped[str] = mapped_column(String(80))
    context_data: Mapped[dict] = mapped_column(JSON)
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    analyst_notes: Mapped[str] = mapped_column(Text, default="")
    analyst_recommendation: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ToolRun(Base):
    """One immutable attempt at an allowlisted synthetic evidence tool."""

    __tablename__ = "investigation_tool_runs"
    __table_args__ = (UniqueConstraint("investigation_id", "tool_name", "attempt_number"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    investigation_id: Mapped[str] = mapped_column(ForeignKey("investigations.case_id"), index=True)
    tool_name: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20))
    attempt_number: Mapped[int]
    request_metadata: Mapped[dict] = mapped_column(JSON)
    result_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_summary: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ActionReceipt(Base):
    __tablename__ = "action_receipts"
    __table_args__ = (UniqueConstraint("case_id", "actor_id", "key"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=identifier)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    key: Mapped[str] = mapped_column(String(80))
    fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
