"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateLabel, type Source } from "@/lib/api";
import type { RegulatoryReviewView } from "@/lib/regulatory-contracts";
import { activityLabel, businessStatus, personName } from "@/lib/product-view";
import { PHASE_LABELS } from "@/lib/regulatory-view";
import { useSession } from "./session";
import type { useRegulatoryWorkspace } from "./use-regulatory-workspace";
import { ComparisonTable } from "./comparison-table";
import { EvidenceChecklist } from "./evidence-checklist";
import { GapFinding } from "./gap-finding";
import { SourcePanel } from "./source-panel";
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "./ui/primitives";

const CLOSING_HINTS = {
  GAP_REVIEW: "Decide every proposed gap before closing the review.",
  REMEDIATION:
    "The review can close after every confirmed remediation is completed and approved.",
  READY_TO_CLOSE:
    "All gaps are decided and every remediation is approved. Close the review to record the outcome.",
  COMPLETED:
    "This review is closed. Decisions and remediation remain in Activity.",
  CANCELLED: "This review was closed without completion.",
};

export function RegulatoryReview({
  review,
  w,
}: {
  review: RegulatoryReviewView;
  w: ReturnType<typeof useRegulatoryWorkspace>;
}) {
  const router = useRouter();
  const { users } = useSession();
  const [source, setSource] = useState<Source | null>(null);
  // Decision errors render beside the finding or action that produced them.
  const [active, setActive] = useState<string | null>(null);
  const openDocument = (id: string, versionId?: string) =>
    router.push(
      `/knowledge#document=${encodeURIComponent(id)}${versionId ? `&version=${encodeURIComponent(versionId)}` : ""}`,
    );
  // Reliability evidence resolves against the current regulation and mapped controls.
  const citations = review.changes.flatMap((change) => [
    ...(change.current ? [change.current] : []),
    ...change.impacts.map((impact) => impact.source),
  ]);
  const pending = review.findings.filter((f) => f.status === "PROPOSED");
  const decided = review.findings.filter((f) => f.status !== "PROPOSED");
  return (
    <>
      <div className="case-context-bar">
        <StatusBadge status={PHASE_LABELS[review.phase]} />
        <span>
          v{review.previous.version} (historical,{" "}
          {dateLabel(review.previous.effective_date)}) → v
          {review.current.version} (current,{" "}
          {dateLabel(review.current.effective_date)})
        </span>
        <span>Started by {personName(review.created_by, users)}</span>
        <span>Updated {dateLabel(review.updated_at)}</span>
      </div>
      <dl className="regulatory-summary" aria-label="Review summary">
        <div>
          <dt>Material changes</dt>
          <dd>
            {review.material_count} of {review.change_count} sections
          </dd>
        </div>
        <div>
          <dt>Proposed gaps</dt>
          <dd>
            {review.finding_count} · {review.pending_count} awaiting decision
          </dd>
        </div>
        <div>
          <dt>Remediation approved</dt>
          <dd>
            {review.remediation_completed} of {review.remediation_total}
          </dd>
        </div>
      </dl>
      <section
        className="comparison-section-block"
        aria-labelledby="comparison-heading"
      >
        <div className="section-header">
          <div>
            <h2 id="comparison-heading">What changed</h2>
            <p>
              Section-by-section comparison. The previous version is shown as a
              baseline only, not as current authority.
            </p>
          </div>
        </div>
        <ComparisonTable
          changes={review.changes}
          previousLabel={`Previous · v${review.previous.version}`}
          currentLabel={`Current · v${review.current.version}`}
          onSource={setSource}
        />
      </section>
      <div className="case-layout">
        <div className="case-execution">
          <section aria-labelledby="gaps-heading">
            <div className="section-header">
              <div>
                <h2 id="gaps-heading">Gap review</h2>
                <p>
                  SuperFlow proposes gaps from deterministic rules. Confirm,
                  edit or reject each one; confirmed gaps become remediation
                  work.
                </p>
              </div>
            </div>
            {review.findings.length === 0 ? (
              <EmptyState
                title="No gaps proposed."
                description="Mapped procedures already reflect the changed requirements, or no accessible procedure is mapped."
              />
            ) : (
              [...pending, ...decided].map((finding) => (
                <GapFinding
                  key={`${finding.id}:${review.revision}`}
                  finding={finding}
                  users={users}
                  busy={w.busy}
                  error={active === finding.id ? w.error : ""}
                  onSource={setSource}
                  onDecision={(action, values) => {
                    setActive(finding.id);
                    return w.mutate(`findings/${finding.id}/${action}`, values);
                  }}
                />
              ))
            )}
          </section>
          <section className="regulatory-close" aria-label="Close review">
            <SectionHeader
              title="Outcome"
              detail={CLOSING_HINTS[review.phase]}
            />
            {review.allowed_actions.includes("complete") && (
              <button
                className="button primary"
                disabled={w.busy}
                onClick={() => {
                  setActive("complete");
                  void w.mutate("complete");
                }}
              >
                Close regulatory review
              </button>
            )}
            {active === "complete" && w.error && (
              <ErrorState message={w.error} />
            )}
          </section>
        </div>
        <aside className="case-evidence" aria-label="Reliability and activity">
          <SectionHeader
            title="Source reliability"
            detail="Checks on the current regulation and mapped procedures."
          />
          <EvidenceChecklist
            result={review.reliability}
            sources={citations}
            onSource={setSource}
            onDocument={openDocument}
          />
          <section className="case-audit" aria-label="Activity">
            <SectionHeader
              title="Activity"
              detail="Review decisions and remediation hand-offs."
            />
            <ol>
              {review.activity.map((event) => (
                <li key={event.id}>
                  <strong>{activityLabel(event)}</strong>
                  <span>
                    {personName(event.actor_id, users)} ·{" "}
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                  {typeof event.payload.reason === "string" && (
                    <p>{event.payload.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
          <p className="muted small">
            Review status: {businessStatus(review.status)}. Comparison and gap
            proposals are deterministic extracts, not legal advice.
          </p>
        </aside>
      </div>
      {source && (
        <SourcePanel
          source={source}
          close={() => setSource(null)}
          openDocument={openDocument}
          reliability={review.reliability}
        />
      )}
    </>
  );
}
