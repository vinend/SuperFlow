"use client";
import Link from "next/link";
import { useSession } from "./session";
import { useActionWorkspace } from "./use-action-workspace";
import {
  personName,
  reviewItemsFor,
  workItemsFor,
  workTitle,
  reviewsLabel,
} from "@/lib/product-view";
import { WorkItemRows } from "./action-lists";
import { RegulatoryAttention } from "./regulatory-attention";
import { ErrorState, LoadingState, SectionHeader } from "./ui/primitives";

export function HomeAttention() {
  const { user, users } = useSession();
  const w = useActionWorkspace(user, null);
  const work = workItemsFor(w.cases, w.runs, w.approvals, user);
  const reviews = reviewItemsFor(w.approvals, work, user.role_id);
  const attention = work.filter((item) => item.needsAttention);
  const orderedReviews = [...reviews].sort(
    (a, b) =>
      Number(b.work?.reliability === "Needs review") -
      Number(a.work?.reliability === "Needs review"),
  );
  return (
    <section className="home-attention" aria-label="Work needing attention">
      {w.error ? (
        <ErrorState message={w.error} retry={() => window.location.reload()} />
      ) : w.loading ? (
        <LoadingState label="Loading your next actions…" />
      ) : (
        <>
          {user.role_id !== "employee" && (
            <>
              <SectionHeader
                title={reviewsLabel(user.role_id)}
                detail="Requests awaiting your decision."
                action={
                  <Link href="/decisions" className="text-link">
                    Open reviews
                  </Link>
                }
              />
              {orderedReviews.length ? (
                <ul className="attention-list">
                  {orderedReviews
                    .slice(0, 3)
                    .map(({ approval, work: item }) => (
                      <li key={approval.id}>
                        <Link
                          href={`/decisions?case=${encodeURIComponent(approval.case_id)}`}
                        >
                          <strong>{workTitle(approval.case_title)}</strong>
                          <span>
                            {personName(approval.requested_by, users)} ·{" "}
                            {item?.reliability ||
                              "Review supporting information"}
                          </span>
                        </Link>
                        <span>Review request</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="attention-empty">
                  No reviews need your attention.
                </p>
              )}
            </>
          )}
          {user.role_id === "compliance" && <RegulatoryAttention />}
          <SectionHeader
            title="My Work"
            detail="Your next actions and requests in progress."
            action={
              <Link href="/cases" className="text-link">
                All my work
              </Link>
            }
          />
          {attention.length ? (
            <WorkItemRows items={attention.slice(0, 3)} users={users} compact />
          ) : work.some(
              (item) => !["Completed", "Closed"].includes(item.status),
            ) ? (
            <WorkItemRows
              items={work
                .filter(
                  (item) => !["Completed", "Closed"].includes(item.status),
                )
                .slice(0, 3)}
              users={users}
              compact
            />
          ) : (
            <p className="attention-empty">No active work right now.</p>
          )}
        </>
      )}
    </section>
  );
}
