import type { CaseView, ApprovalView } from "./workflow-contracts.ts";
import { isGuardResult } from "./reliability-view.ts";

export type CaseSummary = Omit<
  CaseView,
  | "reliability"
  | "sources"
  | "evidence"
  | "workflow"
  | "approvals"
  | "activity"
  | "allowed_actions"
>;
export type DecisionAction = ApprovalView["allowed_actions"][number];
export const DECISION_LABELS: Record<DecisionAction, string> = {
  approve: "Approve",
  reject: "Reject",
  "request-evidence": "Request evidence",
  escalate: "Escalate",
  override: "Override",
};
export function stateLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
export function decisionError(
  action: DecisionAction,
  reason: string,
  label: string,
  reviewRequired: boolean,
) {
  if ((action !== "approve" || reviewRequired) && !reason.trim())
    return "Record a reason for this decision.";
  if (action === "request-evidence" && label.trim().length < 3)
    return "Specify the required evidence.";
  return "";
}
export function isCaseView(value: unknown): value is CaseView {
  if (!value || typeof value !== "object") return false;
  const item = value as CaseView;
  return (
    typeof item.id === "string" &&
    Number.isInteger(item.revision) &&
    isGuardResult(item.reliability) &&
    Array.isArray(item.sources) &&
    Array.isArray(item.approvals) &&
    Array.isArray(item.activity) &&
    Array.isArray(item.allowed_actions) &&
    Array.isArray(item.evidence) &&
    (item.reliability.status !== "ACCESS_RESTRICTED" ||
      (item.sources.length === 0 && item.evidence.length === 0))
  );
}
