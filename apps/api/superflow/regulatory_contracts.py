"""Regulation-to-Action contracts. Frontend types are generated from this module."""

from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from .reliability_contracts import GuardResult
from .schemas import Citation
from .workflow_contracts import ActivityView, CaseStatus, Input, Mutation, WorkflowStatus


class FindingStatus(StrEnum):
    PROPOSED = "PROPOSED"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


class ReviewPhase(StrEnum):
    GAP_REVIEW = "GAP_REVIEW"
    REMEDIATION = "REMEDIATION"
    READY_TO_CLOSE = "READY_TO_CLOSE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


ChangeType = Literal["ADDED", "REMOVED", "MODIFIED", "UNCHANGED"]
IssueKind = Literal["requirement_mismatch", "missing_obligation"]
MappingBasis = Literal["explicit_reference", "topic_match"]


class RequirementChange(BaseModel):
    kind: Literal["frequency", "deadline", "duration"]
    before: str | None
    after: str | None


class GapIssue(BaseModel):
    kind: IssueKind
    detail: str
    current: str | None = None
    required: str | None = None


class ImpactView(BaseModel):
    source: Citation
    basis: MappingBasis
    aligned: bool


class ChangeView(BaseModel):
    key: str
    section: str
    change_type: ChangeType
    material: bool
    summary: str
    requirement_changes: list[RequirementChange]
    new_obligations: list[str]
    previous: Citation | None
    current: Citation | None
    impacts: list[ImpactView]


class RemediationView(BaseModel):
    case_id: str
    title: str
    status: CaseStatus
    workflow_status: WorkflowStatus | None
    owner_id: str
    reviewer_id: str | None
    due_date: date


class FindingView(BaseModel):
    id: str
    change_key: str
    section: str
    status: FindingStatus
    basis: MappingBasis
    impacted: Citation
    requirement: Citation
    issues: list[GapIssue]
    proposed_summary: str
    reviewer_summary: str | None
    decision_reason: str | None
    decided_by: str | None
    decided_at: datetime | None
    suggested_owner_id: str
    remediation: RemediationView | None
    allowed_actions: list[Literal["confirm", "reject", "reassign"]]


class VersionRef(BaseModel):
    id: str
    version: str
    status: Literal["active", "outdated", "draft"]
    effective_date: date


class RegulatorySourceView(BaseModel):
    document_id: str
    title: str
    owner: str
    current: VersionRef
    previous: VersionRef
    open_review_id: str | None


class RegulatoryReviewSummary(BaseModel):
    id: str
    title: str
    document_id: str
    document_title: str
    previous: VersionRef
    current: VersionRef
    phase: ReviewPhase
    status: CaseStatus
    created_by: str
    revision: int
    created_at: datetime
    updated_at: datetime
    change_count: int
    material_count: int
    finding_count: int
    pending_count: int
    confirmed_count: int
    remediation_total: int
    remediation_completed: int


class RegulatoryReviewView(RegulatoryReviewSummary):
    comparator: str
    reliability: GuardResult
    changes: list[ChangeView]
    findings: list[FindingView]
    activity: list[ActivityView]
    allowed_actions: list[Literal["complete"]]


class ReviewCreate(Input):
    document_id: str = Field(min_length=1, max_length=40)
    base_version_id: str | None = Field(default=None, max_length=40)


class FindingConfirm(Mutation):
    summary: str | None = Field(default=None, min_length=10, max_length=2000)
    owner_id: str = Field(min_length=1, max_length=40)
    due_date: date


class RegulatoryContracts(BaseModel):
    source: RegulatorySourceView
    summary: RegulatoryReviewSummary
    review: RegulatoryReviewView
