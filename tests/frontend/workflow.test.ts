import assert from "node:assert/strict";
import test from "node:test";
import {
  decisionError,
  stateLabel,
  isCaseView,
} from "../../apps/web/lib/workflow-view.ts";

test("workflow and task states use readable canonical labels", () => {
  assert.equal(stateLabel("WAITING_FOR_EVIDENCE"), "waiting for evidence");
  assert.equal(stateLabel("IN_PROGRESS"), "in progress");
  assert.equal(stateLabel("EVIDENCE_REQUESTED"), "evidence requested");
});
test("override and evidence actions require meaningful inputs", () => {
  assert.match(decisionError("override", "  ", "", false), /reason/);
  assert.match(
    decisionError("request-evidence", "Need policy", "", false),
    /evidence/,
  );
  assert.equal(
    decisionError("request-evidence", "Need policy", "Policy", false),
    "",
  );
});
test("review-required approval cannot omit its decision reason", () => {
  assert.match(decisionError("approve", "", "", true), /reason/);
  assert.equal(
    decisionError("approve", "Inspected both conflicting sources", "", true),
    "",
  );
  assert.equal(decisionError("approve", "", "", false), "");
});
test("invalid case and restricted payload fail safely", () => {
  assert.equal(isCaseView(null), false);
  assert.equal(
    isCaseView({
      id: "case",
      revision: 0,
      reliability: { status: "VERIFIED" },
    }),
    false,
  );
  assert.equal(isCaseView({ id: "case", revision: "0" }), false);
});
