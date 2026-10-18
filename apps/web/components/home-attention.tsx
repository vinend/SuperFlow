"use client";
import Link from "next/link";
import { useSession } from "./session";
import { useActionWorkspace } from "./use-action-workspace";
import { reviewItemsFor, workItemsFor } from "@/lib/product-view";
import { ErrorState, LoadingState } from "./ui/primitives";

export function HomeAttention() {
  const { user } = useSession();
  const w = useActionWorkspace(user, null);
  const work = workItemsFor(w.cases, w.runs, w.approvals, user);
  const reviews = reviewItemsFor(w.approvals, work, user.role_id);
  const active = work.filter(
    (item) => !["Completed", "Closed"].includes(item.status),
  );
  return (
    <section className="home-attention" aria-label="Needs your attention">
      <h2>Needs your attention</h2>
      {w.error ? (
        <ErrorState message={w.error} retry={() => window.location.reload()} />
      ) : w.loading ? (
        <LoadingState label="Loading your work…" />
      ) : (
        <div className="launchpad-items">
          <Link href="/cases" className="launchpad-item">
            <strong>
              {active.length} active work{" "}
              {active.length === 1 ? "item" : "items"}
            </strong>
            <span>View work</span>
          </Link>
          {user.role_id !== "employee" && (
            <Link href="/cases?tab=decisions" className="launchpad-item">
              <strong>
                {reviews.length}{" "}
                {reviews.length === 1 ? "decision" : "decisions"} waiting
              </strong>
              <span>Needs my decision</span>
            </Link>
          )}
          {user.role_id === "compliance" && (
            <Link href="/regulatory" className="launchpad-item">
              <strong>Regulatory review</strong>
              <span>Review changes and gaps</span>
            </Link>
          )}
          {user.role_id === "finance" && (
            <Link href="/investment" className="launchpad-item">
              <strong>Investment analysis</strong>
              <span>Review assumptions and results</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
