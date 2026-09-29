"use client";

import Link from "next/link";
import { ApplicationShell } from "./application-shell";
import { ControlledImpactWorkspace } from "./controlled-impact-workspace";
import { ImpactComposer } from "./impact-composer";
import { useImpactWorkspace } from "./use-impact-workspace";
import { useSession } from "./session";
import { canViewImpact } from "@/lib/product-view";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "./ui/primitives";

export function ImpactConsole() {
  const { user } = useSession();
  return (
    <ApplicationShell view="impact">
      <ImpactWorkspace key={user.id} />
    </ApplicationShell>
  );
}

function ImpactWorkspace() {
  const { user } = useSession();
  const allowed = canViewImpact(user.role_id);
  return (
    <main
      className="main-content impact-workspace"
      id="workspace-main"
      tabIndex={-1}
      aria-labelledby="page-title"
    >
      <PageHeader
        eyebrow="Business impact"
        title="Impact"
        description="Measure quality, capacity, and delivery from governed operational records."
      />
      {!allowed ? (
        <EmptyState
          title="Impact is available to review and control roles."
          description="Use My Work to track your own requests and next actions."
        >
          <Link href="/cases" className="button secondary">
            Open My Work
          </Link>
        </EmptyState>
      ) : (
        <ImpactData user={user} />
      )}
    </main>
  );
}

function ImpactData({ user }: { user: ReturnType<typeof useSession>["user"] }) {
  const w = useImpactWorkspace(user);
  return (
    <>
      <ImpactComposer busy={w.busy} submit={w.ask} />
      {w.error ? (
        <ErrorState message={w.error} retry={() => window.location.reload()} />
      ) : w.loading || !w.workspace ? (
        <LoadingState label="Composing your impact view…" />
      ) : (
        <ControlledImpactWorkspace workspace={w.workspace} />
      )}
    </>
  );
}
