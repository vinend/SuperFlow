// Generated from superflow.investment_contracts. Do not edit.
import type { GuardResult } from "./reliability-contracts";
import type { Source as Citation } from "./api";
import type {
  ActivityView,
  CaseStatus,
  WorkflowStatus,
} from "./workflow-contracts";
export type AnalysisPhase =
  | "MISSING_INFORMATION"
  | "CONFLICTS"
  | "READY_TO_SUBMIT"
  | "IN_APPROVAL"
  | "INFORMATION_REQUESTED"
  | "APPROVED"
  | "CLOSED";
export type ApprovalRouteView = {
  threshold: number;
  route: "manager" | "committee";
  label: string;
  source: Citation;
};
export type AssumptionView = {
  id: string;
  key:
    | "initial_investment"
    | "annual_inflow"
    | "periods"
    | "discount_rate"
    | "approval_threshold";
  label: string;
  value: number;
  unit: "IDR" | "years" | "percent";
  period: "one-time" | "annual" | "term" | "per investment";
  quote: string;
  source: Citation;
};
export type CalculationView = {
  investment: number;
  annual_inflow: number;
  periods: number;
  discount_rate: number;
  cash_flows: Array<number>;
  metrics: Array<MetricView>;
  steps: Array<number>;
  sensitivity: Array<SensitivityRow>;
};
export type DocumentRef = {
  document_id: string;
  title: string;
  version: string;
};
export type InputView = {
  key:
    | "initial_investment"
    | "annual_inflow"
    | "periods"
    | "discount_rate"
    | "approval_threshold";
  label: string;
  required: boolean;
  status: "consistent" | "conflict" | "resolved" | "missing";
  value: number | null;
  unit: "IDR" | "years" | "percent";
  assumptions: Array<AssumptionView>;
  selection: SelectionView | null;
};
export type InvestmentSummary = {
  id: string;
  title: string;
  proposal_document_id: string;
  proposal_title: string;
  proposal_version: string;
  phase: AnalysisPhase;
  status: CaseStatus;
  workflow_status: WorkflowStatus | null;
  created_by: string;
  revision: number;
  created_at: string;
  updated_at: string;
  conflict_count: number;
  missing_count: number;
  npv: number | null;
};
export type InvestmentView = {
  id: string;
  title: string;
  proposal_document_id: string;
  proposal_title: string;
  proposal_version: string;
  phase: AnalysisPhase;
  status: CaseStatus;
  workflow_status: WorkflowStatus | null;
  created_by: string;
  revision: number;
  created_at: string;
  updated_at: string;
  conflict_count: number;
  missing_count: number;
  npv: number | null;
  extractor: string;
  reliability: GuardResult;
  supporting: Array<DocumentRef>;
  inputs: Array<InputView>;
  calculation: CalculationView | null;
  approval_route: ApprovalRouteView | null;
  memo: string;
  memo_edited: boolean;
  submitted_at: string | null;
  reviewer_id: string | null;
  activity: Array<ActivityView>;
  allowed_actions: Array<
    "select" | "edit_memo" | "submit" | "provide_information"
  >;
};
export type MetricView = {
  key: "npv" | "irr" | "roi" | "payback_years" | "break_even_inflow";
  label: string;
  value: number | null;
  unit: "IDR" | "percent" | "years" | "IDR per year";
  period: string;
  formula: string;
  note: string;
};
export type ProposalSourceView = {
  document_id: string;
  title: string;
  version: string;
  effective_date: string;
  related: Array<DocumentRef>;
  open_analysis_id: string | null;
};
export type SelectionView = {
  assumption_id: string;
  reason: string;
  selected_by: string;
  selected_at: string;
};
export type SensitivityRow = {
  variable: "investment" | "annual_inflow" | "rate";
  label: string;
  npv: Array<number>;
};
