"""Canonical, persistable Phase 2 contract. Frontend types are generated from this module."""

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class ReliabilityStatus(StrEnum):
    VERIFIED = "VERIFIED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    BLOCKED = "BLOCKED"
    OUTDATED = "OUTDATED"
    ACCESS_RESTRICTED = "ACCESS_RESTRICTED"


CheckName = Literal[
    "citation_coverage",
    "source_validity",
    "source_authority",
    "version_validity",
    "permission_validity",
    "evidence_completeness",
    "conflict_detection",
    "calculation_validity",
    "human_review_requirement",
]


class SourceReference(BaseModel):
    document_id: str
    version_id: str
    chunk_id: str
    citation_id: int


class GuardCheckResult(BaseModel):
    passed: bool | None
    applicable: bool = True
    details: str


class EvidenceItem(BaseModel):
    key: str
    label: str
    required: bool
    status: Literal["available", "missing", "conflicting"]
    source_refs: list[SourceReference] = Field(default_factory=list)
    details: str


class ActiveReplacement(BaseModel):
    document_id: str
    version_id: str
    title: str
    version: str


class GuardResult(BaseModel):
    status: ReliabilityStatus
    checks: dict[CheckName, GuardCheckResult]
    reasons: list[str]
    evidence: list[EvidenceItem]
    source_refs: list[SourceReference]
    active_replacements: list[ActiveReplacement]
    allowed_actions: list[Literal["inspect_sources", "inspect_active_version", "consult_owner"]]
    summary: str
    next_step: str
    policy_version: str = "guard-extractive-v1"
    id: str | None = None
    evaluated_at: datetime | None = None
