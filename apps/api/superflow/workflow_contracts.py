"""Canonical workflow vocabulary; reliability and evidence stay in Guard contracts."""

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .reliability_contracts import EvidenceItem, GuardResult, ReliabilityStatus
from .schemas import Citation


class CaseStatus(StrEnum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_FOR_EVIDENCE = "WAITING_FOR_EVIDENCE"
    WAITING_FOR_REVIEW = "WAITING_FOR_REVIEW"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class WorkflowStatus(StrEnum):
    RUNNING = "RUNNING"
    WAITING_FOR_EVIDENCE = "WAITING_FOR_EVIDENCE"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    FAILED = "FAILED"
    ESCALATED = "ESCALATED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class StepType(StrEnum):
    TASK = "TASK"
    GUARD = "GUARD"
    APPROVAL = "APPROVAL"
    CONDITION = "CONDITION"
    TERMINAL = "TERMINAL"


class StepStatus(StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    WAITING = "WAITING"
    FAILED = "FAILED"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"


class TaskStatus(StrEnum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class ApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EVIDENCE_REQUESTED = "EVIDENCE_REQUESTED"
    ESCALATED = "ESCALATED"
    OVERRIDDEN = "OVERRIDDEN"


CaseType = Literal[
    "general",
    "regulatory_review",
    "remediation",
    "investment",
    "audit",
    "operations",
    "aml_investigation",
]
DecisionAction = Literal["approve", "reject", "request-evidence", "escalate", "override"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CaseCreate(Input):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=4000)
    type: CaseType = "general"
    owner_id: str | None = None
    question_run_id: str | None = None
    allow_recovery: bool = False
    chunk_ids: list[str] = Field(default_factory=list, max_length=30)


class Mutation(Input):
    expected_revision: int = Field(ge=0)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=80)
    reason: str = Field(default="", max_length=2000)


class CasePatch(Mutation):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    owner_id: str | None = None
    cancel: bool = False


class EvidenceAdd(Mutation):
    chunk_ids: list[str] = Field(min_length=1, max_length=30)
    requirement_key: str | None = None


class DecisionInput(Mutation):
    evidence_label: str | None = Field(default=None, min_length=3, max_length=200)


class WorkflowStart(Mutation):
    case_id: str


class StepConfig(BaseModel):
    id: str
    title: str
    type: StepType
    next: str | None = None
    reviewer_role: str = "manager"
    max_retries: int = Field(default=0, ge=0, le=5)
    fallback: str | None = None
    review_next: str | None = None


class DefinitionConfig(BaseModel):
    steps: list[StepConfig]


class DefinitionView(BaseModel):
    id: str
    name: str
    version: str
    domain: str
    config: DefinitionConfig


class TaskView(BaseModel):
    id: str
    case_id: str
    workflow_run_id: str
    step_id: str
    title: str
    description: str
    owner_id: str
    status: TaskStatus
    due_at: datetime
    created_at: datetime
    completed_at: datetime | None
    allowed_actions: list[Literal["start", "complete"]]


class AttemptView(BaseModel):
    id: str
    number: int
    outcome: StepStatus
    reason: str
    actor_id: str
    guard_id: str | None
    created_at: datetime


class StepView(BaseModel):
    id: str
    key: str
    title: str
    type: StepType
    status: StepStatus
    owner_id: str | None
    retry_count: int
    started_at: datetime | None
    completed_at: datetime | None
    attempts: list[AttemptView]


class WorkflowView(BaseModel):
    id: str
    case_id: str
    definition_id: str
    definition_name: str
    definition_version: str
    current_step: str
    status: WorkflowStatus
    escalation_reason: str | None
    escalated_by: str | None
    escalated_at: datetime | None
    created_at: datetime
    completed_at: datetime | None
    steps: list[StepView]
    tasks: list[TaskView]
    allowed_actions: list[Literal["advance", "retry", "escalate"]]


class ApprovalView(BaseModel):
    id: str
    case_id: str
    case_title: str
    workflow_run_id: str
    step_id: str
    requested_from: str
    requested_by: str
    requested_role: str
    status: ApprovalStatus
    decision_reason: str | None
    override_reason: str | None
    decided_by: str | None
    requested_at: datetime
    decided_at: datetime | None
    reason_required: str
    allowed_actions: list[DecisionAction]


class ActivityView(BaseModel):
    id: str
    actor_id: str
    event_type: str
    payload: dict
    created_at: datetime


class CaseSummary(BaseModel):
    id: str
    type: CaseType
    title: str
    description: str
    status: CaseStatus
    owner_id: str
    created_by: str
    revision: int
    question_run_id: str | None
    workflow_run_id: str | None
    reliability_status: ReliabilityStatus
    created_at: datetime
    updated_at: datetime


class CaseView(CaseSummary):
    reliability: GuardResult
    sources: list[Citation]
    evidence: list[EvidenceItem]
    workflow: WorkflowView | None
    approvals: list[ApprovalView]
    activity: list[ActivityView]
    allowed_actions: list[Literal["edit", "attach_evidence", "start_workflow", "cancel"]]


class WorkflowContracts(BaseModel):
    case: CaseView
    definition: DefinitionView
