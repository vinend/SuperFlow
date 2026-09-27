"use client";

import Link from "next/link";
import { useSession } from "./session";
import { useRegulatoryWorkspace } from "./use-regulatory-workspace";
import {
  needsAttention,
  PHASE_LABELS,
  phaseNextAction,
} from "@/lib/regulatory-view";
import { ErrorState, SectionHeader } from "./ui/primitives";

// Compliance Home: new regulation versions and reviews needing a decision (real state only).
export function RegulatoryAttention() {
  const { user } = useSession();
  const w = useRegulatoryWorkspace(user, null);
  const unreviewed = w.sources.filter((source) => !source.open_review_id);
  const active = w.reviews.filter(needsAttention);
  return (
    <>
      <SectionHeader
        title="Regulatory Review"
        detail="New regulation versions and gap decisions awaiting you."
        action={
          <Link href="/regulatory" className="text-link">
            Open Regulatory Review
          </Link>
        }
      />
      {w.error ? (
        <ErrorState message={w.error} />
      ) : w.loading ? null : unreviewed.length || active.length ? (
        <ul className="attention-list">
          {unreviewed.map((source) => (
            <li key={source.document_id}>
              <Link
                href={`/regulatory?document=${encodeURIComponent(source.document_id)}`}
              >
                <strong>{source.title}</strong>
                <span>
                  New current version v{source.current.version} · not yet
                  reviewed against v{source.previous.version}
                </span>
              </Link>
              <span>Start review</span>
            </li>
          ))}
          {active.map((review) => (
            <li key={review.id}>
              <Link
                href={`/regulatory?review=${encodeURIComponent(review.id)}`}
              >
                <strong>{review.document_title}</strong>
                <span>
                  {PHASE_LABELS[review.phase]} · {phaseNextAction(review)}
                </span>
              </Link>
              <span>Open review</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="attention-empty">No regulatory decisions need you.</p>
      )}
    </>
  );
}
