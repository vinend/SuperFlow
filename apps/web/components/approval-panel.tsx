"use client";

import { useState } from "react";
import type { ApprovalPanelProps } from "@/lib/workspace-contracts";
import {
  DECISION_LABELS,
  decisionError,
  stateLabel,
  type DecisionAction,
} from "@/lib/workflow-view";
import { EvidenceChecklist } from "./evidence-checklist";
import { ErrorState, Metadata, StatusBadge } from "./ui/primitives";

export function ApprovalPanel({
  approval,
  context,
  busy,
  onDecision,
  onSource,
  onDocument,
}: ApprovalPanelProps) {
  const [action, setAction] = useState<DecisionAction>(
    approval.allowed_actions[0] || "approve",
  );
  const [reason, setReason] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="approval-panel" aria-label="Approval Panel">
      <div className="section-header">
        <h2>Human decision</h2>
        <StatusBadge status={stateLabel(approval.status)} />
      </div>
      <p>{approval.reason_required}</p>
      <Metadata
        items={[
          { label: "Reviewer", value: approval.requested_from },
          { label: "Requester", value: approval.requested_by },
          { label: "Authority", value: approval.requested_role },
        ]}
      />
      <EvidenceChecklist
        result={context.reliability}
        sources={context.sources}
        onSource={onSource}
        onDocument={onDocument}
      />
      {context.sources.length > 0 && (
        <div className="approval-sources">
          <h3>Inspect supporting sources</h3>
          {context.sources.map((source) => (
            <button
              key={source.chunk_id}
              className="source-reference"
              onClick={() => onSource(source)}
            >
              <span className="citation-number">{source.citation_id}</span>
              <span>
                {source.title}
                <small>
                  {" "}
                  v{source.version} · {source.section_path}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
      {approval.decision_reason && (
        <p className="workflow-note">
          Decision by {approval.decided_by}: {approval.decision_reason}
        </p>
      )}
      {approval.allowed_actions.length > 0 ? (
        <form
          className="workflow-form"
          onSubmit={(event) => {
            event.preventDefault();
            const problem = decisionError(
              action,
              reason,
              label,
              context.reliability.status === "REVIEW_REQUIRED",
            );
            setError(problem);
            if (!problem) void onDecision(action, reason.trim(), label.trim());
          }}
        >
          <label>
            Decision
            <select
              aria-label="Decision action"
              value={action}
              disabled={busy}
              onChange={(event) => {
                setAction(event.target.value as DecisionAction);
                setError("");
              }}
            >
              {approval.allowed_actions.map((item) => (
                <option value={item} key={item}>
                  {DECISION_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {action === "override"
              ? "Override reason (required)"
              : "Decision reason"}
            <textarea
              aria-label="Decision reason"
              value={reason}
              maxLength={2000}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              required={
                action !== "approve" ||
                context.reliability.status === "REVIEW_REQUIRED"
              }
              rows={3}
            />
          </label>
          {action === "request-evidence" && (
            <label>
              Required evidence
              <input
                aria-label="Required evidence"
                value={label}
                minLength={3}
                maxLength={200}
                required
                disabled={busy}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
          )}
          {error && <ErrorState message={error} />}
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "Recording decision…" : DECISION_LABELS[action]}
          </button>
          <p className="muted small">
            Decisions are recorded with your identity. Overrides preserve Guard
            status and require Governance authority.
          </p>
        </form>
      ) : (
        <p className="muted small">
          {approval.status === "PENDING"
            ? "Only the assigned independent reviewer or Governance can decide. Guard prerequisites must be satisfied before approval."
            : "This decision is closed and remains in the audit history."}
        </p>
      )}
    </section>
  );
}
