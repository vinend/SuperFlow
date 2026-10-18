"""Typed synthetic investigation commands; no free-form tool execution."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .workflow_contracts import Mutation


class ToolName(StrEnum):
    CUSTOMER_PROFILE = "get_customer_profile"
    TRANSACTIONS = "summarize_transactions"
    WATCHLIST = "run_watchlist_screening"
    ADVERSE_NEWS = "search_adverse_news"


class SyntheticToolRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_reference: str = Field(min_length=3, max_length=80)
    fixture: Literal["complete", "failed_evidence", "conflict"]


class CustomerProfileResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_name: str = Field(min_length=2, max_length=150)
    occupation: str = Field(max_length=500)
    declared_source_of_funds: str = Field(max_length=1000)
    profile_baseline: str = Field(max_length=1000)


class TransactionSample(BaseModel):
    model_config = ConfigDict(extra="forbid")
    time: str
    type: str
    amount: int
    context: str


class TransactionSummaryResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    count: int = Field(ge=0)
    window_hours: int = Field(gt=0)
    alerted_value_idr: int = Field(ge=0)
    new_beneficiaries: int = Field(ge=0)
    sample: list[TransactionSample] = Field(max_length=200)
    narrative: str = Field(max_length=4000)


class WatchlistResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    exact_match: bool
    possible_name_similarity: bool
    provider: Literal["synthetic-watchlist-v1"]


class AdverseNewsResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate_articles: int = Field(ge=0)
    identity_confirmed: bool
    provider: Literal["synthetic-news-v1"]


TOOL_RESULT_SCHEMAS = {
    ToolName.CUSTOMER_PROFILE: CustomerProfileResult,
    ToolName.TRANSACTIONS: TransactionSummaryResult,
    ToolName.WATCHLIST: WatchlistResult,
    ToolName.ADVERSE_NEWS: AdverseNewsResult,
}


class AgentAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    next_action: ToolName | None
    evidence_requirement: str | None
    reason: str = Field(min_length=3, max_length=300)
    stop: bool


class RecommendationInput(Mutation):
    notes: str = Field(default="", max_length=4000)
    recommendation: str = Field(min_length=10, max_length=4000)


class InvestigationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario: Literal["complete", "failed_evidence", "conflict"] = "complete"
    intake: "InvestigationIntake | None" = None


class InvestigationIntake(BaseModel):
    model_config = ConfigDict(extra="forbid")
    alert_reference: str = Field(min_length=3, max_length=60)
    subject_reference: str = Field(min_length=3, max_length=80)
    profile: CustomerProfileResult
    transactions: TransactionSummaryResult
    record_source: str = Field(min_length=10, max_length=500)
    screening_urls: list[str] = Field(default_factory=list, max_length=2)
    news_urls: list[str] = Field(default_factory=list, max_length=2)
    indicators: list[str] = Field(default_factory=list, max_length=20)
    sample_data: bool = False


class BrowserSource(BaseModel):
    url: str = Field(max_length=2048)
    title: str = Field(max_length=300)
    excerpt: str = Field(min_length=20, max_length=6000)
    capture_id: str
    checksum: str


class BrowserScreeningResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: Literal["google-puppeteer-vision"] = "google-puppeteer-vision"
    query: str = Field(max_length=200)
    search_capture_id: str | None = None
    discovery: Literal["google", "analyst-selected-urls"]
    candidate_count: int = Field(ge=0, le=2)
    sources: list[BrowserSource] = Field(min_length=1, max_length=2)
    identity_confirmed: Literal[False] = False
    coverage: str = (
        "Bounded public-web research; not exhaustive sanctions or adverse-media screening."
    )


class ToolInput(Mutation):
    pass
