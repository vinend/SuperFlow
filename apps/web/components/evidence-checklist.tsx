"use client";

import { Check, Circle, Minus, TriangleAlert } from "lucide-react";
import { dateLabel } from "@/lib/api";
import type { EvidenceChecklistProps } from "@/lib/workspace-contracts";
import {
  evidenceSource,
  RELIABILITY_PRESENTATION,
  visibleEvidence,
} from "@/lib/reliability-view";

const CHECK_LABELS = {
  citation_coverage: "Citation coverage",
  source_validity: "Stored source",
  source_authority: "Source authority",
  version_validity: "Active version",
  permission_validity: "Permission",
  evidence_completeness: "Required evidence",
  conflict_detection: "Material conflict",
  calculation_validity: "Calculation",
  human_review_requirement: "Human review",
};

export function EvidenceChecklist({
  result,
  sources,
  onSource,
  onDocument,
}: EvidenceChecklistProps) {
  const presentation = RELIABILITY_PRESENTATION[result.status];
  const evidence = visibleEvidence(result);
  return (
    <section className="guard-result" aria-label="SuperFlow Guard">
      <div className="guard-heading">
        <span className={`reliability-status ${presentation.tone}`}>
          {presentation.label}
        </span>
        <p>{result.summary}</p>
      </div>
      {result.reasons.length > 0 && (
        <ul className="guard-reasons">
          {result.reasons.slice(0, 2).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {evidence.length > 0 && (
        <details className="evidence-checklist" aria-label="Evidence Checklist">
          <summary>
            Evidence checklist{" "}
            <span>
              {evidence.filter((item) => item.required).length} required ·{" "}
              {evidence.length} items
            </span>
          </summary>
          <ul>
            {evidence.map((item) => {
              const Icon =
                item.status === "available"
                  ? Check
                  : item.status === "conflicting"
                    ? TriangleAlert
                    : Circle;
              return (
                <li key={item.key} className={`evidence-item ${item.status}`}>
                  <Icon size={15} aria-hidden="true" />
                  <div>
                    <strong>{item.label}</strong>
                    <span className="evidence-state">
                      {item.status} ·{" "}
                      {item.required ? "Required" : "Supporting source"}
                    </span>
                    <p>{item.details}</p>
                    {(item.source_refs || []).map((ref) => {
                      const source = evidenceSource(ref, sources);
                      return source ? (
                        <button
                          key={ref.chunk_id}
                          className="text-button evidence-citation"
                          onClick={() => onSource(source)}
                        >
                          Inspect evidence [{ref.citation_id}] · v
                          {source.version}
                        </button>
                      ) : null;
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <details className="guard-checks">
        <summary>
          Guard checks <span>Deterministic controls</span>
        </summary>
        <dl>
          {Object.entries(result.checks).map(([name, check]) => {
            const Icon = !check.applicable
              ? Minus
              : check.passed
                ? Check
                : TriangleAlert;
            return (
              <div key={name}>
                <dt>
                  <Icon size={14} aria-hidden="true" />
                  {CHECK_LABELS[name as keyof typeof CHECK_LABELS]}
                  <small>
                    {!check.applicable
                      ? "Not evaluated"
                      : check.passed
                        ? "Passed"
                        : "Needs attention"}
                  </small>
                </dt>
                <dd>{check.details}</dd>
              </div>
            );
          })}
        </dl>
        <p className="muted small">
          {result.policy_version} ·{" "}
          {result.evaluated_at
            ? dateLabel(result.evaluated_at)
            : "Evaluation stored"}
          . These checks apply to extracted knowledge, not an approval to act.
        </p>
      </details>
      {result.active_replacements.map((replacement) => (
        <button
          className="text-button active-replacement"
          key={replacement.version_id}
          onClick={() =>
            onDocument(replacement.document_id, replacement.version_id)
          }
        >
          Open active replacement: {replacement.title} · v{replacement.version}
        </button>
      ))}
    </section>
  );
}
