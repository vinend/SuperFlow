import assert from "node:assert/strict";
import test from "node:test";
import {
  navigationFor,
  businessStatus,
  workItemsFor,
  reviewItemsFor,
  progressFor,
  askAction,
  activityLabel,
  personName,
  roleLabel,
} from "../../apps/web/lib/product-view.ts";
import type { User } from "../../apps/web/lib/api.ts";
import type {
  ApprovalView,
  WorkflowView,
  ActivityView,
} from "../../apps/web/lib/workflow-contracts.ts";
import type { CaseSummary } from "../../apps/web/lib/workflow-view.ts";

const employee = {
  id: "employee",
  role_id: "employee",
  name: "Maya Putri",
} as User;
const manager = {
  id: "manager",
  role_id: "manager",
  name: "Arif Santoso",
} as User;
const item = {
  id: "request",
  title: "Annual Leave Review",
  type: "general",
  status: "WAITING_FOR_REVIEW",
  owner_id: employee.id,
  created_by: employee.id,
  reliability_status: "VERIFIED",
  updated_at: "2026-09-26",
} as CaseSummary;
const approval = {
  id: "review",
  case_id: item.id,
  requested_from: "manager",
  requested_by: "employee",
  status: "PENDING",
  allowed_actions: ["approve", "reject"],
} as ApprovalView;
const run = {
  id: "run",
  case_id: item.id,
  current_step: "human_review",
  status: "WAITING_FOR_APPROVAL",
  allowed_actions: [],
  tasks: [],
  steps: [
    {
      id: "task",
      key: "collect_evidence",
      type: "TASK",
      status: "COMPLETED",
      attempts: [],
    },
    {
      id: "check",
      key: "validate",
      type: "GUARD",
      status: "COMPLETED",
      attempts: [],
    },
    {
      id: "route",
      key: "route_review",
      type: "CONDITION",
      status: "COMPLETED",
      attempts: [],
    },
    {
      id: "review",
      key: "human_review",
      type: "APPROVAL",
      status: "WAITING",
      owner_id: "manager",
      attempts: [],
    },
    {
      id: "unused",
      key: "expert_review",
      type: "APPROVAL",
      status: "PENDING",
      attempts: [],
    },
    {
      id: "terminal",
      key: "complete",
      type: "TERMINAL",
      status: "PENDING",
      attempts: [],
    },
  ],
} as WorkflowView;

test("navigation exposes only implemented jobs appropriate to each role", () => {
  assert.deepEqual(
    navigationFor("employee").map((n) => n.title),
    ["Home", "Ask SuperFlow", "Knowledge", "My Work"],
  );
  for (const role of ["manager", "compliance", "finance"])
    assert.equal(navigationFor(role).at(-1)?.title, "Reviews / Approvals");
  assert.equal(navigationFor("sme").at(-1)?.title, "Reviews");
  assert.deepEqual(
    navigationFor("governance").map((n) => n.title),
    ["Home", "Knowledge", "My Work", "Reviews / Approvals"],
  );
});
test("My Work joins execution and review state without changing canonical data", () => {
  const before = JSON.stringify([item, run, approval]);
  const work = workItemsFor([item], [run], [approval], employee)[0];
  assert.equal(work.title, item.title);
  assert.equal(work.status, "Waiting for review");
  assert.equal(work.reviewerId, "manager");
  assert.equal(work.nextAction, "Review request");
  assert.equal(JSON.stringify([item, run, approval]), before);
  const noAuthority = { ...approval, allowed_actions: [] };
  assert.equal(
    workItemsFor([item], [run], [noAuthority], employee)[0].nextAction,
    "View progress",
  );
  assert.equal(
    workItemsFor(
      [{ ...item, owner_id: "other", created_by: "other" }],
      [],
      [noAuthority],
      employee,
    ).length,
    0,
  );
});
test("review queue contains actionable assigned requests only and no employee controls", () => {
  const work = workItemsFor([item], [run], [approval], manager);
  assert.equal(reviewItemsFor([approval], work, "employee").length, 0);
  assert.equal(reviewItemsFor([approval], work, "manager").length, 1);
  assert.equal(
    reviewItemsFor([{ ...approval, allowed_actions: [] }], work, "manager")
      .length,
    0,
  );
  assert.equal(
    reviewItemsFor([{ ...approval, status: "APPROVED" }], work, "manager")
      .length,
    0,
  );
});
test("Progress hides engine routing and unselected review branches", () => {
  const steps = progressFor(run);
  assert.deepEqual(
    steps.map((s) => s.label),
    [
      "Prepare supporting information",
      "Evidence checked",
      "Manager review",
      "Complete",
    ],
  );
  assert.equal(steps.find((s) => s.current)?.label, "Manager review");
  assert.equal(progressFor(null).length, 0);
});

test("completed assigned reviews remain readable work without becoming pending decisions", () => {
  const decided = {
    ...approval,
    status: "APPROVED" as const,
    allowed_actions: [],
  };
  const work = workItemsFor(
    [{ ...item, status: "COMPLETED" }],
    [run],
    [decided],
    manager,
  );
  assert.equal(work[0].nextAction, "View outcome");
  assert.equal(reviewItemsFor([decided], work, "manager").length, 0);
});
test("missing information, task due dates and completion come from real execution", () => {
  const waiting = { ...item, status: "WAITING_FOR_EVIDENCE" as const };
  assert.equal(
    workItemsFor([waiting], [], [], employee)[0].nextAction,
    "Provide information",
  );
  const taskRun = {
    ...run,
    tasks: [
      {
        owner_id: "employee",
        status: "TODO",
        due_at: "2026-09-28",
        allowed_actions: ["complete"],
      },
    ],
  } as WorkflowView;
  assert.equal(
    workItemsFor([item], [taskRun], [], employee)[0].dueAt,
    "2026-09-28",
  );
  assert.equal(
    workItemsFor([{ ...item, status: "COMPLETED" }], [], [], employee)[0]
      .nextAction,
    "View outcome",
  );
});
test("contextual actions never carry restricted sources", () => {
  assert.equal(
    askAction({
      question: "Restricted policy",
      reliability: { status: "ACCESS_RESTRICTED" },
    } as Parameters<typeof askAction>[0]),
    null,
  );
  assert.equal(
    askAction({
      question: "Can I reimburse without a receipt?",
      reliability: { status: "BLOCKED" },
    } as Parameters<typeof askAction>[0])?.label,
    "Request Exception",
  );
  assert.equal(businessStatus("BLOCKED"), "More information required");
  assert.equal(businessStatus("REVIEW_REQUIRED"), "Needs review");
});
test("people and activity use readable names without exposing event schema", () => {
  assert.equal(personName("employee", [employee]), "Maya Putri");
  assert.equal(roleLabel("governance"), "Governance Admin");
  assert.equal(
    activityLabel({ event_type: "workflow_started" } as ActivityView),
    "Request submitted",
  );
  assert.equal(
    activityLabel({ event_type: "unknown_internal_event" } as ActivityView),
    "Request activity recorded",
  );
});
