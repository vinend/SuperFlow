"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session";
import { ApplicationShell } from "./application-shell";
import { useActionWorkspace } from "./use-action-workspace";
import { CaseCreateForm } from "./case-forms";
import { CaseWorkspace } from "./case-workspace";
import { ActionLists } from "./action-lists";
import { canReview, workTitle } from "@/lib/product-view";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "./ui/primitives";
type ActionView = "cases" | "workflows" | "decisions";
export function ActionConsole({ view }: { view: ActionView }) {
  const { user } = useSession();
  const params = useSearchParams();
  return (
    <ApplicationShell view={view}>
      <ActionWorkspace
        key={`${user.id}:${view}:${params.toString()}`}
        view={view}
      />
    </ApplicationShell>
  );
}
function ActionWorkspace({ view }: { view: ActionView }) {
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const caseId = params.get("case");
  const w = useActionWorkspace(user, caseId);
  const current = w.current;
  const reviewAccess = view !== "decisions" || canReview(user.role_id);
  const [tab, setTab] = useState<"tasks" | "decisions">(
    view === "decisions" ? "decisions" : "tasks",
  );
  return (
    <main
      className="main-content action-workspace"
      id="workspace-main"
      tabIndex={-1}
      aria-labelledby="page-title"
    >
      <PageHeader
        eyebrow={current ? "Work / Request" : "Your workspace"}
        title={current ? workTitle(current.title) : "Work"}
        description={
          current
            ? "Track progress, provide information, and inspect the supporting sources."
            : "Your tasks, requests, and decisions in one place."
        }
        action={
          view === "cases" &&
          !caseId &&
          !params.has("new") &&
          !params.has("from") ? (
            <Link className="button primary" href="/cases?new=1">
              New request
            </Link>
          ) : (
            <button
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              Refresh context
            </button>
          )
        }
      />
      {w.error && (
        <ErrorState message={w.error} retry={() => window.location.reload()} />
      )}
      {!reviewAccess ? (
        <EmptyState
          title="Reviews are available to assigned reviewers."
          description="Track your requests and their review progress in Work."
        >
          <Link href="/cases" className="button secondary">
            Open Work
          </Link>
        </EmptyState>
      ) : w.loading ? (
        <LoadingState label="Loading your work…" />
      ) : caseId && !current ? (
        <EmptyState
          title="Work item unavailable"
          description="Refresh or open another request you can access."
        />
      ) : current ? (
        <CaseWorkspace current={current} w={w} user={user} />
      ) : view === "cases" && (params.has("new") || params.has("from")) ? (
        <CaseCreateForm
          user={user}
          origin={params.get("from")}
          busy={w.busy}
          submit={w.mutate}
          created={(id) => router.push(`/cases?case=${id}`)}
        />
      ) : (
        <>
          {canReview(user.role_id) && (
            <div className="work-tabs" role="tablist" aria-label="Work views">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "tasks"}
                onClick={() => setTab("tasks")}
              >
                My Tasks
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "decisions"}
                onClick={() => setTab("decisions")}
              >
                Needs My Decision
              </button>
            </div>
          )}
          <ActionLists
            view={tab === "decisions" ? "decisions" : "cases"}
            w={w}
          />
        </>
      )}
    </main>
  );
}
