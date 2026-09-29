import type { Answer, User } from "./api.ts";
import type {
  ApprovalView,
  CaseView,
  WorkflowView,
  ActivityView,
} from "./workflow-contracts.ts";
import type { CaseSummary } from "./workflow-view.ts";

export const ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  sme: "Subject Matter Expert",
  compliance: "Compliance",
  finance: "Finance",
  governance: "Governance Admin",
};
export function roleLabel(role: string) {
  return ROLE_LABELS[role] || "Team member";
}
export function personName(id: string | null, users: User[]) {
  return (
    users.find((person) => person.id === id)?.name ||
    (id === "system" ? "SuperFlow" : "Team member")
  );
}
export function reviewsLabel(role: string) {
  return role === "sme" ? "Reviews" : "Reviews / Approvals";
}
export function canReview(role: string) {
  return ["manager", "sme", "compliance", "finance", "governance"].includes(
    role,
  );
}
export function canViewImpact(role: string) {
  return ["manager", "sme", "compliance", "finance", "governance"].includes(
    role,
  );
}
export function navigationFor(role: string) {
  return [
    { title: "Home", href: "/", view: "home" },
    ...(role !== "governance"
      ? [{ title: "Ask SuperFlow", href: "/ask", view: "ask" }]
      : []),
    { title: "Knowledge", href: "/knowledge", view: "knowledge" },
    ...(role === "compliance"
      ? [
          {
            title: "Regulatory Review",
            href: "/regulatory",
            view: "regulatory",
          },
        ]
      : []),
    ...(role === "finance"
      ? [
          {
            title: "Investment Analysis",
            href: "/investment",
            view: "investment",
          },
        ]
      : []),
    { title: "My Work", href: "/cases", view: "cases" },
    ...(canReview(role)
      ? [{ title: reviewsLabel(role), href: "/decisions", view: "decisions" }]
      : []),
    ...(canViewImpact(role)
      ? [{ title: "Impact", href: "/impact", view: "impact" }]
      : []),
  ];
}

const STATES: Record<string, string> = {
  OPEN: "Ready to submit",
  IN_PROGRESS: "In progress",
  RUNNING: "In progress",
  WAITING_FOR_EVIDENCE: "Waiting for information",
  WAITING_FOR_REVIEW: "Waiting for review",
  WAITING_FOR_APPROVAL: "Waiting for review",
  REVIEW_REQUIRED: "Needs review",
  BLOCKED: "More information required",
  VERIFIED: "Verified",
  OUTDATED: "Historical source",
  ACCESS_RESTRICTED: "Access restricted",
  COMPLETED: "Completed",
  CANCELLED: "Closed",
  ESCALATED: "Escalated for review",
  FAILED: "Needs attention",
  TODO: "Ready to begin",
  DONE: "Completed",
  PENDING: "Waiting",
  ACTIVE: "In progress",
  WAITING: "Waiting",
  SKIPPED: "Not needed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EVIDENCE_REQUESTED: "Information requested",
  OVERRIDDEN: "Approved with exception",
};
export function businessStatus(value: string) {
  return STATES[value] || "Needs attention";
}
export const WORK_TYPES: Record<CaseView["type"], string> = {
  general: "Request",
  operations: "Operations review",
  audit: "Policy review",
  regulatory_review: "Regulatory review",
  remediation: "Remediation",
  investment: "Investment analysis",
};
export function workTitle(title: string) {
  if (/^Demo A — Annual leave review(?: inspection \d+)?$/.test(title))
    return "Annual Leave Review";
  if (/^Demo B — Missing supporting evidence(?: inspection \d+)?$/.test(title))
    return "Supporting Evidence Request";
  if (/^Demo C — Access review conflict/.test(title))
    return "Access Review Clarification";
  if (/^Synthetic authority inspection \d+$/.test(title))
    return "Policy Review";
  if (/^Synthetic retry inspection \d+$/.test(title))
    return "Supporting Evidence Review";
  return title;
}
export type WorkProgressView = {
  key: string;
  label: string;
  status: string;
  current: boolean;
  ownerId: string | null;
  timestamp: string | null;
  attempts: WorkflowView["steps"][number]["attempts"];
};
export function progressFor(
  run: WorkflowView | null,
  reviewerRole?: string,
): WorkProgressView[] {
  if (!run) return [];
  // Domain definitions carry business-language step titles; the generic review maps them.
  const generic =
    (run.definition_id || "generic-review-v1") === "generic-review-v1";
  // Routing is an internal operation. Show only the relevant review branch.
  const activeReview =
    run.steps.find(
      (s) =>
        s.type === "APPROVAL" &&
        (s.key === run.current_step ||
          ["ACTIVE", "WAITING", "COMPLETED"].includes(s.status)),
    ) ||
    run.steps.find((s) => s.key === "human_review" && s.status === "PENDING");
  return run.steps
    .filter(
      (s) =>
        s.type !== "CONDITION" &&
        (s.type !== "APPROVAL" || s.id === activeReview?.id),
    )
    .map((s) => ({
      key: s.key,
      label: !generic
        ? s.title
        : s.type === "TASK"
          ? "Prepare supporting information"
          : s.type === "GUARD"
            ? s.status === "COMPLETED"
              ? "Evidence checked"
              : "Check evidence"
            : s.type === "TERMINAL"
              ? "Complete"
              : reviewerRole && reviewerRole !== "manager"
                ? `${roleLabel(reviewerRole)} review`
                : s.key === "human_review"
                  ? "Manager review"
                  : "Specialist review",
      status: s.status === "PENDING" ? "Not started" : businessStatus(s.status),
      current: run.current_step === s.key,
      ownerId: s.owner_id,
      timestamp: s.completed_at || s.started_at,
      attempts: s.attempts,
    }));
}
export type WorkItemView = {
  id: string;
  href: string;
  title: string;
  type: string;
  status: string;
  currentStep: string;
  nextAction: string;
  ownerId: string;
  reviewerId: string | null;
  dueAt: string | null;
  reliability: string;
  updatedAt: string;
  progress: WorkProgressView[];
  needsAttention: boolean;
};
export function workItemsFor(
  cases: CaseSummary[],
  runs: WorkflowView[],
  approvals: ApprovalView[],
  user: User,
): WorkItemView[] {
  return cases
    .map((item) => {
      const run = runs.find((r) => r.case_id === item.id) || null;
      const review = approvals.find(
        (a) => a.case_id === item.id && a.status === "PENDING",
      );
      const task = run?.tasks.find((t) => t.allowed_actions.length > 0);
      const own = [item.owner_id, item.created_by].includes(user.id);
      const assigned = approvals.some(
        (a) => a.case_id === item.id && a.requested_from === user.id,
      );
      if (
        !own &&
        !assigned &&
        !task &&
        !review?.allowed_actions.length &&
        user.role_id !== "governance"
      )
        return null;
      if (item.type === "regulatory_review" && !run) {
        // Regulatory reviews progress through gap decisions in their own workspace.
        const terminal = ["COMPLETED", "CANCELLED"].includes(item.status);
        return {
          id: item.id,
          href: `/regulatory?review=${encodeURIComponent(item.id)}`,
          title: workTitle(item.title),
          type: WORK_TYPES[item.type],
          status: businessStatus(item.status),
          currentStep: terminal ? "Complete" : "Gap review and remediation",
          nextAction: terminal ? "View outcome" : "Open regulatory review",
          ownerId: item.owner_id,
          reviewerId: null,
          dueAt: null,
          reliability: businessStatus(item.reliability_status),
          updatedAt: item.updated_at,
          progress: [],
          needsAttention: own && !terminal,
        };
      }
      const analysisHref = `/investment?analysis=${encodeURIComponent(item.id)}`;
      if (item.type === "investment" && !run) {
        // Analyses are prepared in Investment Analysis until they are submitted.
        const terminal = ["COMPLETED", "CANCELLED"].includes(item.status);
        return {
          id: item.id,
          href: analysisHref,
          title: workTitle(item.title),
          type: WORK_TYPES[item.type],
          status: businessStatus(item.status),
          currentStep: terminal ? "Complete" : "Analysis in preparation",
          nextAction: terminal ? "View outcome" : "Open investment analysis",
          ownerId: item.owner_id,
          reviewerId: null,
          dueAt: null,
          reliability: businessStatus(item.reliability_status),
          updatedAt: item.updated_at,
          progress: [],
          needsAttention: own && !terminal,
        };
      }
      const progress = progressFor(run, review?.requested_role);
      const currentStep =
        progress.find((s) => s.current)?.label ||
        (item.status === "COMPLETED" ? "Complete" : "Request prepared");
      const terminal = ["COMPLETED", "CANCELLED"].includes(item.status);
      const waitingInfo = item.status === "WAITING_FOR_EVIDENCE";
      const needsAttention =
        !terminal &&
        Boolean(
          review?.allowed_actions.length ||
          task ||
          (own &&
            (!run || waitingInfo || run.allowed_actions.includes("retry"))),
        );
      const nextAction = terminal
        ? "View outcome"
        : review?.allowed_actions.length
          ? "Review request"
          : task
            ? item.type === "remediation"
              ? "Update procedure or control"
              : "Check supporting information"
            : waitingInfo && own
              ? "Provide information"
              : !run && own
                ? "Submit for review"
                : run?.allowed_actions.includes("retry")
                  ? "Try evidence check again"
                  : "View progress";
      return {
        id: item.id,
        href:
          item.type === "investment" && !review?.allowed_actions.length
            ? analysisHref
            : `/cases?case=${encodeURIComponent(item.id)}`,
        title: workTitle(item.title),
        type: WORK_TYPES[item.type],
        status: businessStatus(
          run?.status === "ESCALATED" || run?.status === "FAILED"
            ? run.status
            : item.status,
        ),
        currentStep,
        nextAction,
        ownerId: item.owner_id,
        reviewerId: review?.requested_from || null,
        dueAt:
          run?.tasks.find((t) => !["DONE", "CANCELLED"].includes(t.status))
            ?.due_at || null,
        reliability: businessStatus(item.reliability_status),
        updatedAt: item.updated_at,
        progress,
        needsAttention,
      };
    })
    .filter((item): item is WorkItemView => item !== null);
}
export type ReviewItemView = {
  approval: ApprovalView;
  work: WorkItemView | undefined;
};
export function reviewItemsFor(
  approvals: ApprovalView[],
  work: WorkItemView[],
  role: string,
): ReviewItemView[] {
  if (!canReview(role)) return [];
  return approvals
    .filter((a) => a.status === "PENDING" && a.allowed_actions.length > 0)
    .map((approval) => ({
      approval,
      work: work.find((w) => w.id === approval.case_id),
    }));
}
export function askAction(
  answer: Pick<Answer, "question" | "reliability"> & {
    sources?: Pick<Answer["sources"][number], "document_id" | "domain">[];
  },
  role?: string,
): { label: string; title: string; href?: string } | null {
  if (answer.reliability.status === "ACCESS_RESTRICTED") return null;
  if (
    role === "compliance" &&
    /regulat/i.test(answer.question) &&
    /chang|new|compar|differ|updat|amend|impact|gap/i.test(answer.question)
  ) {
    const regulation = answer.sources?.find((s) => s.domain === "Compliance");
    return {
      label: "Start Regulatory Review",
      title: "Regulatory Review",
      href: regulation
        ? `/regulatory?document=${encodeURIComponent(regulation.document_id)}`
        : "/regulatory",
    };
  }
  if (
    role === "finance" &&
    /proposal|investment|assumption|npv|irr|roi|payback|cash.?flow/i.test(
      answer.question,
    )
  ) {
    const proposal = answer.sources?.find((s) => s.domain === "Finance");
    return {
      label: "Prepare Analysis",
      title: "Investment Analysis",
      href: proposal
        ? `/investment?document=${encodeURIComponent(proposal.document_id)}`
        : "/investment",
    };
  }
  if (
    /expense|reimburse|receipt/i.test(answer.question) &&
    /without|missing|lost|exception/i.test(answer.question)
  )
    return {
      label: "Request Exception",
      title: "Expense Reimbursement Exception",
    };
  if (/expense|reimburse|receipt/i.test(answer.question))
    return { label: "Request Review", title: "Expense Reimbursement Review" };
  if (/annual leave/i.test(answer.question))
    return { label: "Request Review", title: "Annual Leave Review" };
  if (/access.*review|review.*access/i.test(answer.question))
    return { label: "Start Review", title: "Access Review Clarification" };
  return {
    label:
      answer.reliability.status === "BLOCKED"
        ? "Provide Information"
        : "Start Review",
    title:
      answer.reliability.status === "BLOCKED"
        ? "Supporting Evidence Request"
        : "Policy Review",
  };
}
const EVENTS: Record<string, string> = {
  case_created: "Request prepared",
  case_updated: "Request details updated",
  case_cancelled: "Request closed",
  workflow_started: "Request submitted",
  workflow_advanced: "Progress updated",
  workflow_completed: "Request completed",
  task_created: "Supporting information requested",
  task_started: "Information review started",
  task_completed: "Supporting information checked",
  answer_generated: "Source context updated",
  guard_evaluated: "Reliability checked",
  evidence_added: "Supporting source added",
  approval_requested: "Sent for review",
  approval_approved: "Request approved",
  approval_rejected: "Request rejected",
  approval_superseded: "Review request replaced",
  evidence_requested: "More information requested",
  step_failed: "Evidence check needs attention",
  retry_requested: "Evidence check tried again",
  fallback_triggered: "Sent for specialist review",
  escalation_created: "Escalated for review",
  override_performed: "Exception decision recorded",
  regulatory_review_started: "Regulatory review started",
  finding_confirmed: "Gap confirmed and remediation assigned",
  finding_rejected: "Proposed gap rejected",
  remediation_reassigned: "Remediation reassigned",
  remediation_assigned: "Remediation assigned",
  regulatory_review_completed: "Regulatory review closed",
  investment_analysis_started: "Investment analysis started",
  assumption_selected: "Source value selected",
  memo_updated: "Memo edited",
  investment_submitted: "Submitted for approval",
};
export function activityLabel(event: ActivityView) {
  if (event.event_type === "workflow_advanced") {
    const labels: Record<string, string> = {
      collect_evidence: "Supporting information reviewed",
      validate: "Source checks completed",
      route_review: "Reviewer assigned",
      human_review: "Manager review recorded",
      expert_review: "Specialist review recorded",
      manual_review: "Specialist review recorded",
      complete: "Review completed",
      remediate: "Procedure or control updated",
      verify_sources: "Source checks completed",
      approve_remediation: "Remediation approval recorded",
      remediation_complete: "Remediation completed",
      verify_analysis: "Sources and calculation checked",
      approve_investment: "Investment approval recorded",
      investment_decided: "Investment approved",
    };
    return labels[String(event.payload?.step_key)] || "Progress updated";
  }
  return EVENTS[event.event_type] || "Request activity recorded";
}
export function reviewReason(approval: ApprovalView, status?: string) {
  if (status === "REVIEW_REQUIRED")
    return "Conflicting or ambiguous guidance needs your judgment.";
  if (status === "BLOCKED" || status === "OUTDATED")
    return "Supporting information must be resolved before approval.";
  if (approval.requested_role === "governance")
    return "A higher-authority review has been requested.";
  return "An independent decision is required before this request can complete.";
}
