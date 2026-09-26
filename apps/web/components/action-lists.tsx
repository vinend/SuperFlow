import Link from "next/link";
import { dateLabel } from "@/lib/api";
import { stateLabel } from "@/lib/workflow-view";
import type { useActionWorkspace } from "./use-action-workspace";
import { DataTable } from "./ui/data-table";
import { EmptyState, SectionHeader, StatusBadge } from "./ui/primitives";
export function ActionLists({
  view,
  w,
}: {
  view: "cases" | "workflows" | "decisions";
  w: ReturnType<typeof useActionWorkspace>;
}) {
  const queue = w.approvals.filter((approval) => approval.status === "PENDING");
  return view === "cases" ? (
    w.cases.length ? (
      <DataTable label="Cases" caption="Permitted cases and execution status">
        <thead>
          <tr>
            <th>Case</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Reliability</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {w.cases.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={`/cases?case=${item.id}`} className="document-name">
                  {item.title}
                </Link>
                <small className="cell-detail">
                  {item.type.replaceAll("_", " ")}
                </small>
              </td>
              <td>{item.owner_id}</td>
              <td>
                <StatusBadge status={stateLabel(item.status)} />
              </td>
              <td>{stateLabel(item.reliability_status)}</td>
              <td>{dateLabel(item.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    ) : (
      <EmptyState
        title="No permitted cases yet"
        description="Create a case manually or carry forward an authorized Ask result."
      />
    )
  ) : view === "workflows" ? (
    <>
      <SectionHeader
        title="Workflow definitions"
        detail="Code-defined versions; no visual editor."
      />
      {w.definitions.map((item) => (
        <div key={item.id} className="definition-row">
          <div>
            <h3>{item.name}</h3>
            <p className="muted">
              v{item.version} · {item.config.steps.length} configured steps
            </p>
          </div>
          <Link className="button secondary" href="/cases">
            Open a case to start
          </Link>
        </div>
      ))}
      <SectionHeader title="Workflow runs" />
      {w.runs.length ? (
        <DataTable label="Workflow runs" caption="Persistent workflow runs">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Current step</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {w.runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link href={`/workflows?case=${run.case_id}`}>
                    {run.definition_name}
                  </Link>
                  <small className="cell-detail">
                    v{run.definition_version}
                  </small>
                </td>
                <td>{stateLabel(run.current_step)}</td>
                <td>{stateLabel(run.status)}</td>
                <td>{dateLabel(run.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState
          title="No workflow runs"
          description="Start a versioned review from a Case Workspace."
        />
      )}
    </>
  ) : (
    <>
      <SectionHeader
        title="Pending human decisions"
        detail={`${queue.length} visible requests · authority is enforced by the API`}
      />
      {queue.length ? (
        <DataTable
          label="Decision queue"
          caption="Pending human review requests"
        >
          <thead>
            <tr>
              <th>Case / request</th>
              <th>Reviewer</th>
              <th>Requester</th>
              <th>Status</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((approval) => (
              <tr key={approval.id}>
                <td>
                  <Link href={`/decisions?case=${approval.case_id}`}>
                    {approval.case_title}
                  </Link>
                  <small className="cell-detail">
                    {approval.reason_required}
                  </small>
                </td>
                <td>{approval.requested_from}</td>
                <td>{approval.requested_by}</td>
                <td>
                  {approval.allowed_actions.length
                    ? "Awaiting your decision"
                    : "Awaiting reviewer"}
                </td>
                <td>{dateLabel(approval.requested_at)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState
          title="No pending decisions"
          description="Requests appear after a workflow reaches review or evidence recovery."
        />
      )}
    </>
  );
}
