"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateLabel, type Source } from "@/lib/api";
import type { InvestmentView } from "@/lib/investment-contracts";
import { activityLabel, personName } from "@/lib/product-view";
import { metricValue, PHASE_LABELS } from "@/lib/investment-view";
import { useSession } from "./session";
import type { useInvestmentWorkspace } from "./use-investment-workspace";
import { AssumptionTable, InputDecision } from "./assumption-table";
import { EvidenceChecklist } from "./evidence-checklist";
import { FinancialAnalysis } from "./financial-analysis";
import { MemoEditor, MemoText } from "./investment-memo";
import { SourcePanel } from "./source-panel";
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "./ui/primitives";

const SUBMIT_HINTS: Record<InvestmentView["phase"], string> = {
  MISSING_INFORMATION:
    "Required inputs are missing from the selected sources. Start a new analysis with the missing sources.",
  CONFLICTS: "Choose a source value for every conflicting input first.",
  READY_TO_SUBMIT:
    "Inputs are source-backed and unambiguous. Submitting freezes the results and memo for the approver.",
  IN_APPROVAL: "Submitted. The approver sees the frozen results and memo.",
  INFORMATION_REQUESTED:
    "The approver requested more information. Provide it from the request, then continue the review.",
  APPROVED: "Approved. Decisions remain in Activity.",
  CLOSED: "Closed without approval.",
};

export function InvestmentAnalysis({
  analysis,
  w,
}: {
  analysis: InvestmentView;
  w: ReturnType<typeof useInvestmentWorkspace>;
}) {
  const router = useRouter();
  const { users } = useSession();
  const [source, setSource] = useState<Source | null>(null);
  const [stage, setStage] = useState<
    "sources" | "assumptions" | "analysis" | "submit"
  >("sources");
  const [active, setActive] = useState<string | null>(null);
  const openDocument = (id: string, versionId?: string) =>
    router.push(
      `/knowledge#document=${encodeURIComponent(id)}${versionId ? `&version=${encodeURIComponent(versionId)}` : ""}`,
    );
  const run = (key: string, path: string, values: Record<string, unknown>) => {
    setActive(key);
    return w.mutate(path, values);
  };
  const citations = analysis.inputs.flatMap((input) =>
    input.assumptions.map((item) => item.source),
  );
  const choices = analysis.inputs.filter(
    (input) => new Set(input.assumptions.map((a) => a.value)).size > 1,
  );
  const headline = analysis.calculation?.metrics.filter((m) =>
    ["npv", "irr", "payback_years"].includes(m.key),
  );
  const editable = analysis.allowed_actions.includes("select");
  return (
    <>
      <div className="case-context-bar">
        <StatusBadge status={PHASE_LABELS[analysis.phase]} />
        <span>
          {analysis.proposal_title} · v{analysis.proposal_version}
        </span>
        <span>Prepared by {personName(analysis.created_by, users)}</span>
        <span>Updated {dateLabel(analysis.updated_at)}</span>
        <span>Illustrative synthetic data</span>
      </div>
      {stage === "analysis" && headline && (
        <dl className="regulatory-summary" aria-label="Headline results">
          {headline.map((metric) => (
            <div key={metric.key}>
              <dt>{metric.label}</dt>
              <dd>{metricValue(metric)}</dd>
            </div>
          ))}
        </dl>
      )}
      <nav className="journey-tabs" aria-label="Investment analysis stages">
        {(["sources", "assumptions", "analysis", "submit"] as const).map(
          (item, index) => (
            <button
              key={item}
              type="button"
              aria-current={stage === item ? "step" : undefined}
              onClick={() => setStage(item)}
            >
              {index + 1}.{" "}
              {item === "submit"
                ? "Submit for approval"
                : item[0].toUpperCase() + item.slice(1)}
            </button>
          ),
        )}
      </nav>
      {stage === "sources" && (
        <section className="comparison-section-block">
          <SectionHeader
            title="Sources"
            detail="Documents supporting this analysis."
          />
          <ul>
            {[
              analysis.proposal_title,
              ...analysis.supporting.map((document) => document.title),
            ].map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
          <button
            className="button primary"
            onClick={() => setStage("assumptions")}
          >
            Review assumptions
          </button>
        </section>
      )}
      {stage === "assumptions" && (
        <section
          className="comparison-section-block"
          aria-labelledby="assumptions-heading"
        >
          <div className="section-header">
            <div>
              <h2 id="assumptions-heading">Source-backed assumptions</h2>
              <p>
                Extracted from{" "}
                {[
                  analysis.proposal_title,
                  ...analysis.supporting.map((d) => d.title),
                ].join(", ")}
                . Every value links to the exact source section.
              </p>
            </div>
          </div>
          <AssumptionTable inputs={analysis.inputs} onSource={setSource} />
        </section>
      )}
      <div className="case-layout">
        <div className="case-execution">
          {stage === "assumptions" && editable && choices.length > 0 && (
            <section
              className="gap-section"
              aria-labelledby="conflicts-heading"
            >
              <div className="section-header">
                <div>
                  <h2 id="conflicts-heading">Conflicting inputs</h2>
                  <p>
                    Pick the source value to use and record why. Results
                    recalculate from your selection.
                  </p>
                </div>
              </div>
              {choices.map((input) => (
                <InputDecision
                  key={`${input.key}:${analysis.revision}`}
                  input={input}
                  users={users}
                  busy={w.busy}
                  error={active === input.key ? w.error : ""}
                  onSource={setSource}
                  onSelect={(assumptionId, reason) =>
                    run(input.key, "select", {
                      assumption_id: assumptionId,
                      reason,
                    })
                  }
                />
              ))}
            </section>
          )}
          {stage === "analysis" && (
            <section className="gap-section" aria-labelledby="analysis-heading">
              <div className="section-header">
                <div>
                  <h2 id="analysis-heading">Financial analysis</h2>
                  <p>
                    Deterministic formulas on the values above. Unit, period and
                    formula are shown for every result.
                  </p>
                </div>
              </div>
              {analysis.calculation ? (
                <FinancialAnalysis calculation={analysis.calculation} />
              ) : (
                <EmptyState
                  title="Results wait for complete, unambiguous inputs."
                  description="Resolve conflicting values and make sure every required input has a source."
                />
              )}
            </section>
          )}
          {stage === "submit" && (
            <section className="gap-section" aria-labelledby="memo-heading">
              <div className="section-header">
                <div>
                  <h2 id="memo-heading">Draft memo</h2>
                  <p>
                    A draft for the approver. The decision stays with the
                    authorized reviewer.
                  </p>
                </div>
              </div>
              {analysis.allowed_actions.includes("edit_memo") ? (
                <MemoEditor
                  key={analysis.revision}
                  memo={analysis.memo}
                  edited={analysis.memo_edited}
                  busy={w.busy}
                  error={active === "memo" ? w.error : ""}
                  onSave={(memo) => run("memo", "memo", { memo })}
                />
              ) : (
                <MemoText memo={analysis.memo} />
              )}
            </section>
          )}
          {stage === "submit" && (
            <section className="regulatory-close" aria-label="Approval">
              <SectionHeader
                title="Approval"
                detail={SUBMIT_HINTS[analysis.phase]}
              />
              {analysis.approval_route && (
                <p className="workflow-note">
                  <strong>Approval route:</strong>{" "}
                  {analysis.approval_route.label}.{" "}
                  <button
                    className="text-button"
                    onClick={() => setSource(analysis.approval_route!.source)}
                  >
                    Inspect authority source [
                    {analysis.approval_route.source.citation_id}]
                  </button>
                </p>
              )}
              {analysis.reviewer_id && (
                <p className="muted small">
                  Waiting for {personName(analysis.reviewer_id, users)}
                  {analysis.submitted_at
                    ? ` · submitted ${dateLabel(analysis.submitted_at)}`
                    : ""}
                </p>
              )}
              {analysis.allowed_actions.includes("submit") && (
                <button
                  className="button primary"
                  disabled={w.busy}
                  onClick={() => void run("submit", "submit", {})}
                >
                  Submit for approval
                </button>
              )}
              {analysis.allowed_actions.includes("provide_information") && (
                <Link
                  className="button primary"
                  href={`/cases?case=${encodeURIComponent(analysis.id)}`}
                >
                  Provide information
                </Link>
              )}
              {active === "submit" && w.error && (
                <ErrorState message={w.error} />
              )}
            </section>
          )}
        </div>
        <details className="case-evidence">
          <summary>Evidence & reliability</summary>
          <SectionHeader
            title="Source reliability"
            detail="Checks on the sources and the calculation inputs."
          />
          <EvidenceChecklist
            result={analysis.reliability}
            sources={citations}
            onSource={setSource}
            onDocument={openDocument}
          />
          <section className="case-audit" aria-label="Activity">
            <SectionHeader
              title="Activity"
              detail="Selections, memo edits, submission and decisions."
            />
            <ol>
              {analysis.activity.map((event) => (
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
        </details>
      </div>
      {source && (
        <SourcePanel
          source={source}
          close={() => setSource(null)}
          openDocument={openDocument}
          reliability={analysis.reliability}
        />
      )}
    </>
  );
}
