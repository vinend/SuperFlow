"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { api, type Answer, type Source, type User } from "@/lib/api";
import type {
  RegulatoryReviewView,
  RegulatorySourceView,
} from "@/lib/regulatory-contracts";
import type {
  InvestmentView,
  ProposalSourceView,
} from "@/lib/investment-contracts";
import {
  WORKSPACE_LABELS,
  workspaceRoute,
  type WorkspaceResolution,
} from "@/lib/workspace-catalog";
import { AnswerCard } from "./answer-card";
import { InvestigationConsole } from "./investigation-console";
import { RegulatoryReview } from "./regulatory-review";
import { InvestmentAnalysis } from "./investment-analysis";
import { ControlledImpactWorkspace } from "./controlled-impact-workspace";
import { ActionLists } from "./action-lists";
import { useRegulatoryWorkspace } from "./use-regulatory-workspace";
import { useInvestmentWorkspace } from "./use-investment-workspace";
import { useActionWorkspace } from "./use-action-workspace";
import { useImpactWorkspace } from "./use-impact-workspace";
import { ErrorState, LoadingState } from "./ui/primitives";

type KnowledgeActions = {
  answer: Answer | null;
  asking: boolean;
  onSource: (source: Source) => void;
  onDocument: (id: string, versionId?: string) => void;
};

export function GenerativeWorkspace({
  selection,
  prompt,
  user,
  knowledge,
}: {
  selection: WorkspaceResolution | null;
  prompt: string;
  user: User;
  knowledge: KnowledgeActions;
}) {
  if (!selection)
    return (
      <section className="generated-empty" aria-label="Generated workspace">
        <span className="context-label">
          Knowledge → Evidence → Decision → Action
        </span>
        <h2>Tell SuperFlow what you need.</h2>
        <p>
          Ask a question or describe a review. The relevant workspace will use
          the sources and work available to your role.
        </p>
      </section>
    );
  if (selection.status === "denied")
    return (
      <section
        className="generated-empty"
        role="status"
        aria-label="Workspace unavailable"
      >
        <h2>Workspace unavailable</h2>
        <p>{selection.message}</p>
        <p>Choose another request or use your available navigation.</p>
      </section>
    );
  const href = workspaceRoute(selection);
  return (
    <section className="generated-surface" aria-label="Generated workspace">
      <header className="generated-heading">
        <div>
          <span className="context-label">Selected workspace</span>
          <h2>
            {selection.intent
              ? WORKSPACE_LABELS[selection.intent]
              : "Workspace"}
          </h2>
          <p>{selection.message}</p>
        </div>
        {href && selection.intent !== "knowledge_answer" && (
          <Link href={href} className="text-link">
            Open full workspace <ArrowUpRight size={14} />
          </Link>
        )}
      </header>
      <div
        className="generated-body"
        key={`${user.id}:${selection.intent}:${selection.investigation_id || ""}:${selection.view}`}
      >
        {selection.intent === "knowledge_answer" ? (
          knowledge.asking ? (
            <LoadingState label="Retrieving authorized sources…" />
          ) : knowledge.answer ? (
            <AnswerCard
              answer={knowledge.answer}
              onSource={knowledge.onSource}
              onDocument={knowledge.onDocument}
            />
          ) : (
            <LoadingState label="Retrieving authorized sources…" />
          )
        ) : selection.intent === "regulatory_review" ? (
          <RegulatoryGenerated user={user} />
        ) : selection.intent === "investment_analysis" ? (
          <InvestmentGenerated user={user} prompt={prompt} />
        ) : selection.intent === "investigation_review" ? (
          <InvestigationConsole
            embedded
            selectedId={selection.investigation_id}
            initialTab={selection.view === "evidence" ? "evidence" : "overview"}
          />
        ) : selection.intent === "impact" ? (
          <ImpactGenerated user={user} prompt={prompt} />
        ) : selection.intent === "my_work" || selection.intent === "reviews" ? (
          <WorkGenerated user={user} view={selection.intent} />
        ) : (
          <ErrorState message="The requested workspace is not approved." />
        )}
      </div>
    </section>
  );
}

function RegulatoryGenerated({ user }: { user: User }) {
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    async function prepare() {
      const sources = await api<RegulatorySourceView[]>(
        "/api/regulatory-reviews/sources",
        user,
      );
      const target = sources.find((item) => /regulation/i.test(item.title));
      if (!target)
        throw new Error("No current regulation is available to your role.");
      const review = target.open_review_id
        ? { id: target.open_review_id }
        : await api<RegulatoryReviewView>("/api/regulatory-reviews", user, {
            method: "POST",
            body: JSON.stringify({ document_id: target.document_id }),
          });
      if (live) setId(review.id);
    }
    void prepare()
      .catch((reason: Error) => live && setError(reason.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user]);
  if (error) return <ErrorState message={error} />;
  if (loading || !id)
    return <LoadingState label="Opening current regulatory comparison…" />;
  return <RegulatoryDetails user={user} id={id} />;
}

function RegulatoryDetails({ user, id }: { user: User; id: string }) {
  const w = useRegulatoryWorkspace(user, id);
  if (w.error) return <ErrorState message={w.error} />;
  if (w.loading || !w.current)
    return <LoadingState label="Loading regulatory evidence…" />;
  return <RegulatoryReview review={w.current} w={w} />;
}

function InvestmentGenerated({ user, prompt }: { user: User; prompt: string }) {
  const supported = /proposal\s+a\b/i.test(prompt);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    async function prepare() {
      const sources = await api<ProposalSourceView[]>(
        "/api/investment-analyses/sources",
        user,
      );
      const target = sources.find((item) => /proposal\s+a\b/i.test(item.title));
      if (!target)
        throw new Error(
          "The requested proposal is not available to your role.",
        );
      const analysis = target.open_analysis_id
        ? { id: target.open_analysis_id }
        : await api<InvestmentView>("/api/investment-analyses", user, {
            method: "POST",
            body: JSON.stringify({
              proposal_document_id: target.document_id,
              supporting_document_ids: target.related.map(
                (item) => item.document_id,
              ),
            }),
          });
      if (live) setId(analysis.id);
    }
    if (!supported) return;
    void prepare()
      .catch((reason: Error) => live && setError(reason.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user, supported]);
  if (!supported)
    return (
      <ErrorState message="Open Investment Analysis to select an available proposal." />
    );
  if (error) return <ErrorState message={error} />;
  if (loading || !id)
    return <LoadingState label="Preparing source-backed analysis…" />;
  return <InvestmentDetails user={user} id={id} />;
}

function InvestmentDetails({ user, id }: { user: User; id: string }) {
  const w = useInvestmentWorkspace(user, id);
  if (w.error) return <ErrorState message={w.error} />;
  if (w.loading || !w.current)
    return <LoadingState label="Loading analysis and assumptions…" />;
  return <InvestmentAnalysis analysis={w.current} w={w} />;
}

function ImpactGenerated({ user, prompt }: { user: User; prompt: string }) {
  const w = useImpactWorkspace(user);
  useEffect(() => {
    if (!w.loading && w.workspace && !w.busy) void w.ask(prompt);
    // Run once after the permission-scoped overview has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.loading, user.id, prompt]);
  if (w.error) return <ErrorState message={w.error} />;
  if (w.loading || w.busy || !w.workspace)
    return <LoadingState label="Composing permitted Impact view…" />;
  return <ControlledImpactWorkspace workspace={w.workspace} />;
}

function WorkGenerated({
  user,
  view,
}: {
  user: User;
  view: "my_work" | "reviews";
}) {
  const w = useActionWorkspace(user, null);
  if (w.error) return <ErrorState message={w.error} />;
  if (w.loading) return <LoadingState label="Loading your current work…" />;
  return (
    <ActionLists view={view === "reviews" ? "decisions" : "cases"} w={w} />
  );
}
