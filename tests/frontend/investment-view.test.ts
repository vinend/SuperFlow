import assert from "node:assert/strict";
import test from "node:test";
import {
  formatIdr,
  formatValue,
  isInvestmentView,
  metricValue,
  needsAttention,
  phaseNextAction,
  stepLabel,
} from "../../apps/web/lib/investment-view.ts";
import type {
  InvestmentSummary,
  InvestmentView,
  MetricView,
} from "../../apps/web/lib/investment-contracts.ts";

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
const view = {
  id: "analysis",
  revision: 1,
  phase: "CONFLICTS",
  reliability: guard,
  inputs: [
    {
      key: "initial_investment",
      status: "conflict",
      assumptions: [{ source: { chunk_id: "chunk" } }],
    },
  ],
  calculation: null,
  memo: "Draft memo text for review.",
  activity: [],
  allowed_actions: ["select", "edit_memo"],
} as unknown as InvestmentView;

test("money, rates and terms are formatted without recalculation", () => {
  assert.equal(formatIdr(26041254), "IDR 26,041,254");
  assert.equal(formatIdr(-9958746), "−IDR 9,958,746");
  assert.equal(formatValue(10, "percent"), "10%");
  assert.equal(formatValue(4, "years"), "4 years");
  assert.equal(formatValue(56784745, "IDR per year"), "IDR 56,784,745 / year");
  assert.equal(formatValue(null, "IDR"), "—");
  assert.equal(
    metricValue({ value: null, unit: "percent" } as MetricView),
    "Undefined",
  );
  assert.equal(stepLabel(-20), "−20%");
  assert.equal(stepLabel(0), "Base");
});

test("phase copy states the next business action", () => {
  const summary = {
    phase: "CONFLICTS",
    conflict_count: 1,
  } as InvestmentSummary;
  assert.equal(phaseNextAction(summary), "Resolve 1 conflicting input");
  assert.ok(needsAttention(summary));
  assert.ok(!needsAttention({ ...summary, phase: "IN_APPROVAL" }));
  assert.equal(
    phaseNextAction({ ...summary, phase: "READY_TO_SUBMIT" }),
    "Review memo and submit",
  );
});

test("analysis payloads are validated; restricted context carries no content", () => {
  assert.ok(isInvestmentView(view));
  assert.ok(!isInvestmentView({ ...view, phase: "DRAFT" }));
  assert.ok(!isInvestmentView({ ...view, memo: undefined }));
  assert.ok(
    !isInvestmentView({
      ...view,
      reliability: { ...guard, status: "ACCESS_RESTRICTED" },
    }),
  );
});
