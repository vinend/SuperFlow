"use client";

import Link from "next/link";
import { useState } from "react";
import { dateLabel } from "@/lib/api";
import type { RegulatorySourceView } from "@/lib/regulatory-contracts";
import { EmptyState, Metadata, SectionHeader } from "./ui/primitives";

export function RegulatoryStart({
  sources,
  preselect,
  busy,
  onStart,
}: {
  sources: RegulatorySourceView[];
  preselect: string | null;
  busy: boolean;
  onStart: (documentId: string) => void;
}) {
  const [selected, setSelected] = useState(
    sources.some((item) => item.document_id === preselect)
      ? preselect!
      : sources[0]?.document_id || "",
  );
  const source = sources.find((item) => item.document_id === selected);
  return (
    <section
      className="regulatory-start"
      aria-label="Start a regulatory review"
    >
      <SectionHeader
        title="Start a regulatory review"
        detail="SuperFlow compares the current version with the previous one, maps the procedures and controls you can access, and proposes gaps for your decision."
      />
      {sources.length === 0 ? (
        <EmptyState
          title="No regulation with a previous version."
          description="A regulation appears here after a new current version is published in Knowledge."
        />
      ) : (
        <form
          className="workflow-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) onStart(selected);
          }}
        >
          <label>
            Regulation
            <select
              aria-label="Regulation"
              value={selected}
              disabled={busy}
              onChange={(event) => setSelected(event.target.value)}
            >
              {sources.map((item) => (
                <option key={item.document_id} value={item.document_id}>
                  {item.title} · v{item.previous.version} → v
                  {item.current.version}
                </option>
              ))}
            </select>
          </label>
          {source && (
            <Metadata
              items={[
                {
                  label: "Previous version",
                  value: `v${source.previous.version} · historical · effective ${dateLabel(source.previous.effective_date)}`,
                },
                {
                  label: "Current version",
                  value: `v${source.current.version} · current · effective ${dateLabel(source.current.effective_date)}`,
                },
                { label: "Owner", value: source.owner },
              ]}
            />
          )}
          {source?.open_review_id ? (
            <Link
              className="button primary"
              href={`/regulatory?review=${encodeURIComponent(source.open_review_id)}`}
            >
              Continue open review
            </Link>
          ) : (
            <button
              className="button primary"
              type="submit"
              disabled={busy || !selected}
            >
              {busy ? "Comparing versions…" : "Start Regulatory Review"}
            </button>
          )}
        </form>
      )}
    </section>
  );
}
