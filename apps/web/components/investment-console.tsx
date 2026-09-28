"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "./session";
import { ApplicationShell } from "./application-shell";
import { useInvestmentWorkspace } from "./use-investment-workspace";
import { InvestmentAnalysis } from "./investment-analysis";
import { InvestmentStart } from "./investment-start";
import { InvestmentList } from "./investment-list";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "./ui/primitives";

export function InvestmentConsole() {
  const { user } = useSession();
  const params = useSearchParams();
  return (
    <ApplicationShell view="investment">
      <InvestmentWorkspace key={`${user.id}:${params.toString()}`} />
    </ApplicationShell>
  );
}

function InvestmentWorkspace() {
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const analysisId = params.get("analysis");
  const w = useInvestmentWorkspace(user, analysisId);
  const current = w.current;
  return (
    <main
      className="main-content action-workspace"
      id="workspace-main"
      tabIndex={-1}
      aria-labelledby="page-title"
    >
      <PageHeader
        eyebrow={
          current ? "Investment Analysis / Analysis" : "Finance workspace"
        }
        title={current ? current.proposal_title : "Investment Analysis"}
        description={
          current
            ? "Inspect source-backed assumptions, resolve conflicts, review deterministic results and submit for approval."
            : "Turn proposals, quotations and cash-flow projections into source-backed analysis for approval."
        }
        action={
          current ? (
            <Link className="button secondary" href="/investment">
              All analyses
            </Link>
          ) : undefined
        }
      />
      {w.error && !current && (
        <ErrorState message={w.error} retry={() => window.location.reload()} />
      )}
      {w.loading ? (
        <LoadingState label="Loading investment analyses…" />
      ) : analysisId && !current ? (
        <EmptyState
          title="Investment analysis unavailable"
          description="It may be closed to your role, or it is tracked as a request in My Work."
        >
          <Link
            className="button secondary"
            href={`/cases?case=${encodeURIComponent(analysisId)}`}
          >
            Open in My Work
          </Link>
        </EmptyState>
      ) : current ? (
        <InvestmentAnalysis analysis={current} w={w} />
      ) : (
        <>
          {w.analyst ? (
            <InvestmentStart
              sources={w.sources}
              preselect={params.get("document")}
              busy={w.busy}
              onStart={async (proposal, supporting) => {
                const analysis = await w.start(proposal, supporting);
                if (analysis)
                  router.push(
                    `/investment?analysis=${encodeURIComponent(analysis.id)}`,
                  );
              }}
            />
          ) : (
            <EmptyState
              title="Investment Analysis is prepared by Finance."
              description="Approvals assigned to you appear in Reviews / Approvals."
            >
              <Link className="button secondary" href="/cases">
                Open My Work
              </Link>
            </EmptyState>
          )}
          <InvestmentList analyses={w.analyses} />
        </>
      )}
    </main>
  );
}
