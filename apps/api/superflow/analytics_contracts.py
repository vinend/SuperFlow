"""Phase 6 impact analytics and controlled generative workspace contracts."""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ImpactFocus(StrEnum):
    OVERVIEW = "overview"
    QUALITY = "quality"
    CAPACITY = "capacity"
    DELIVERY = "delivery"


class MetricKind(StrEnum):
    OBSERVED = "observed"
    ILLUSTRATIVE_SIMULATION = "illustrative_simulation"


class ImpactMetric(BaseModel):
    key: str
    label: str
    value: float | None
    unit: Literal["count", "percent", "minutes", "hours", "days", "IDR"]
    kind: MetricKind
    detail: str
    method: str
    numerator: int | None = None
    denominator: int | None = None


class BreakdownItem(BaseModel):
    key: str
    label: str
    count: int
    percent: float
    tone: Literal["positive", "attention", "blocked", "neutral"] = "neutral"


class ImpactBriefData(BaseModel):
    eyebrow: str
    title: str
    summary: str
    highlights: list[str]


class ImpactBriefComponent(BaseModel):
    type: Literal["ImpactBrief"]
    data: ImpactBriefData


class MetricGroupData(BaseModel):
    category: Literal["quality", "capacity", "delivery"]
    title: str
    description: str
    metrics: list[ImpactMetric]


class MetricGroupComponent(BaseModel):
    type: Literal["MetricGroup"]
    data: MetricGroupData


class DistributionData(BaseModel):
    title: str
    description: str
    items: list[BreakdownItem]


class DistributionChartComponent(BaseModel):
    type: Literal["DistributionChart"]
    data: DistributionData


class CapacitySimulationData(BaseModel):
    title: str
    disclosure: Literal["Illustrative simulation"]
    description: str
    metrics: list[ImpactMetric]
    assumptions: list[str]


class CapacitySimulationComponent(BaseModel):
    type: Literal["CapacitySimulation"]
    data: CapacitySimulationData


class ActionLink(BaseModel):
    label: str
    description: str
    href: Literal["/ask", "/knowledge", "/cases", "/decisions", "/regulatory", "/investment"]


class NextActionsData(BaseModel):
    title: str
    actions: list[ActionLink]


class NextActionsComponent(BaseModel):
    type: Literal["NextActions"]
    data: NextActionsData


ImpactComponent = Annotated[
    ImpactBriefComponent
    | MetricGroupComponent
    | DistributionChartComponent
    | CapacitySimulationComponent
    | NextActionsComponent,
    Field(discriminator="type"),
]


class ImpactQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    question: str = Field(min_length=3, max_length=500)


class ImpactWorkspace(BaseModel):
    focus: ImpactFocus
    question: str
    answer: str
    scope: str
    data_through: datetime
    provider: str
    notice: str
    components: list[ImpactComponent]


class AnalyticsContracts(BaseModel):
    workspace: ImpactWorkspace
