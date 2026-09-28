import type {
  AnalysisPhase,
  InputView,
  InvestmentSummary,
  InvestmentView,
  MetricView,
} from "./investment-contracts.ts";
import { isGuardResult } from "./reliability-view.ts";

// Business language for Investment Analysis. Backend owns phase, values and actions;
// this module only formats numbers it receives and never recalculates them.
export const PHASE_LABELS: Record<AnalysisPhase, string> = {
  MISSING_INFORMATION: "Required information missing",
  CONFLICTS: "Needs your input",
  READY_TO_SUBMIT: "Ready to submit",
  IN_APPROVAL: "Waiting for approval",
  INFORMATION_REQUESTED: "More information requested",
  APPROVED: "Approved",
  CLOSED: "Closed",
};
export const INPUT_LABELS: Record<InputView["status"], string> = {
  consistent: "Sources agree",
  conflict: "Sources conflict",
  resolved: "Selected by Finance",
  missing: "Missing",
};

export function formatIdr(value: number) {
  const sign = value < 0 ? "−" : "";
  return `${sign}IDR ${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

export function formatValue(value: number | null, unit: string) {
  if (value === null) return "—";
  if (unit === "IDR") return formatIdr(value);
  if (unit === "IDR per year") return `${formatIdr(value)} / year`;
  if (unit === "percent") return `${value.toLocaleString("en-US")}%`;
  if (unit === "years") return `${value.toLocaleString("en-US")} years`;
  return String(value);
}

export function metricValue(metric: MetricView) {
  return metric.value === null
    ? "Undefined"
    : formatValue(metric.value, metric.unit);
}

export function stepLabel(step: number) {
  return step === 0 ? "Base" : `${step > 0 ? "+" : "−"}${Math.abs(step)}%`;
}

export function phaseNextAction(summary: InvestmentSummary) {
  if (summary.phase === "CONFLICTS")
    return `Resolve ${summary.conflict_count} conflicting input${summary.conflict_count === 1 ? "" : "s"}`;
  if (summary.phase === "MISSING_INFORMATION") return "Add the missing sources";
  if (summary.phase === "READY_TO_SUBMIT") return "Review memo and submit";
  if (summary.phase === "INFORMATION_REQUESTED") return "Provide information";
  if (summary.phase === "IN_APPROVAL") return "Track approval";
  return "View outcome";
}

export function needsAttention(summary: InvestmentSummary) {
  return [
    "CONFLICTS",
    "MISSING_INFORMATION",
    "READY_TO_SUBMIT",
    "INFORMATION_REQUESTED",
  ].includes(summary.phase);
}

// Validate the payload before rendering; restricted context must carry no content.
export function isInvestmentView(value: unknown): value is InvestmentView {
  if (!value || typeof value !== "object") return false;
  const item = value as InvestmentView;
  return (
    typeof item.id === "string" &&
    Number.isInteger(item.revision) &&
    item.phase in PHASE_LABELS &&
    isGuardResult(item.reliability) &&
    Array.isArray(item.inputs) &&
    Array.isArray(item.activity) &&
    Array.isArray(item.allowed_actions) &&
    typeof item.memo === "string" &&
    item.inputs.every(
      (input) =>
        input.status in INPUT_LABELS &&
        Array.isArray(input.assumptions) &&
        input.assumptions.every(
          (assumption) => typeof assumption.source?.chunk_id === "string",
        ),
    ) &&
    (item.calculation === null ||
      (Array.isArray(item.calculation.metrics) &&
        Array.isArray(item.calculation.sensitivity))) &&
    (item.reliability.status !== "ACCESS_RESTRICTED" ||
      (item.inputs.length === 0 &&
        item.calculation === null &&
        item.memo === ""))
  );
}
