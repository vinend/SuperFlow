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
    <section className="home-attention" aria-label="Work needing attention">
      <h2>Needs your attention</h2>
      {w.error ? (
        <ErrorState message={w.error} retry={() => window.location.reload()} />
      ) : w.loading ? (
        <LoadingState label="Loading your work…" />
      ) : (
        <ul className="attention-list">
          {reviews.length > 0 && (
            <li>
              <Link href="/cases">
                <strong>
                  {reviews.length}{" "}
                  {reviews.length === 1 ? "decision" : "decisions"} waiting
                </strong>
                <span>Open Work</span>
              </Link>
            </li>
          )}
          <li>
            <Link href="/cases">
              <strong>
                {active.length} active{" "}
                {active.length === 1 ? "work item" : "work items"}
              </strong>
              <span>View work</span>
            </Link>
          </li>
          {user.role_id === "compliance" && (
            <li>
              <Link href="/regulatory">
                <strong>Regulatory Review</strong>
                <span>Review changes and gaps</span>
              </Link>
            </li>
          )}
          {user.role_id === "compliance" && (
            <li>
              <Link href="/investigations">
                <strong>Investigation Review</strong>
                <span>Review assigned alerts</span>
              </Link>
            </li>
          )}
          {user.role_id === "finance" && (
            <li>
              <Link href="/investment">
                <strong>Investment Analysis</strong>
                <span>Review proposals</span>
              </Link>
            </li>
          )}
          {user.role_id === "governance" && (
            <li>
              <Link href="/knowledge">
                <strong>Knowledge Library</strong>
                <span>Maintain trusted sources</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
