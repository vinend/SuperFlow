import type { GuardResult, EvidenceItem } from "./reliability-contracts";

export type InvestigationView = {
  id: string;
  alert_reference: string;
  template: {
    id: string;
    version: string;
    required: Record<string, string>;
    optional: Record<string, string>;
  };
  scenario: "complete" | "failed_evidence" | "conflict" | "submitted";
  subject_reference: string;
  context: {
    customer_name: string;
    triage_level: "HIGH" | "MEDIUM" | "LOW" | "UNASSESSED";
    indicators: string[];
    synthetic: boolean;
  };
  draft_summary: string;
  evidence: EvidenceItem[];
  provenance: Record<
    string,
    {
      tool_run_id: string;
      tool_name: string;
      collected_at: string;
      fingerprint: string;
    }
  >;
  tool_runs: {
    id: string;
    tool_name: string;
    status: string;
    attempt_number: number;
    result: Record<string, unknown>;
    error_code: string | null;
    error_summary: string | null;
    started_at: string;
    completed_at: string | null;
  }[];
  reliability: GuardResult;
  analyst_notes: string;
  analyst_recommendation: string;
  submitted_at: string | null;
  completed_at: string | null;
  status: string;
  revision: number;
  owner_id: string;
  workflow_run_id: string | null;
  approval_id: string | null;
  approval_status: string | null;
  activity: {
    id: string;
    actor_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }[];
  next_action: {
    next_action: string | null;
    reason: string;
    stop: boolean;
  } | null;
};
