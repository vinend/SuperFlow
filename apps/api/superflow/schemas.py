from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .reliability_contracts import GuardResult

Domain = Literal["People", "Compliance", "Finance", "Operations", "Governance"]
VersionStatus = Literal["active", "outdated", "draft"]
ROLE_IDS = {"employee", "manager", "sme", "compliance", "finance", "governance"}


class Metadata(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    domain: Domain
    owner_id: str = Field(min_length=1, max_length=40)
    authority_level: int = Field(ge=1, le=5)
    access_roles: list[str] = Field(min_length=1, max_length=6)
    related_document_ids: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Title must contain at least three non-whitespace characters.")
        return value

    @field_validator("access_roles")
    @classmethod
    def valid_roles(cls, value: list[str]) -> list[str]:
        if not set(value) <= ROLE_IDS:
            raise ValueError("Unknown access role.")
        return sorted(set(value))


class VersionInput(BaseModel):
    version: str = Field(min_length=1, max_length=30, pattern=r"^[\w.\-]+$")
    effective_date: date
    status: VersionStatus = "active"


class AskInput(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    domain: Domain | None = None
    document_ids: list[str] = Field(default_factory=list, max_length=30)
    include_outdated: bool = False
    web_search: bool = False
    web_query: str | None = Field(default=None, min_length=3, max_length=200)
    web_urls: list[str] = Field(default_factory=list, max_length=2)

    @field_validator("question")
    @classmethod
    def meaningful_question(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Enter a question with at least three characters.")
        return value


class Citation(BaseModel):
    publisher: str | None = None
    jurisdiction: str | None = None
    usage_scope: str | None = None
    source_origin: Literal["knowledge_base", "internet"] = "knowledge_base"
    media_type: str | None = None
    capture_engine: Literal["puppeteer"] | None = None
    vision_model: str | None = None
    source_url: str | None = None
    legal_status: str | None = None
    citation_id: int = Field(ge=1)
    document_id: str
    version_id: str
    chunk_id: str
    title: str
    domain: Domain
    version: str
    status: VersionStatus
    effective_date: date
    owner: str
    authority_level: int = Field(ge=1, le=5)
    section_path: str
    excerpt: str
    score: float
    extraction_method: Literal["native", "pdf_text", "ocr", "mixed", "web_capture", "vision"] = (
        "native"
    )
    page_number: int | None = Field(default=None, ge=1)
    ocr_confidence: float | None = Field(default=None, ge=0, le=1)


class AskOutput(BaseModel):
    web_search: dict | None = None
    id: str
    question: str
    answer: str
    outcome: Literal["source_grounded", "no_sources"]
    sources: list[Citation]
    filters: dict
    provider: str
    created_at: datetime
    notice: str
    reliability: GuardResult
