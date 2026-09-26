// Generated from superflow.reliability_contracts. Do not edit status vocabulary.
export const RELIABILITY_STATUSES = [
  "VERIFIED",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "OUTDATED",
  "ACCESS_RESTRICTED",
] as const;
export const GUARD_CHECK_NAMES = [
  "citation_coverage",
  "source_validity",
  "source_authority",
  "version_validity",
  "permission_validity",
  "evidence_completeness",
  "conflict_detection",
  "calculation_validity",
  "human_review_requirement",
] as const;
export const GUARD_ACTIONS = [
  "inspect_sources",
  "inspect_active_version",
  "consult_owner",
] as const;
export type ActiveReplacement = {
  document_id: string;
  version_id: string;
  title: string;
  version: string;
};
export type EvidenceItem = {
  key: string;
  label: string;
  required: boolean;
  status: "available" | "missing" | "conflicting";
  source_refs?: Array<SourceReference>;
  details: string;
};
export type GuardCheckResult = {
  passed: boolean | null;
  applicable?: boolean;
  details: string;
};
export type ReliabilityStatus =
  "VERIFIED" | "REVIEW_REQUIRED" | "BLOCKED" | "OUTDATED" | "ACCESS_RESTRICTED";
export type SourceReference = {
  document_id: string;
  version_id: string;
  chunk_id: string;
  citation_id: number;
};
export type GuardResult = {
  status: ReliabilityStatus;
  checks: Record<
    | "citation_coverage"
    | "source_validity"
    | "source_authority"
    | "version_validity"
    | "permission_validity"
    | "evidence_completeness"
    | "conflict_detection"
    | "calculation_validity"
    | "human_review_requirement",
    GuardCheckResult
  >;
  reasons: Array<string>;
  evidence: Array<EvidenceItem>;
  source_refs: Array<SourceReference>;
  active_replacements: Array<ActiveReplacement>;
  allowed_actions: Array<
    "inspect_sources" | "inspect_active_version" | "consult_owner"
  >;
  summary: string;
  next_step: string;
  policy_version?: string;
  id?: string | null;
  evaluated_at?: string | null;
};
