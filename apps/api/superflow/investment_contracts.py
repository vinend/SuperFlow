"""Investment Intelligence contracts. Frontend types are generated from this module."""

from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from .reliability_contracts import GuardResult
from .schemas import Citation
from .workflow_contracts import ActivityView, CaseStatus, Input, Mutation, WorkflowStatus

AssumptionKey = Literal[
    "initial_investment", "annual_inflow", "periods", "discount_rate", "approval_threshold"
]
Unit = Literal["IDR", "years", "percent"]


class AnalysisPhase(StrEnum):
    MISSING_INFORMATION = "MISSING_INFORMATION"
    CONFLICTS = "CONFLICTS"
    READY_TO_SUBMIT = "READY_TO_SUBMIT"
    IN_APPROVAL = "IN_APPROVAL"
    INFORMATION_REQUESTED = "INFORMATION_REQUESTED"
    APPROVED = "APPROVED"
    CLOSED = "CLOSED"


class DocumentRef(BaseModel):
    document_id: str
    title: str
    version: str


class AssumptionView(BaseModel):
    id: str
    key: AssumptionKey
    label: str
    value: float
    unit: Unit
    period: Literal["one-time", "annual", "term", "per investment"]
    quote: str
    source: Citation


class SelectionView(BaseModel):
    assumption_id: str
    reason: str
    selected_by: str
    selected_at: datetime


class InputView(BaseModel):
    key: AssumptionKey
    label: str
    required: bool
    status: Literal["consistent", "conflict", "resolved", "missing"]
    value: float | None
    unit: Unit
    assumptions: list[AssumptionView]
    selection: SelectionView | None


class MetricView(BaseModel):
    key: Literal["npv", "irr", "roi", "payback_years", "break_even_inflow"]
    label: str
    value: float | None
    unit: Literal["IDR", "percent", "years", "IDR per year"]
    period: str
    formula: str
    note: str


class SensitivityRow(BaseModel):
    variable: Literal["investment", "annual_inflow", "rate"]
    label: str
    npv: list[float]


class CalculationView(BaseModel):
    investment: float
    annual_inflow: float
    periods: int
    discount_rate: float
    cash_flows: list[float]
    metrics: list[MetricView]
    steps: list[float]
    sensitivity: list[SensitivityRow]


class ApprovalRouteView(BaseModel):
    threshold: float
    route: Literal["manager", "committee"]
    label: str
    source: Citation


class ProposalSourceView(BaseModel):
    document_id: str
    title: str
    version: str
    effective_date: date
    related: list[DocumentRef]
    open_analysis_id: str | None


class InvestmentSummary(BaseModel):
    id: str
    title: str
    proposal_document_id: str
    proposal_title: str
    proposal_version: str
    phase: AnalysisPhase
    status: CaseStatus
    workflow_status: WorkflowStatus | None
    created_by: str
    revision: int
    created_at: datetime
    updated_at: datetime
    conflict_count: int
    missing_count: int
    npv: float | None


class InvestmentView(InvestmentSummary):
    extractor: str
    reliability: GuardResult
    supporting: list[DocumentRef]
    inputs: list[InputView]
    calculation: CalculationView | None
    approval_route: ApprovalRouteView | None
    memo: str
    memo_edited: bool
    submitted_at: datetime | None
    reviewer_id: str | None
    activity: list[ActivityView]
    allowed_actions: list[Literal["select", "edit_memo", "submit", "provide_information"]]


class AnalysisCreate(Input):
    proposal_document_id: str = Field(min_length=1, max_length=40)
    supporting_document_ids: list[str] | None = Field(default=None, max_length=10)


class AssumptionSelect(Mutation):
    assumption_id: str = Field(min_length=1, max_length=80)


class MemoUpdate(Mutation):
    memo: str = Field(min_length=20, max_length=8000)


class InvestmentContracts(BaseModel):
    source: ProposalSourceView
    summary: InvestmentSummary
    analysis: InvestmentView
