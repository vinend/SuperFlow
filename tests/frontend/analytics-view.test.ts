import assert from "node:assert/strict";
import test from "node:test";
import type {
  ImpactMetric,
  ImpactWorkspace,
} from "../../apps/web/lib/analytics-contracts.ts";
import {
  formatImpactMetric,
  isImpactWorkspace,
} from "../../apps/web/lib/analytics-view.ts";

const observed: ImpactMetric = {
  key: "verified_rate",
  label: "Verified result rate",
  value: 75,
  unit: "percent",
  kind: "observed",
  detail: "Latest reliability results.",
  method: "Verified divided by evaluated.",
};
const workspace: ImpactWorkspace = {
  focus: "quality",
  question: "Show quality",
  answer: "Grounded summary",
  scope: "Work visible to reviewer",
  data_through: "2026-09-28T12:00:00Z",
  provider: "deterministic-impact-composer-v1",
  notice: "Controlled components only.",
  components: [
    {
      type: "ImpactBrief",
      data: {
        eyebrow: "SuperFlow generated view",
        title: "Quality",
        summary: "Grounded summary",
        highlights: ["Three evaluated questions"],
      },
    },
    {
      type: "MetricGroup",
      data: {
        category: "quality",
        title: "Quality",
        description: "Observed metrics",
        metrics: [observed],
      },
    },
  ],
};

test("approved analytics components validate and metrics format without recalculation", () => {
  assert.ok(isImpactWorkspace(workspace));
  assert.equal(formatImpactMetric(observed), "75%");
  assert.equal(
    formatImpactMetric({ ...observed, value: 125000, unit: "IDR" }),
    "IDR 125,000",
  );
  assert.equal(
    formatImpactMetric({ ...observed, value: null }),
    "Not yet measured",
  );
});

test("unknown generative components fail closed", () => {
  const invalid = {
    ...workspace,
    components: [{ type: "ArbitraryHtml", data: { html: "<script />" } }],
  };
  assert.equal(isImpactWorkspace(invalid), false);
});

test("capacity values require the Illustrative simulation disclosure", () => {
  const simulation = {
    ...workspace,
    focus: "capacity",
    components: [
      {
        type: "CapacitySimulation",
        data: {
          title: "Capacity",
          disclosure: "Illustrative simulation",
          description: "Not realized savings.",
          metrics: [
            {
              ...observed,
              key: "hours_released",
              value: 2,
              unit: "hours",
              kind: "illustrative_simulation",
            },
          ],
          assumptions: ["Transparent assumption"],
        },
      },
    ],
  };
  assert.ok(isImpactWorkspace(simulation));
  assert.equal(
    isImpactWorkspace({
      ...simulation,
      components: [
        {
          ...simulation.components[0],
          data: {
            ...simulation.components[0].data,
            disclosure: "Estimated savings",
          },
        },
      ],
    }),
    false,
  );
});
