import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_WORKSPACE_TOOL,
  WorkspaceResolutionSchema,
  isApprovedWorkspaceTool,
  workspaceRoute,
} from "../../apps/web/lib/workspace-catalog.ts";

const ready = {
  status: "ready",
  intent: "investigation_review",
  view: "evidence",
  investigation_id: "8e8e386d-df88-4f74-a384-8bdb27de2e05",
  alert_reference: "AML-2026-001",
  message: "Opening assigned investigation.",
};

test("approved workspace contract accepts identifiers and maps to safe routes", () => {
  const parsed = WorkspaceResolutionSchema.parse(ready);
  assert.equal(
    workspaceRoute(parsed),
    "/investigations?investigation=8e8e386d-df88-4f74-a384-8bdb27de2e05",
  );
  const denied = WorkspaceResolutionSchema.parse({
    ...ready,
    status: "denied",
    intent: null,
    view: null,
    investigation_id: null,
    alert_reference: null,
  });
  assert.equal(workspaceRoute(denied), null);
});

test("unknown intents, arbitrary routes, business values, and invalid IDs fail closed", () => {
  for (const change of [
    { intent: "arbitrary_component" },
    { route: "/admin" },
    { npv: 11041254 },
    { investigation_id: "<script>" },
    { alert_reference: "CUSTOMER-SECRET" },
    { status: "denied" },
    {
      status: "denied",
      intent: null,
      view: "evidence",
      investigation_id: null,
      alert_reference: null,
    },
    {
      intent: "investment_analysis",
      view: "quality",
      investigation_id: null,
      alert_reference: null,
    },
  ]) {
    assert.equal(
      WorkspaceResolutionSchema.safeParse({ ...ready, ...change }).success,
      false,
    );
  }
});

test("domain catalog has no material-action route", () => {
  for (const intent of [
    "knowledge_answer",
    "regulatory_review",
    "investment_analysis",
    "impact",
    "my_work",
    "reviews",
  ]) {
    const result = WorkspaceResolutionSchema.parse({
      ...ready,
      intent,
      view: null,
      investigation_id: null,
      alert_reference: null,
    });
    const route = workspaceRoute(result);
    assert.ok(route?.startsWith("/"));
    assert.doesNotMatch(route, /approve|submit|delete|override/);
  }
});

test("only the approved display tool is available to the workspace agent", () => {
  assert.equal(isApprovedWorkspaceTool(APPROVED_WORKSPACE_TOOL), true);
  assert.equal(isApprovedWorkspaceTool("approveInvestment"), false);
  assert.equal(isApprovedWorkspaceTool("renderArbitraryHtml"), false);
});
