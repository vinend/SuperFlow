import Link from "next/link";
import { dateLabel, type User } from "@/lib/api";
import {
  personName,
  reviewItemsFor,
  reviewReason,
  workItemsFor,
  workTitle,
} from "@/lib/product-view";
import type { WorkItemView } from "@/lib/product-view";
import type { useActionWorkspace } from "./use-action-workspace";
import { useSession } from "./session";
import { DataTable } from "./ui/data-table";
import { EmptyState, SectionHeader, StatusBadge } from "./ui/primitives";

export function WorkItemRows({
  items,
  users,
  compact = false,
}: {
  items: WorkItemView[];
  users: User[];
  compact?: boolean;
}) {
  return (
    <DataTable
      label="My Work"
      caption="Your requests, supporting information and review progress"
    >
      <thead>
        <tr>
          <th>Work item</th>
          <th>Status / next action</th>
          {!compact && (
            <>
              <th>People</th>
              <th>Reliability</th>
              <th>Updated</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>
              <Link href={item.href} className="document-name">
                {item.title}
              </Link>
              <small className="cell-detail">
                {item.type} · {item.currentStep}
              </small>
              {!compact && item.progress.length > 0 && (
                <details className="work-row-progress">
                  <summary>Progress</summary>
                  <ol>
                    {item.progress.map((step) => (
                      <li key={step.key}>
                        {step.label} · {step.status}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </td>
            <td>
              <StatusBadge status={item.status} />
              <Link className="cell-detail text-link" href={item.href}>
                {item.nextAction}
              </Link>
              {item.dueAt && (
                <small className="cell-detail">
                  Due {dateLabel(item.dueAt)}
                </small>
              )}
            </td>
            {!compact && (
              <>
                <td>
                  {personName(item.ownerId, users)}
                  {item.reviewerId && (
                    <small className="cell-detail">
                      Review: {personName(item.reviewerId, users)}
                    </small>
                  )}
                </td>
                <td>{item.reliability}</td>
                <td>{dateLabel(item.updatedAt)}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
export function ActionLists({
  view,
  w,
}: {
  view: "cases" | "workflows" | "decisions";
  w: ReturnType<typeof useActionWorkspace>;
}) {
  const { user, users } = useSession();
  const work = workItemsFor(w.cases, w.runs, w.approvals, user);
  const queue = reviewItemsFor(w.approvals, work, user.role_id);
  if (view !== "decisions")
    return work.length ? (
      <WorkItemRows items={work} users={users} />
    ) : (
      <EmptyState
        title="No active work right now."
        description="Submit a request or continue from an Ask SuperFlow answer."
      />
    );
  return (
    <>
      <SectionHeader
        title="Needs your decision"
        detail="Inspect the request and supporting sources before deciding."
      />
      {queue.length ? (
        <DataTable
          label="Review queue"
          caption="Requests awaiting your decision"
        >
          <thead>
            <tr>
              <th>Request / context</th>
              <th>Requested by</th>
              <th>Reliability</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {queue.map(({ approval, work: item }) => (
              <tr key={approval.id}>
                <td>
                  <Link
                    className="document-name"
                    href={`/decisions?case=${encodeURIComponent(approval.case_id)}`}
                  >
                    {workTitle(approval.case_title)}
                  </Link>
                  <small className="cell-detail">
                    {reviewReason(
                      approval,
                      w.cases.find((c) => c.id === approval.case_id)
                        ?.reliability_status,
                    )}
                  </small>
                </td>
                <td>
                  {personName(approval.requested_by, users)}
                  <small className="cell-detail">
                    {dateLabel(approval.requested_at)}
                  </small>
                </td>
                <td>{item?.reliability || "Inspect reliability"}</td>
                <td>
                  <Link
                    className="text-link"
                    href={`/decisions?case=${encodeURIComponent(approval.case_id)}`}
                  >
                    Review request
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState
          title="No reviews need your attention."
          description="Requests assigned to you will appear here."
        />
      )}
    </>
  );
}
