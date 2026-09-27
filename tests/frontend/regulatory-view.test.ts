import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmError,
  defaultDueDate,
  isRegulatoryReviewView,
  needsAttention,
  phaseNextAction,
  remediationLabel,
} from "../../apps/web/lib/regulatory-view.ts";
import type {
  FindingView,
  RegulatoryReviewSummary,
  RegulatoryReviewView,
} from "../../apps/web/lib/regulatory-contracts.ts";

const summary = {
  phase: "GAP_REVIEW",
  pending_count: 2,
  remediation_total: 3,
  remediation_completed: 1,
} as RegulatoryReviewSummary;

const guard = {
  status: "REVIEW_REQUIRED",
  summary: "Review.",
  next_step: "Inspect.",
  checks: Object.fromEntries(
    [
      "citation_coverage",
      "source_validity",
      "source_authority",
      "version_validity",
      "permission_validity",
      "evidence_completeness",
      "conflict_detection",
      "calculation_validity",
      "human_review_requirement",
    ].map((name) => [name, { passed: true, applicable: true, details: "" }]),
  ),
  reasons: [],
  evidence: [],
  source_refs: [],
  active_replacements: [],
  allowed_actions: [],
};
const source = { chunk_id: "chunk", citation_id: 1 };
const view = {
  id: "review",
  revision: 2,
  phase: "GAP_REVIEW",
  reliability: guard,
  changes: [],
  findings: [
    {
      status: "PROPOSED",
      issues: [],
      allowed_actions: ["confirm", "reject"],
      impacted: source,
      requirement: source,
    },
  ],
  activity: [],
  allowed_actions: [],
} as unknown as RegulatoryReviewView;

test("phase copy states the next business action from backend counts", () => {
  assert.equal(phaseNextAction(summary), "Decide 2 proposed gaps");
  assert.equal(
    phaseNextAction({ ...summary, phase: "REMEDIATION" }),
    "Track remediation · 1 of 3 complete",
  );
  assert.equal(
    phaseNextAction({ ...summary, phase: "READY_TO_CLOSE" }),
    "Close review",
  );
  assert.ok(needsAttention(summary));
  assert.ok(!needsAttention({ ...summary, phase: "REMEDIATION" }));
});

test("remediation status is humanized without engine terms", () => {
  const finding = (remediation: object | null) =>
    ({ remediation }) as unknown as FindingView;
  assert.equal(remediationLabel(finding(null)), null);
  assert.equal(
    remediationLabel(
      finding({
        status: "WAITING_FOR_REVIEW",
        workflow_status: "WAITING_FOR_APPROVAL",
      }),
    ),
    "Waiting for remediation approval",
  );
  assert.equal(
    remediationLabel(finding({ status: "CANCELLED" })),
    "Remediation closed — reassign",
  );
  assert.equal(
    remediationLabel(finding({ status: "COMPLETED" })),
    "Remediation approved",
  );
});

test("confirm validation mirrors backend rules before submitting", () => {
  assert.equal(
    confirmError("", "2026-10-01", "", "2026-09-27"),
    "Choose a remediation owner.",
  );
  assert.equal(
    confirmError("sme", "2026-09-26", "", "2026-09-27"),
    "Choose a due date of today or later.",
  );
  assert.equal(
    confirmError("sme", "2026-09-27", "short", "2026-09-27"),
    "Describe the gap in at least 10 characters.",
  );
  assert.equal(confirmError("sme", "2026-10-27", "", "2026-09-27"), "");
  assert.equal(defaultDueDate(new Date(2026, 8, 27)), "2026-10-27");
});

test("review payloads are validated and restricted context carries no content", () => {
  assert.ok(isRegulatoryReviewView(view));
  assert.ok(!isRegulatoryReviewView({ ...view, phase: "UNKNOWN" }));
  assert.ok(!isRegulatoryReviewView({ ...view, reliability: {} }));
  assert.ok(
    !isRegulatoryReviewView({
      ...view,
      reliability: { ...guard, status: "ACCESS_RESTRICTED" },
    }),
  );
});
