"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateLabel, type Source, type User } from "@/lib/api";
import type { CaseView } from "@/lib/workflow-contracts";
import { stateLabel } from "@/lib/workflow-view";
import type { useActionWorkspace } from "./use-action-workspace";
import { EvidenceAttach } from "./case-forms";
import { WorkflowTimeline } from "./workflow-timeline";
import { ApprovalPanel } from "./approval-panel";
import { EvidenceChecklist } from "./evidence-checklist";
import { SourcePanel } from "./source-panel";
import { SectionHeader, StatusBadge } from "./ui/primitives";

export function CaseWorkspace({
  current,
  w,
  user,
}: {
  current: CaseView;
  w: ReturnType<typeof useActionWorkspace>;
  user: User;
}) {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const document = (id: string, versionId?: string) =>
    router.push(
      `/knowledge#document=${encodeURIComponent(id)}${versionId ? `&version=${encodeURIComponent(versionId)}` : ""}`,
    );
  const pending = current.approvals.filter(
    (approval) => approval.status === "PENDING",
  );
  const action = async (path: string, values: Record<string, unknown> = {}) => {
    await w.mutate(path, values);
  };
  return (
    <>
      <div className="case-context-bar">
        <StatusBadge status={stateLabel(current.status)} />
        <span>Owner: {current.owner_id}</span>
        <span>{current.type.replaceAll("_", " ")}</span>
        <span>Revision {current.revision}</span>
        <span>Updated {dateLabel(current.updated_at)}</span>
        <Link href="/cases">All cases</Link>
      </div>
      <div className="case-layout">
        <div className="case-execution">
          {current.description && (
            <p className="case-description">{current.description}</p>
          )}
          {current.allowed_actions.includes("edit") && (
            <details
              open={editing}
              onToggle={(event) => setEditing(event.currentTarget.open)}
              className="case-edit"
            >
              <summary>Edit case identity</summary>
              <form
                className="workflow-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await w.mutate(
                    `/api/cases/${current.id}`,
                    {
                      title: title || current.title,
                      owner_id: owner || current.owner_id,
                    },
                    "PATCH",
                  );
                  setEditing(false);
                }}
              >
                <label>
                  Title
                  <input
                    aria-label="Edit case title"
                    value={title || current.title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </label>
                {!current.workflow &&
                  ["manager", "governance"].includes(user.role_id) && (
                    <label>
                      Owner
                      <input
                        aria-label="Edit case owner"
                        value={owner || current.owner_id}
                        onChange={(event) => setOwner(event.target.value)}
                      />
                    </label>
                  )}
                <button className="button secondary" disabled={w.busy}>
                  Save case
                </button>
              </form>
            </details>
          )}
          {current.allowed_actions.includes("start_workflow") && (
            <section className="workflow-start">
              <SectionHeader
                title="Start controlled review"
                detail="Source-backed evidence still requires an independent human decision."
              />
              {w.definitions.map((definition) => (
                <div key={definition.id} className="definition-row">
                  <div>
                    <strong>{definition.name}</strong>
                    <p className="muted small">
                      v{definition.version} · task → Guard → authority routing →
                      decision
                    </p>
                  </div>
                  <button
                    className="button primary"
                    disabled={w.busy}
                    onClick={() =>
                      void action(`/api/workflows/${definition.id}/start`, {
                        case_id: current.id,
                      })
                    }
                  >
                    Start workflow
                  </button>
                </div>
              ))}
            </section>
          )}
          {current.workflow && (
            <>
              <SectionHeader
                title="Execution"
                detail={stateLabel(current.workflow.status)}
              />
              <ul className="task-list" aria-label="Case tasks">
                {current.workflow.tasks.map((task) => (
                  <li key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p className="muted small">
                        {task.owner_id} · due {dateLabel(task.due_at)}
                      </p>
                      <StatusBadge status={stateLabel(task.status)} />
                    </div>
                    <div className="task-actions">
                      {task.allowed_actions.map((item) => (
                        <button
                          key={item}
                          className="button secondary"
                          disabled={w.busy}
                          onClick={() =>
                            void action(`/api/tasks/${task.id}/${item}`)
                          }
                        >
                          {item === "start" ? "Start task" : "Complete task"}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="workflow-controls">
                {current.workflow.allowed_actions
                  .filter((item) => item !== "escalate")
                  .map((item) => (
                    <button
                      key={item}
                      className="button secondary"
                      disabled={w.busy}
                      onClick={() =>
                        void action(
                          `/api/workflow-runs/${current.workflow!.id}/${item}`,
                        )
                      }
                    >
                      {item === "advance"
                        ? "Resume workflow"
                        : "Retry failed step"}
                    </button>
                  ))}
                {current.workflow.allowed_actions.includes("escalate") && (
                  <details>
                    <summary>Escalate execution</summary>
                    <form
                      className="workflow-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void action(
                          `/api/workflow-runs/${current.workflow!.id}/escalate`,
                          { reason },
                        );
                      }}
                    >
                      <label>
                        Escalation reason
                        <textarea
                          aria-label="Escalation reason"
                          required
                          value={reason}
                          maxLength={2000}
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </label>
                      <button
                        className="button secondary"
                        disabled={w.busy || !reason.trim()}
                      >
                        Escalate to Governance
                      </button>
                    </form>
                  </details>
                )}
              </div>
              <WorkflowTimeline workflow={current.workflow} />
            </>
          )}
          <section className="case-audit" aria-label="Case audit trail">
            <SectionHeader
              title="Audit trail"
              detail="Recorded actors, state changes, and decision reasons."
            />
            <ol>
              {current.activity.map((event) => (
                <li key={event.id}>
                  <strong>{stateLabel(event.event_type)}</strong>
                  <span>
                    {event.actor_id} ·{" "}
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                  {typeof event.payload.reason === "string" && (
                    <p>{event.payload.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
          {current.allowed_actions.includes("cancel") && (
            <details className="case-cancel">
              <summary>Close this case without approval</summary>
              <button
                className="button secondary"
                disabled={w.busy}
                onClick={() =>
                  void w.mutate(
                    `/api/cases/${current.id}`,
                    { cancel: true },
                    "PATCH",
                  )
                }
              >
                Cancel case and open execution
              </button>
            </details>
          )}
        </div>
        <aside className="case-evidence" aria-label="Case evidence context">
          {pending.length > 0 ? (
            pending.map((approval) => (
              <ApprovalPanel
                key={`${approval.id}:${current.revision}`}
                approval={approval}
                context={current}
                busy={w.busy}
                onSource={setSource}
                onDocument={document}
                onDecision={async (item, decisionReason, label) => {
                  await action(`/api/approvals/${approval.id}/${item}`, {
                    reason: decisionReason,
                    evidence_label: item === "request-evidence" ? label : null,
                  });
                }}
              />
            ))
          ) : (
            <>
              <SectionHeader title="Evidence and reliability" />
              <EvidenceChecklist
                result={current.reliability}
                sources={current.sources}
                onSource={setSource}
                onDocument={document}
              />
              <div className="source-references">
                {current.sources.map((item) => (
                  <button
                    key={item.chunk_id}
                    className="source-reference"
                    onClick={() => setSource(item)}
                  >
                    <span className="citation-number">{item.citation_id}</span>
                    <span className="reference-title">
                      {item.title}
                      <small>
                        v{item.version} · {item.section_path}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {current.allowed_actions.includes("attach_evidence") && (
            <EvidenceAttach
              user={user}
              current={current}
              busy={w.busy}
              submit={w.mutate}
            />
          )}
          {current.approvals.some(
            (approval) => approval.status !== "PENDING",
          ) && (
            <details className="decision-history">
              <summary>Decision history</summary>
              {current.approvals
                .filter((approval) => approval.status !== "PENDING")
                .map((approval) => (
                  <div key={approval.id}>
                    <strong>
                      {stateLabel(approval.status)} ·{" "}
                      {approval.decided_by || approval.requested_from}
                    </strong>
                    <p>{approval.decision_reason}</p>
                  </div>
                ))}
            </details>
          )}
        </aside>
      </div>
      {source && (
        <SourcePanel
          source={source}
          close={() => setSource(null)}
          openDocument={document}
          reliability={current.reliability}
        />
      )}
    </>
  );
}
