"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "./session";
import { ApplicationShell } from "./application-shell";
import { useRegulatoryWorkspace } from "./use-regulatory-workspace";
import { RegulatoryReview } from "./regulatory-review";
import { RegulatoryStart } from "./regulatory-start";
import { RegulatoryList } from "./regulatory-list";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "./ui/primitives";

export function RegulatoryConsole() {
  const { user } = useSession();
  const params = useSearchParams();
  return (
    <ApplicationShell view="regulatory">
      <RegulatoryWorkspace key={`${user.id}:${params.toString()}`} />
    </ApplicationShell>
  );
}

function RegulatoryWorkspace() {
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const reviewId = params.get("review");
  const w = useRegulatoryWorkspace(user, reviewId);
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
          current ? "Regulatory Review / Review" : "Compliance workspace"
        }
        title={current ? current.document_title : "Regulatory Review"}
        description={
          current
            ? "Inspect what changed, decide proposed gaps, and track remediation to approval."
            : "Compare regulation versions, assess procedure and control impact, and track remediation."
        }
        action={
          current ? (
            <Link className="button secondary" href="/regulatory">
              All reviews
            </Link>
          ) : undefined
        }
      />
      {w.error && !current && (
        <ErrorState message={w.error} retry={() => window.location.reload()} />
      )}
      {w.loading ? (
        <LoadingState label="Loading regulatory reviews…" />
      ) : reviewId && !current ? (
        <EmptyState
          title="Regulatory review unavailable"
          description="It may be closed to your role, or it is tracked as a request in My Work."
        >
          <Link
            className="button secondary"
            href={`/cases?case=${encodeURIComponent(reviewId)}`}
          >
            Open in My Work
          </Link>
        </EmptyState>
      ) : current ? (
        <RegulatoryReview review={current} w={w} />
      ) : (
        <>
          {w.reviewer ? (
            <RegulatoryStart
              sources={w.sources}
              preselect={params.get("document")}
              busy={w.busy}
              onStart={async (documentId) => {
                const review = await w.start(documentId);
                if (review)
                  router.push(
                    `/regulatory?review=${encodeURIComponent(review.id)}`,
                  );
              }}
            />
          ) : (
            <EmptyState
              title="Regulatory Review is run by Compliance."
              description="Remediation assigned to you appears in My Work."
            >
              <Link className="button secondary" href="/cases">
                Open My Work
              </Link>
            </EmptyState>
          )}
          <RegulatoryList reviews={w.reviews} />
        </>
      )}
    </main>
  );
}
