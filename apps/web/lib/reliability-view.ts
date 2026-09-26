import {
  RELIABILITY_STATUSES,
  GUARD_CHECK_NAMES,
  GUARD_ACTIONS,
  type GuardResult,
  type ReliabilityStatus,
  type SourceReference,
} from "./reliability-contracts.ts";
import type { Source } from "./api.ts";

export const RELIABILITY_PRESENTATION: Record<
  ReliabilityStatus,
  { label: string; tone: string }
> = {
  VERIFIED: { label: "VERIFIED", tone: "success" },
  REVIEW_REQUIRED: { label: "REVIEW REQUIRED", tone: "warning" },
  BLOCKED: { label: "BLOCKED", tone: "danger" },
  OUTDATED: { label: "OUTDATED", tone: "warning" },
  ACCESS_RESTRICTED: { label: "ACCESS RESTRICTED", tone: "muted" },
};

export function evidenceSource(ref: SourceReference, sources: Source[]) {
  return sources.find(
    (source) =>
      source.chunk_id === ref.chunk_id &&
      source.version_id === ref.version_id &&
      source.document_id === ref.document_id &&
      source.citation_id === ref.citation_id,
  );
}

export function visibleEvidence(result: GuardResult) {
  return result.status === "ACCESS_RESTRICTED" ? [] : result.evidence;
}

export function isGuardResult(value: unknown): value is GuardResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<GuardResult>;
  if (
    !RELIABILITY_STATUSES.includes(result.status as ReliabilityStatus) ||
    typeof result.summary !== "string" ||
    typeof result.next_step !== "string" ||
    !result.checks ||
    !Array.isArray(result.evidence) ||
    !Array.isArray(result.reasons) ||
    !Array.isArray(result.source_refs) ||
    !Array.isArray(result.active_replacements) ||
    !Array.isArray(result.allowed_actions)
  )
    return false;
  const refValid = (ref: SourceReference) =>
    !!ref &&
    [ref.document_id, ref.version_id, ref.chunk_id].every(
      (id) => typeof id === "string",
    ) &&
    Number.isInteger(ref.citation_id) &&
    ref.citation_id > 0;
  return (
    Object.keys(result.checks).length === GUARD_CHECK_NAMES.length &&
    GUARD_CHECK_NAMES.every((name) => Object.hasOwn(result.checks!, name)) &&
    result.allowed_actions.every((action) => GUARD_ACTIONS.includes(action)) &&
    (result.status !== "ACCESS_RESTRICTED" ||
      (result.evidence.length === 0 &&
        result.source_refs.length === 0 &&
        result.active_replacements.length === 0)) &&
    Object.values(result.checks).every(
      (check) =>
        check &&
        (check.passed === null || typeof check.passed === "boolean") &&
        typeof check.details === "string" &&
        typeof check.applicable === "boolean",
    ) &&
    result.reasons.every((reason) => typeof reason === "string") &&
    result.evidence.every(
      (item) =>
        item &&
        typeof item.key === "string" &&
        typeof item.label === "string" &&
        typeof item.required === "boolean" &&
        typeof item.details === "string" &&
        ["available", "missing", "conflicting"].includes(item.status) &&
        Array.isArray(item.source_refs) &&
        item.source_refs.every(refValid),
    ) &&
    result.source_refs.every(refValid) &&
    result.active_replacements.every(
      (item) =>
        item &&
        [item.document_id, item.version_id, item.title, item.version].every(
          (value) => typeof value === "string",
        ),
    )
  );
}
