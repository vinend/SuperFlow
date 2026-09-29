// Generated from superflow.analytics_contracts. Do not edit.
export type ActionLink = {
  label: string;
  description: string;
  href:
    | "/ask"
    | "/knowledge"
    | "/cases"
    | "/decisions"
    | "/regulatory"
    | "/investment";
};
export type BreakdownItem = {
  key: string;
  label: string;
  count: number;
  percent: number;
  tone?: "positive" | "attention" | "blocked" | "neutral";
};
export type CapacitySimulationComponent = {
  type: "CapacitySimulation";
  data: CapacitySimulationData;
};
export type CapacitySimulationData = {
  title: string;
  disclosure: "Illustrative simulation";
  description: string;
  metrics: Array<ImpactMetric>;
  assumptions: Array<string>;
};
export type DistributionChartComponent = {
  type: "DistributionChart";
  data: DistributionData;
};
export type DistributionData = {
  title: string;
  description: string;
  items: Array<BreakdownItem>;
};
export type ImpactBriefComponent = {
  type: "ImpactBrief";
  data: ImpactBriefData;
};
export type ImpactBriefData = {
  eyebrow: string;
  title: string;
  summary: string;
  highlights: Array<string>;
};
export type ImpactFocus = "overview" | "quality" | "capacity" | "delivery";
export type ImpactMetric = {
  key: string;
  label: string;
  value: number | null;
  unit: "count" | "percent" | "minutes" | "hours" | "days" | "IDR";
  kind: MetricKind;
  detail: string;
  method: string;
  numerator?: number | null;
  denominator?: number | null;
};
export type ImpactWorkspace = {
  focus: ImpactFocus;
  question: string;
  answer: string;
  scope: string;
  data_through: string;
  provider: string;
  notice: string;
  components: Array<
    | ImpactBriefComponent
    | MetricGroupComponent
    | DistributionChartComponent
    | CapacitySimulationComponent
    | NextActionsComponent
  >;
};
export type MetricGroupComponent = {
  type: "MetricGroup";
  data: MetricGroupData;
};
export type MetricGroupData = {
  category: "quality" | "capacity" | "delivery";
  title: string;
  description: string;
  metrics: Array<ImpactMetric>;
};
export type MetricKind = "observed" | "illustrative_simulation";
export type NextActionsComponent = {
  type: "NextActions";
  data: NextActionsData;
};
export type NextActionsData = {
  title: string;
  actions: Array<ActionLink>;
};
