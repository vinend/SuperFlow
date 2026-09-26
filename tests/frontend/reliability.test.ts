import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  RELIABILITY_STATUSES,
  type GuardResult,
} from "../../apps/web/lib/reliability-contracts.ts";
import {
  evidenceSource,
  isGuardResult,
  RELIABILITY_PRESENTATION,
  visibleEvidence,
} from "../../apps/web/lib/reliability-view.ts";
import type { Source } from "../../apps/web/lib/api.ts";

test("all canonical reliability states have explicit labels and semantic presentation", () => {
  assert.equal(RELIABILITY_STATUSES.length, 5);
  for (const status of RELIABILITY_STATUSES)
    assert.equal(
      RELIABILITY_PRESENTATION[status].label,
      status.replaceAll("_", " "),
    );
});
test("evidence links require the exact document, version, chunk and citation relationship", () => {
  const ref = {
    document_id: "doc",
    version_id: "v1",
    chunk_id: "chunk",
    citation_id: 1,
  };
  const source = { ...ref, version: "1.0", status: "outdated" } as Source;
  assert.equal(evidenceSource(ref, [source]), source);
  assert.equal(
    evidenceSource({ ...ref, version_id: "v2" }, [source]),
    undefined,
  );
});
test("restricted presentation never exposes evidence, even if an invalid payload carries items", () => {
  const result = {
    status: "ACCESS_RESTRICTED",
    evidence: [{ label: "Secret excerpt" }],
  } as GuardResult;
  assert.deepEqual(visibleEvidence(result), []);
  const missing = {
    key: "receipt",
    label: "Receipt exception authority",
    required: true,
    status: "missing",
  };
  assert.deepEqual(
    visibleEvidence({ status: "BLOCKED", evidence: [missing] } as GuardResult),
    [missing],
  );
});
test("unsupported or malformed reliability payload fails closed", () => {
  assert.equal(isGuardResult({ status: "97% confidence" }), false);
  assert.equal(isGuardResult(null), false);
  assert.equal(isGuardResult({ status: "VERIFIED", checks: {} }), false);
});
