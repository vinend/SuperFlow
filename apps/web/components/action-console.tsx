"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "./session";
import { ApplicationShell } from "./application-shell";
import { useActionWorkspace } from "./use-action-workspace";
import { CaseCreateForm } from "./case-forms";
import { CaseWorkspace } from "./case-workspace";
import { ActionLists } from "./action-lists";
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
  return (
    <main
      className="main-content action-workspace"
      id="workspace-main"
      tabIndex={-1}
      aria-labelledby="page-title"
    >
      <PageHeader
        eyebrow="Controlled action"
        title={
          current
            ? current.title
            : view === "cases"
              ? "Cases"
              : view === "workflows"
                ? "Workflows"
                : "Decision Center"
        }
        description={
          current
            ? "Inspect evidence, execute assigned steps, and record human decisions."
            : view === "cases"
              ? "Shared workspaces for reliable knowledge and explicit action."
              : view === "workflows"
                ? "Versioned review definitions and persistent execution."
                : "Review evidence before authorizing continuation."
        }
        action={
          view === "cases" &&
          !caseId &&
          !params.has("new") &&
          !params.has("from") ? (
            <Link className="button primary" href="/cases?new=1">
              New case
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
      {w.loading ? (
        <LoadingState label="Loading authorized action workspace…" />
      ) : caseId && !current ? (
        <EmptyState
          title="Case unavailable"
          description="Refresh or open another permitted case."
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
        <ActionLists view={view} w={w} />
      )}
    </main>
  );
}
