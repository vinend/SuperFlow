import type {
  ChangeView,
  FindingView,
  RegulatoryReviewSummary,
  RegulatoryReviewView,
  ReviewPhase,
} from "./regulatory-contracts.ts";
import { isGuardResult } from "./reliability-view.ts";

// Business language for Regulatory Review. Backend owns phase, status and actions.
export const PHASE_LABELS: Record<ReviewPhase, string> = {
  GAP_REVIEW: "Gap review",
  REMEDIATION: "Remediation in progress",
  READY_TO_CLOSE: "Ready to close",
  COMPLETED: "Completed",
  CANCELLED: "Closed",
};
export const FINDING_LABELS: Record<FindingView["status"], string> = {
  PROPOSED: "Needs your decision",
  CONFIRMED: "Confirmed gap",
  REJECTED: "Not a gap",
};
export const CHANGE_LABELS: Record<ChangeView["change_type"], string> = {
  ADDED: "New section",
  REMOVED: "Removed section",
  MODIFIED: "Changed",
  UNCHANGED: "No change",
};
export const BASIS_LABELS: Record<FindingView["basis"], string> = {
  explicit_reference: "References this article",
  topic_match: "Covers the same topic",
};

export function phaseNextAction(summary: RegulatoryReviewSummary) {
  if (summary.phase === "GAP_REVIEW")
    return `Decide ${summary.pending_count} proposed gap${summary.pending_count === 1 ? "" : "s"}`;
  if (summary.phase === "REMEDIATION")
    return `Track remediation · ${summary.remediation_completed} of ${summary.remediation_total} complete`;
  if (summary.phase === "READY_TO_CLOSE") return "Close review";
  return "View outcome";
}

export function needsAttention(summary: RegulatoryReviewSummary) {
  return summary.phase === "GAP_REVIEW" || summary.phase === "READY_TO_CLOSE";
}

export function remediationLabel(finding: FindingView) {
  const item = finding.remediation;
  if (!item) return null;
  if (item.status === "COMPLETED") return "Remediation approved";
  if (item.status === "CANCELLED") return "Remediation closed — reassign";
  if (item.workflow_status === "WAITING_FOR_APPROVAL")
    return "Waiting for remediation approval";
  if (item.workflow_status === "WAITING_FOR_EVIDENCE")
    return "Waiting for supporting information";
  if (item.workflow_status === "ESCALATED") return "Escalated for review";
  return "Remediation in progress";
}

export function defaultDueDate(from = new Date(), days = 30) {
  const due = new Date(from);
  due.setDate(due.getDate() + days);
  return localDate(due);
}

export function localDate(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function confirmError(
  owner: string,
  dueDate: string,
  summary: string,
  today = localDate(new Date()),
) {
  if (!owner) return "Choose a remediation owner.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < today)
    return "Choose a due date of today or later.";
  if (summary.trim() && summary.trim().length < 10)
    return "Describe the gap in at least 10 characters.";
  return "";
}

// Validate the payload before rendering; restricted context must carry no content.
export function isRegulatoryReviewView(
  value: unknown,
): value is RegulatoryReviewView {
  if (!value || typeof value !== "object") return false;
  const item = value as RegulatoryReviewView;
  return (
    typeof item.id === "string" &&
    Number.isInteger(item.revision) &&
    item.phase in PHASE_LABELS &&
    isGuardResult(item.reliability) &&
    Array.isArray(item.changes) &&
    Array.isArray(item.findings) &&
    Array.isArray(item.activity) &&
    Array.isArray(item.allowed_actions) &&
    item.findings.every(
      (finding) =>
        finding.status in FINDING_LABELS &&
        Array.isArray(finding.issues) &&
        Array.isArray(finding.allowed_actions) &&
        typeof finding.impacted?.chunk_id === "string" &&
        typeof finding.requirement?.chunk_id === "string",
    ) &&
    (item.reliability.status !== "ACCESS_RESTRICTED" ||
      (item.changes.length === 0 && item.findings.length === 0))
  );
}
