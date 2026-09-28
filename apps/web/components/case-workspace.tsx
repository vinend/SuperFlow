"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateLabel, type Source, type User } from "@/lib/api";
import type { CaseView } from "@/lib/workflow-contracts";
import {
  businessStatus,
  personName,
  WORK_TYPES,
  activityLabel,
} from "@/lib/product-view";
import { useSession } from "./session";
import type { useActionWorkspace } from "./use-action-workspace";
import { EvidenceAttach } from "./case-forms";
import { WorkflowTimeline } from "./workflow-timeline";
import { ApprovalPanel } from "./approval-panel";
import { EvidenceChecklist } from "./evidence-checklist";
import { SourcePanel } from "./source-panel";
import { InvestmentContext } from "./investment-context";
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
  const { users } = useSession();
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
  const remediation = current.type === "remediation";
  const action = async (path: string, values: Record<string, unknown> = {}) => {
    await w.mutate(path, values);
  };
  return (
    <>
      <div className="case-context-bar">
        <StatusBadge status={businessStatus(current.status)} />
        <span>Owner: {personName(current.owner_id, users)}</span>
        <span>{WORK_TYPES[current.type]}</span>
        <span>Updated {dateLabel(current.updated_at)}</span>
        <Link href="/cases">My Work</Link>
      </div>
      <div className="case-layout">
        <div className="case-execution">
          {current.description && (
            <p className="case-description">{current.description}</p>
          )}
          {current.type === "investment" && (
            <InvestmentContext caseId={current.id} user={user} />
          )}
          {current.allowed_actions.includes("edit") && (
            <details
              open={editing}
              onToggle={(event) => setEditing(event.currentTarget.open)}
              className="case-edit"
            >
              <summary>Edit request details</summary>
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
                    aria-label="Edit request title"
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
                      <select
                        aria-label="Edit request owner"
                        value={owner || current.owner_id}
                        onChange={(event) => setOwner(event.target.value)}
                      >
                        {users.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                <button className="button secondary" disabled={w.busy}>
                  Save request
                </button>
              </form>
            </details>
          )}
          {current.allowed_actions.includes("start_workflow") && (
            <section className="workflow-start">
              <SectionHeader
                title="Submit for review"
                detail="Source-backed evidence still requires an independent human decision."
              />
              {w.definitions
                .filter((definition) => definition.id === "generic-review-v1")
                .map((definition) => (
                  <div key={definition.id} className="definition-row">
                    <button
                      className="button primary"
                      disabled={w.busy}
                      onClick={() =>
                        void action(`/api/workflows/${definition.id}/start`, {
                          case_id: current.id,
                        })
                      }
                    >
                      Submit for review
                    </button>
                  </div>
                ))}
            </section>
          )}
          {current.workflow && (
            <>
              {current.workflow.tasks.some(
                (task) => !["DONE", "CANCELLED"].includes(task.status),
              ) && (
                <SectionHeader
                  title="Your next action"
                  detail={businessStatus(current.workflow.status)}
                />
              )}
              <ul className="task-list" aria-label="Action items">
                {current.workflow.tasks
                  .filter(
                    (task) => !["DONE", "CANCELLED"].includes(task.status),
                  )
                  .map((task) => (
                    <li key={task.id}>
                      <div>
                        <strong>
                          {remediation
                            ? "Update the procedure or control"
                            : "Check supporting information"}
                        </strong>
                        {remediation && (
                          <p className="small">{task.description}</p>
                        )}
                        <p className="muted small">
                          {personName(task.owner_id, users)} · due{" "}
                          {dateLabel(task.due_at)}
                        </p>
                        <StatusBadge status={businessStatus(task.status)} />
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
                            {item === "start"
                              ? remediation
                                ? "Begin remediation"
                                : "Begin review"
                              : remediation
                                ? "Remediation completed"
                                : "Information checked"}
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
                        ? "Continue review"
                        : "Try evidence check again"}
                    </button>
                  ))}
                {current.workflow.allowed_actions.includes("escalate") && (
                  <details>
                    <summary>Request higher-authority review</summary>
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
          <section className="case-audit" aria-label="Activity">
            <SectionHeader
              title="Activity"
              detail="Request updates and recorded decisions."
            />
            <ol>
              {current.activity.map((event) => (
                <li key={event.id}>
                  <strong>{activityLabel(event)}</strong>
                  <span>
                    {personName(event.actor_id, users)} ·{" "}
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
              <summary>Close this request</summary>
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
                Close request and pending actions
              </button>
            </details>
          )}
        </div>
        <aside className="case-evidence" aria-label="Supporting information">
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
                      {businessStatus(approval.status)} ·{" "}
                      {personName(
                        approval.decided_by || approval.requested_from,
                        users,
                      )}
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
