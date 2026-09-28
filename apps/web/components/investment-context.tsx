"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type User } from "@/lib/api";
import type { InvestmentView } from "@/lib/investment-contracts";
import { isInvestmentView } from "@/lib/investment-view";
import { FinancialAnalysis } from "./financial-analysis";
import { MemoText } from "./investment-memo";
import { SectionHeader } from "./ui/primitives";

// Shown in the request/review workspace so approvers see results before deciding.
export function InvestmentContext({
  caseId,
  user,
}: {
  caseId: string;
  user: User;
}) {
  const [analysis, setAnalysis] = useState<InvestmentView | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    api<InvestmentView>(
      `/api/investment-analyses/${encodeURIComponent(caseId)}`,
      user,
      { signal: abort.signal },
    )
      .then((value) => {
        if (!abort.signal.aborted && isInvestmentView(value))
          setAnalysis(value);
      })
      // A plain request of this type has no analysis; the workspace stays generic.
      .catch(() => undefined);
    return () => abort.abort();
  }, [caseId, user]);
  if (!analysis) return null;
  return (
    <section className="investment-context" aria-label="Investment analysis">
      <SectionHeader
        title="Investment analysis"
        detail="Submitted results and memo. Illustrative synthetic data."
        action={
          <Link
            className="text-link"
            href={`/investment?analysis=${encodeURIComponent(caseId)}`}
          >
            Open full analysis
          </Link>
        }
      />
      {analysis.approval_route && (
        <p className="workflow-note">
          <strong>Approval route:</strong> {analysis.approval_route.label}.
        </p>
      )}
      {analysis.calculation && (
        <FinancialAnalysis calculation={analysis.calculation} />
      )}
      <details className="investment-context-memo">
        <summary>Memo</summary>
        <MemoText memo={analysis.memo} />
      </details>
    </section>
  );
}
