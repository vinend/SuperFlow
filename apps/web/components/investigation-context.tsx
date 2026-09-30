"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type User } from "@/lib/api";
import type { InvestigationView } from "@/lib/investigation";
import { businessStatus } from "@/lib/product-view";
import { ErrorState, LoadingState, SectionHeader } from "./ui/primitives";

export function InvestigationContext({
  caseId,
  user,
}: {
  caseId: string;
  user: User;
}) {
  const [item, setItem] = useState<InvestigationView | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<InvestigationView>(`/api/investigations/${caseId}`, user)
      .then((value) => {
        if (live) setItem(value);
      })
      .catch((reason: Error) => {
        if (live) setError(reason.message);
      });
    return () => {
      live = false;
    };
  }, [caseId, user]);
  if (error)
    return (
      <ErrorState message={error} retry={() => window.location.reload()} />
    );
  if (!item) return <LoadingState label="Loading investigation evidence…" />;
  return (
    <section aria-label="Investigation context" className="case-description">
      <SectionHeader
        title="Investigation context"
        detail="Synthetic evidence; independent checker decision required."
      />
      <p>
        <strong>{item.alert_reference}</strong> · {item.context.customer_name} ·{" "}
        {item.context.triage_level} triage priority
      </p>
      <p>
        <strong>Analyst recommendation:</strong>{" "}
        {item.analyst_recommendation || "Not recorded"}
      </p>
      {item.analyst_notes && (
        <p>
          <strong>Analyst notes:</strong> {item.analyst_notes}
        </p>
      )}
      <p>
        <strong>Reliability:</strong> {businessStatus(item.reliability.status)}{" "}
        — {item.reliability.summary}
      </p>
      <ul>
        {item.evidence
          .filter((e) => e.required)
          .map((e) => (
            <li key={e.key}>
              {e.label}:{" "}
              {e.status === "available"
                ? `collected via ${item.provenance[e.key]?.tool_name || "authorized source"}`
                : "missing"}
            </li>
          ))}
      </ul>
      <p>
        Watchlist and adverse-news entries are synthetic candidate results. The
        analyst and checker must inspect them; no regulatory disposition is
        automated.
      </p>
      <Link
        href={`/investigations?investigation=${encodeURIComponent(caseId)}`}
        className="button secondary"
      >
        Open investigation detail
      </Link>
    </section>
  );
}
