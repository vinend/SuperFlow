"use client";

import Link from "next/link";
import { useState } from "react";
import { dateLabel, type Source, type User } from "@/lib/api";
import type { FindingView } from "@/lib/regulatory-contracts";
import { personName, roleLabel } from "@/lib/product-view";
import {
  BASIS_LABELS,
  confirmError,
  defaultDueDate,
  FINDING_LABELS,
  remediationLabel,
} from "@/lib/regulatory-view";
import { ErrorState, Metadata, StatusBadge } from "./ui/primitives";

type Decision = "confirm" | "reject";

export function GapFinding({
  finding,
  users,
  busy,
  error: requestError,
  onDecision,
  onSource,
}: {
  finding: FindingView;
  users: User[];
  busy: boolean;
  error: string;
  onDecision: (
    action: "confirm" | "reject",
    values: Record<string, unknown>,
  ) => Promise<unknown>;
  onSource: (source: Source) => void;
}) {
  const reassign = finding.allowed_actions.includes("reassign");
  const [decision, setDecision] = useState<Decision>("confirm");
  const [assigning, setAssigning] = useState(reassign);
  const [summary, setSummary] = useState(
    finding.reviewer_summary || finding.proposed_summary,
  );
  const [owner, setOwner] = useState(finding.suggested_owner_id);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const headingId = `finding-${finding.id}`;
  const statement = finding.reviewer_summary || finding.proposed_summary;
  const submit = async () => {
    const problem =
      decision === "reject"
        ? reason.trim()
          ? ""
          : "Record why this proposed gap does not apply."
        : confirmError(owner, dueDate, reassign ? "" : summary);
    setError(problem);
    if (problem) return;
    await onDecision(
      decision,
      decision === "reject"
        ? { reason: reason.trim() }
        : {
            owner_id: owner,
            due_date: dueDate,
            reason: reason.trim(),
            summary:
              reassign || summary.trim() === finding.proposed_summary
                ? null
                : summary.trim(),
          },
    );
  };
  return (
    <article className="gap-finding" aria-labelledby={headingId}>
      <div className="gap-heading">
        <div>
          <h3 id={headingId}>
            {finding.impacted.title} · {finding.impacted.section_path}
          </h3>
          <p className="muted small">
            {finding.section} · {BASIS_LABELS[finding.basis]}
          </p>
        </div>
        <StatusBadge status={FINDING_LABELS[finding.status]} />
      </div>
      <ul className="gap-issues" aria-label="Proposed gap details">
        {finding.issues.map((issue) => (
          <li key={issue.detail}>
            {issue.kind === "requirement_mismatch" ? (
              <>
                <strong>Potential gap</strong>
                <span>
                  New requirement: {issue.required} · Current procedure:{" "}
                  {issue.current}
                </span>
              </>
            ) : (
              <>
                <strong>New obligation not covered</strong>
                <span>{issue.required}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <details>
        <summary>View sources</summary>
        <section className="gap-evidence" aria-label="Evidence">
          {[finding.requirement, finding.impacted].map((source) => (
            <button
              key={source.chunk_id}
              className="source-reference"
              onClick={() => onSource(source)}
            >
              <span className="citation-number">{source.citation_id}</span>
              <span className="reference-title">
                {source.title}
                <small>
                  v{source.version} · {source.section_path} ·{" "}
                  {source.status === "active" ? "Current" : "Historical"}
                </small>
              </span>
            </button>
          ))}
        </section>
      </details>
      <p className="workflow-note">
        <strong>
          {finding.status === "PROPOSED"
            ? "Proposed by SuperFlow — your decision is required"
            : finding.reviewer_summary
              ? "Gap statement edited by reviewer"
              : "Gap statement"}
          :
        </strong>{" "}
        {statement}
      </p>
      {finding.status !== "PROPOSED" && (
        <p className="muted small">
          {FINDING_LABELS[finding.status]} by{" "}
          {personName(finding.decided_by, users)}
          {finding.decided_at ? ` · ${dateLabel(finding.decided_at)}` : ""}
          {finding.decision_reason ? ` · ${finding.decision_reason}` : ""}
        </p>
      )}
      {finding.remediation && (
        <div className="gap-remediation">
          <Metadata
            items={[
              {
                label: "Remediation",
                value: remediationLabel(finding) || "",
              },
              {
                label: "Owner",
                value: personName(finding.remediation.owner_id, users),
              },
              {
                label: "Due",
                value: dateLabel(finding.remediation.due_date),
              },
              ...(finding.remediation.reviewer_id
                ? [
                    {
                      label: "Approver",
                      value: personName(finding.remediation.reviewer_id, users),
                    },
                  ]
                : []),
            ]}
          />
          <Link
            className="text-link"
            href={`/cases?case=${encodeURIComponent(finding.remediation.case_id)}`}
          >
            Open remediation
          </Link>
        </div>
      )}
      {finding.allowed_actions.length > 0 && !assigning && (
        <div className="tag-row">
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setDecision("confirm");
              setAssigning(true);
            }}
          >
            Confirm gap
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setDecision("reject");
              setAssigning(true);
            }}
          >
            Not a gap
          </button>
        </div>
      )}
      {finding.allowed_actions.length > 0 && assigning && (
        <form
          className="workflow-form gap-decision"
          aria-label={`Decision for ${finding.impacted.title}`}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h4>
            {decision === "confirm"
              ? "Assign remediation"
              : "Record why this is not a gap"}
          </h4>
          {decision === "confirm" && (
            <>
              {!reassign && (
                <label>
                  Gap summary
                  <textarea
                    aria-label="Gap summary"
                    rows={3}
                    maxLength={2000}
                    value={summary}
                    disabled={busy}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </label>
              )}
              <div className="form-columns">
                <label>
                  Remediation owner
                  <select
                    aria-label="Remediation owner"
                    value={owner}
                    disabled={busy}
                    onChange={(event) => setOwner(event.target.value)}
                  >
                    {users.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} — {roleLabel(person.role_id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Due date
                  <input
                    aria-label="Remediation due date"
                    type="date"
                    value={dueDate}
                    disabled={busy}
                    required
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
              </div>
            </>
          )}
          <label>
            {decision === "reject" ? "Reason (required)" : "Reason (optional)"}
            <textarea
              aria-label={
                decision === "reject" ? "Rejection reason" : "Decision reason"
              }
              rows={2}
              maxLength={2000}
              value={reason}
              disabled={busy}
              required={decision === "reject"}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {(error || requestError) && (
            <ErrorState message={error || requestError} />
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {busy
              ? "Recording decision…"
              : reassign
                ? "Reassign remediation"
                : decision === "confirm"
                  ? "Create remediation"
                  : "Record not a gap"}
          </button>
          <p className="muted small">
            The owner must be able to access the regulation and procedure. An
            independent approver accepts the completed remediation.
          </p>
        </form>
      )}
    </article>
  );
}
