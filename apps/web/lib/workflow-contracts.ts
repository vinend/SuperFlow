// Generated from superflow.workflow_contracts. Do not edit.
import type {
  GuardResult,
  EvidenceItem,
  ReliabilityStatus,
} from "./reliability-contracts";
import type { Source as Citation } from "./api";
export type ActivityView = {
  id: string;
  actor_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};
export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EVIDENCE_REQUESTED"
  | "ESCALATED"
  | "OVERRIDDEN";
export type ApprovalView = {
  id: string;
  case_id: string;
  case_title: string;
  workflow_run_id: string;
  step_id: string;
  requested_from: string;
  requested_by: string;
  requested_role: string;
  status: ApprovalStatus;
  decision_reason: string | null;
  override_reason: string | null;
  decided_by: string | null;
  requested_at: string;
  decided_at: string | null;
  reason_required: string;
  allowed_actions: Array<
    "approve" | "reject" | "request-evidence" | "escalate" | "override"
  >;
};
export type AttemptView = {
  id: string;
  number: number;
  outcome: StepStatus;
  reason: string;
  actor_id: string;
  guard_id: string | null;
  created_at: string;
};
export type CaseStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_EVIDENCE"
  | "WAITING_FOR_REVIEW"
  | "COMPLETED"
  | "CANCELLED";
export type CaseView = {
  id: string;
  type:
    | "general"
    | "regulatory_review"
    | "remediation"
    | "investment"
    | "audit"
    | "operations"
    | "aml_investigation";
  title: string;
  description: string;
  status: CaseStatus;
  owner_id: string;
  created_by: string;
  revision: number;
  question_run_id: string | null;
  workflow_run_id: string | null;
  reliability_status: ReliabilityStatus;
  created_at: string;
  updated_at: string;
  reliability: GuardResult;
  sources: Array<Citation>;
  evidence: Array<EvidenceItem>;
  workflow: WorkflowView | null;
  approvals: Array<ApprovalView>;
  activity: Array<ActivityView>;
  allowed_actions: Array<
    "edit" | "attach_evidence" | "start_workflow" | "cancel"
  >;
};
export type DefinitionConfig = {
  steps: Array<StepConfig>;
};
export type DefinitionView = {
  id: string;
  name: string;
  version: string;
  domain: string;
  config: DefinitionConfig;
};
export type StepConfig = {
  id: string;
  title: string;
  type: StepType;
  next?: string | null;
  reviewer_role?: string;
  max_retries?: number;
  fallback?: string | null;
  review_next?: string | null;
};
export type StepStatus =
  | "PENDING"
  | "ACTIVE"
  | "WAITING"
  | "FAILED"
  | "COMPLETED"
  | "SKIPPED"
  | "CANCELLED";
export type StepType = "TASK" | "GUARD" | "APPROVAL" | "CONDITION" | "TERMINAL";
export type StepView = {
  id: string;
  key: string;
  title: string;
  type: StepType;
  status: StepStatus;
  owner_id: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  attempts: Array<AttemptView>;
};
export type TaskStatus =
  "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type TaskView = {
  id: string;
  case_id: string;
  workflow_run_id: string;
  step_id: string;
  title: string;
  description: string;
  owner_id: string;
  status: TaskStatus;
  due_at: string;
  created_at: string;
  completed_at: string | null;
  allowed_actions: Array<"start" | "complete">;
};
export type WorkflowStatus =
  | "RUNNING"
  | "WAITING_FOR_EVIDENCE"
  | "WAITING_FOR_APPROVAL"
  | "FAILED"
  | "ESCALATED"
  | "COMPLETED"
  | "CANCELLED";
export type WorkflowView = {
  id: string;
  case_id: string;
  definition_id: string;
  definition_name: string;
  definition_version: string;
  current_step: string;
  status: WorkflowStatus;
  escalation_reason: string | null;
  escalated_by: string | null;
  escalated_at: string | null;
  created_at: string;
  completed_at: string | null;
  steps: Array<StepView>;
  tasks: Array<TaskView>;
  allowed_actions: Array<"advance" | "retry" | "escalate">;
};
