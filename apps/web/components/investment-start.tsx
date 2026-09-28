"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProposalSourceView } from "@/lib/investment-contracts";
import { EmptyState, SectionHeader } from "./ui/primitives";

export function InvestmentStart({
  sources,
  preselect,
  busy,
  onStart,
}: {
  sources: ProposalSourceView[];
  preselect: string | null;
  busy: boolean;
  onStart: (proposal: string, supporting: string[]) => void;
}) {
  const initial = sources.some((s) => s.document_id === preselect)
    ? preselect!
    : sources[0]?.document_id || "";
  const [selected, setSelected] = useState(initial);
  const source = sources.find((item) => item.document_id === selected);
  const [supporting, setSupporting] = useState<string[]>(
    source?.related.map((d) => d.document_id) || [],
  );
  return (
    <section
      className="regulatory-start"
      aria-label="Start an investment analysis"
    >
      <SectionHeader
        title="Start an investment analysis"
        detail="SuperFlow reads the proposal and the supporting sources you can access, extracts the assumptions with citations, and surfaces conflicting values."
      />
      {sources.length === 0 ? (
        <EmptyState
          title="No current proposal available."
          description="Proposals appear here when a current Finance proposal states its initial investment."
        />
      ) : (
        <form
          className="workflow-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) onStart(selected, supporting);
          }}
        >
          <label>
            Proposal
            <select
              aria-label="Proposal"
              value={selected}
              disabled={busy}
              onChange={(event) => {
                const next = sources.find(
                  (s) => s.document_id === event.target.value,
                );
                setSelected(event.target.value);
                setSupporting(next?.related.map((d) => d.document_id) || []);
              }}
            >
              {sources.map((item) => (
                <option key={item.document_id} value={item.document_id}>
                  {item.title} · v{item.version}
                </option>
              ))}
            </select>
          </label>
          {source && (
            <fieldset className="value-choice">
              <legend>Supporting sources</legend>
              {source.related.length === 0 && (
                <span className="muted small">
                  No related sources are available to your role.
                </span>
              )}
              {source.related.map((doc) => (
                <label key={doc.document_id}>
                  <input
                    type="checkbox"
                    checked={supporting.includes(doc.document_id)}
                    disabled={busy}
                    onChange={(event) =>
                      setSupporting(
                        event.target.checked
                          ? [...supporting, doc.document_id]
                          : supporting.filter((id) => id !== doc.document_id),
                      )
                    }
                  />
                  <span>
                    {doc.title} · v{doc.version}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {source?.open_analysis_id ? (
            <Link
              className="button primary"
              href={`/investment?analysis=${encodeURIComponent(source.open_analysis_id)}`}
            >
              Continue open analysis
            </Link>
          ) : (
            <button
              className="button primary"
              type="submit"
              disabled={busy || !selected}
            >
              {busy ? "Extracting assumptions…" : "Prepare Analysis"}
            </button>
          )}
        </form>
      )}
    </section>
  );
}
