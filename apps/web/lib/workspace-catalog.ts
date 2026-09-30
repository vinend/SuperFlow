import { z } from "zod";

// One approved domain catalog. CopilotKit only selects an entry; domain components
// and existing backend APIs own the actual data and actions.
export const WORKSPACE_KINDS = [
  "knowledge_answer",
  "regulatory_review",
  "investment_analysis",
  "investigation_review",
  "impact",
  "my_work",
  "reviews",
] as const;

export const APPROVED_WORKSPACE_TOOL = "showSuperFlowWorkspace" as const;

export function isApprovedWorkspaceTool(name: string): boolean {
  return name === APPROVED_WORKSPACE_TOOL;
}

export const WorkspaceResolutionSchema = z
  .object({
    status: z.enum(["ready", "denied"]),
    intent: z.enum(WORKSPACE_KINDS).nullable(),
    view: z
      .enum([
        "overview",
        "quality",
        "capacity",
        "delivery",
        "latest_changes",
        "remediation",
        "assumptions",
        "evidence",
      ])
      .nullable(),
    investigation_id: z.uuid().nullable(),
    alert_reference: z
      .string()
      .regex(/^AML-\d{4}-\d{3}$/)
      .nullable(),
    message: z.string().min(1).max(300),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "ready" && !value.intent)
      ctx.addIssue({
        code: "custom",
        message: "An approved workspace is required.",
      });
    if (
      value.status === "denied" &&
      (value.intent ||
        value.view ||
        value.investigation_id ||
        value.alert_reference)
    )
      ctx.addIssue({
        code: "custom",
        message: "Denied requests cannot carry workspace data.",
      });
    if (
      value.intent !== "investigation_review" &&
      (value.investigation_id || value.alert_reference)
    )
      ctx.addIssue({
        code: "custom",
        message: "Investigation references require an investigation workspace.",
      });
    const views: Record<
      (typeof WORKSPACE_KINDS)[number],
      (typeof value.view)[]
    > = {
      knowledge_answer: [null],
      regulatory_review: [null, "latest_changes", "remediation"],
      investment_analysis: [null, "overview", "assumptions"],
      investigation_review: [null, "overview", "evidence"],
      impact: [null, "overview", "quality", "capacity", "delivery"],
      my_work: [null],
      reviews: [null],
    };
    if (value.intent && !views[value.intent].includes(value.view))
      ctx.addIssue({
        code: "custom",
        message: "View is not approved for this workspace.",
      });
  });

export type WorkspaceResolution = z.infer<typeof WorkspaceResolutionSchema>;

export const WORKSPACE_LABELS: Record<
  (typeof WORKSPACE_KINDS)[number],
  string
> = {
  knowledge_answer: "Knowledge answer",
  regulatory_review: "Regulatory Review",
  investment_analysis: "Investment Analysis",
  investigation_review: "Investigation Review",
  impact: "Impact",
  my_work: "My Work",
  reviews: "Reviews / Approvals",
};

export function workspaceRoute(value: WorkspaceResolution): string | null {
  if (value.status !== "ready") return null;
  switch (value.intent) {
    case "knowledge_answer":
      return "/ask";
    case "regulatory_review":
      return "/regulatory";
    case "investment_analysis":
      return "/investment";
    case "investigation_review":
      return value.investigation_id
        ? `/investigations?investigation=${encodeURIComponent(value.investigation_id)}`
        : "/investigations";
    case "impact":
      return "/impact";
    case "my_work":
      return "/cases";
    case "reviews":
      return "/decisions";
    default:
      return null;
  }
}
