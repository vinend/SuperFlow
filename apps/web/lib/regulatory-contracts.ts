// Generated from superflow.regulatory_contracts. Do not edit.
import type { GuardResult } from "./reliability-contracts";
import type { Source as Citation } from "./api";
import type {
  ActivityView,
  CaseStatus,
  WorkflowStatus,
} from "./workflow-contracts";
export type ChangeView = {
  key: string;
  section: string;
  change_type: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
  material: boolean;
  summary: string;
  requirement_changes: Array<RequirementChange>;
  new_obligations: Array<string>;
  previous: Citation | null;
  current: Citation | null;
  impacts: Array<ImpactView>;
};
export type FindingStatus = "PROPOSED" | "CONFIRMED" | "REJECTED";
export type FindingView = {
  id: string;
  change_key: string;
  section: string;
  status: FindingStatus;
  basis: "explicit_reference" | "topic_match";
  impacted: Citation;
  requirement: Citation;
  issues: Array<GapIssue>;
  proposed_summary: string;
  reviewer_summary: string | null;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  suggested_owner_id: string;
  remediation: RemediationView | null;
  allowed_actions: Array<"confirm" | "reject" | "reassign">;
};
export type GapIssue = {
  kind: "requirement_mismatch" | "missing_obligation";
  detail: string;
  current?: string | null;
  required?: string | null;
};
export type ImpactView = {
  source: Citation;
  basis: "explicit_reference" | "topic_match";
  aligned: boolean;
};
export type RegulatoryReviewSummary = {
  id: string;
  title: string;
  document_id: string;
  document_title: string;
  previous: VersionRef;
  current: VersionRef;
  phase: ReviewPhase;
  status: CaseStatus;
  created_by: string;
  revision: number;
  created_at: string;
  updated_at: string;
  change_count: number;
  material_count: number;
  finding_count: number;
  pending_count: number;
  confirmed_count: number;
  remediation_total: number;
  remediation_completed: number;
};
export type RegulatoryReviewView = {
  id: string;
  title: string;
  document_id: string;
  document_title: string;
  previous: VersionRef;
  current: VersionRef;
  phase: ReviewPhase;
  status: CaseStatus;
  created_by: string;
  revision: number;
  created_at: string;
  updated_at: string;
  change_count: number;
  material_count: number;
  finding_count: number;
  pending_count: number;
  confirmed_count: number;
  remediation_total: number;
  remediation_completed: number;
  comparator: string;
  reliability: GuardResult;
  changes: Array<ChangeView>;
  findings: Array<FindingView>;
  activity: Array<ActivityView>;
  allowed_actions: Array<"complete">;
};
export type RegulatorySourceView = {
  document_id: string;
  title: string;
  owner: string;
  current: VersionRef;
  previous: VersionRef;
  open_review_id: string | null;
};
export type RemediationView = {
  case_id: string;
  title: string;
  status: CaseStatus;
  workflow_status: WorkflowStatus | null;
  owner_id: string;
  reviewer_id: string | null;
  due_date: string;
};
export type RequirementChange = {
  kind: "frequency" | "deadline" | "duration";
  before: string | null;
  after: string | null;
};
export type ReviewPhase =
  "GAP_REVIEW" | "REMEDIATION" | "READY_TO_CLOSE" | "COMPLETED" | "CANCELLED";
export type VersionRef = {
  id: string;
  version: string;
  status: "active" | "outdated" | "draft";
  effective_date: string;
};
