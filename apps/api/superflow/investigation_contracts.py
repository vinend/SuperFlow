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
    customer_name: str
    occupation: str
    declared_source_of_funds: str
    profile_baseline: str


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
    sample: list[TransactionSample]
    narrative: str


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


class ToolInput(Mutation):
    pass
