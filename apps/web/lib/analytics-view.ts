import type { ImpactMetric, ImpactWorkspace } from "./analytics-contracts.ts";

type ImpactComponent = ImpactWorkspace["components"][number];

export const IMPACT_COMPONENT_TYPES = [
  "ImpactBrief",
  "MetricGroup",
  "DistributionChart",
  "CapacitySimulation",
  "NextActions",
] as const;

const COMPONENT_TYPES = new Set<string>(IMPACT_COMPONENT_TYPES);
const FOCUSES = new Set(["overview", "quality", "capacity", "delivery"]);
const METRIC_KINDS = new Set(["observed", "illustrative_simulation"]);

export function formatImpactMetric(metric: ImpactMetric) {
  if (metric.value === null) return "Not yet measured";
  if (metric.unit === "percent")
    return `${metric.value.toLocaleString("en-US")}%`;
  if (metric.unit === "IDR")
    return `IDR ${Math.round(metric.value).toLocaleString("en-US")}`;
  if (metric.unit === "count") return metric.value.toLocaleString("en-US");
  return `${metric.value.toLocaleString("en-US")} ${metric.unit}`;
}

function isMetric(value: unknown): value is ImpactMetric {
  if (!value || typeof value !== "object") return false;
  const metric = value as ImpactMetric;
  return (
    typeof metric.key === "string" &&
    typeof metric.label === "string" &&
    (typeof metric.value === "number" || metric.value === null) &&
    METRIC_KINDS.has(metric.kind) &&
    typeof metric.detail === "string" &&
    typeof metric.method === "string"
  );
}

function isComponent(value: unknown): value is ImpactComponent {
  if (!value || typeof value !== "object") return false;
  const component = value as ImpactComponent;
  if (!COMPONENT_TYPES.has(component.type) || !component.data) return false;
  if (component.type === "ImpactBrief")
    return (
      typeof component.data.title === "string" &&
      typeof component.data.summary === "string" &&
      Array.isArray(component.data.highlights)
    );
  if (component.type === "MetricGroup")
    return (
      ["quality", "capacity", "delivery"].includes(component.data.category) &&
      Array.isArray(component.data.metrics) &&
      component.data.metrics.every(isMetric)
    );
  if (component.type === "DistributionChart")
    return (
      typeof component.data.title === "string" &&
      Array.isArray(component.data.items) &&
      component.data.items.every(
        (item) =>
          typeof item.label === "string" &&
          Number.isInteger(item.count) &&
          typeof item.percent === "number",
      )
    );
  if (component.type === "CapacitySimulation")
    return (
      component.data.disclosure === "Illustrative simulation" &&
      Array.isArray(component.data.metrics) &&
      component.data.metrics.every(
        (metric) =>
          isMetric(metric) && metric.kind === "illustrative_simulation",
      ) &&
      Array.isArray(component.data.assumptions)
    );
  return (
    component.type === "NextActions" &&
    Array.isArray(component.data.actions) &&
    component.data.actions.every(
      (action) =>
        typeof action.label === "string" &&
        /^\/(ask|knowledge|cases|decisions|regulatory|investment)$/.test(
          action.href,
        ),
    )
  );
}

export function isImpactWorkspace(value: unknown): value is ImpactWorkspace {
  if (!value || typeof value !== "object") return false;
  const workspace = value as ImpactWorkspace;
  return (
    FOCUSES.has(workspace.focus) &&
    typeof workspace.question === "string" &&
    typeof workspace.answer === "string" &&
    typeof workspace.scope === "string" &&
    typeof workspace.provider === "string" &&
    Array.isArray(workspace.components) &&
    workspace.components.length > 0 &&
    workspace.components.every(isComponent)
  );
}
