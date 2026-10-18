"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  const decisionTab =
    canReview(user.role_id) &&
    (view === "decisions" || params.get("tab") === "decisions");
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
            : "Your tasks and decisions in one place."
        }
        action={
          !decisionTab &&
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
            <nav className="work-tabs" aria-label="Work sections">
              <Link
                href="/cases"
                aria-current={!decisionTab ? "page" : undefined}
              >
                My Tasks
              </Link>
              <Link
                href="/cases?tab=decisions"
                aria-current={decisionTab ? "page" : undefined}
              >
                Needs My Decision
              </Link>
            </nav>
          )}
          {!canReview(user.role_id) && (
            <h2 className="work-single-heading">My Tasks</h2>
          )}
          <ActionLists view={decisionTab ? "decisions" : "cases"} w={w} />
        </>
      )}
    </main>
  );
}
