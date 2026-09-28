"use client";

import Link from "next/link";
import { useSession } from "./session";
import { useInvestmentWorkspace } from "./use-investment-workspace";
import {
  needsAttention,
  PHASE_LABELS,
  phaseNextAction,
} from "@/lib/investment-view";
import { ErrorState, SectionHeader } from "./ui/primitives";

// Finance Home: proposals not yet analysed and analyses needing input (real state only).
export function InvestmentAttention() {
  const { user } = useSession();
  const w = useInvestmentWorkspace(user, null);
  const unanalysed = w.sources.filter((source) => !source.open_analysis_id);
  const active = w.analyses.filter(needsAttention);
  return (
    <>
      <SectionHeader
        title="Investment Analysis"
        detail="Proposals to analyse and analyses waiting for your input."
        action={
          <Link href="/investment" className="text-link">
            Open Investment Analysis
          </Link>
        }
      />
      {w.error ? (
        <ErrorState message={w.error} />
      ) : w.loading ? null : unanalysed.length || active.length ? (
        <ul className="attention-list">
          {active.map((item) => (
            <li key={item.id}>
              <Link
                href={`/investment?analysis=${encodeURIComponent(item.id)}`}
              >
                <strong>{item.proposal_title}</strong>
                <span>
                  {PHASE_LABELS[item.phase]} · {phaseNextAction(item)}
                </span>
              </Link>
              <span>Open analysis</span>
            </li>
          ))}
          {unanalysed.map((source) => (
            <li key={source.document_id}>
              <Link
                href={`/investment?document=${encodeURIComponent(source.document_id)}`}
              >
                <strong>{source.title}</strong>
                <span>
                  Current proposal v{source.version} · not yet analysed
                </span>
              </Link>
              <span>Prepare analysis</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="attention-empty">No analyses need your input.</p>
      )}
    </>
  );
}
