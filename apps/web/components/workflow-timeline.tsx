"use client";
import type { WorkflowTimelineProps } from "@/lib/workspace-contracts";
import { businessStatus, progressFor, personName } from "@/lib/product-view";
import { dateLabel } from "@/lib/api";
import { useSession } from "./session";
import { StatusBadge, SectionHeader } from "./ui/primitives";

export function WorkflowTimeline({ workflow }: WorkflowTimelineProps) {
  const { users } = useSession();
  const reviewStep = workflow.steps.find(
    (step) => step.type === "APPROVAL" && step.key === workflow.current_step,
  );
  const progress = progressFor(
    workflow,
    users.find((person) => person.id === reviewStep?.owner_id)?.role_id,
  );
  return (
    <section aria-label="Progress">
      <SectionHeader
        title="Progress"
        detail="Information, review, and completion."
      />
      <ol className="workflow-timeline">
        <li>
          <span className="timeline-marker" aria-hidden="true" />
          <div className="workflow-step-heading">
            <strong>Request submitted</strong>
            <StatusBadge status="Completed" />
          </div>
          <p className="muted small">{dateLabel(workflow.created_at)}</p>
        </li>
        {progress.map((step) => (
          <li
            key={step.key}
            aria-current={step.current ? "step" : undefined}
            className={step.current ? "current" : ""}
          >
            <span className="timeline-marker" aria-hidden="true" />
            <div className="workflow-step-heading">
              <strong>
                {step.current && workflow.status === "ESCALATED"
                  ? "Higher-authority review"
                  : step.label}
              </strong>
              <StatusBadge status={step.status} />
            </div>
            <p className="muted small">
              {[
                step.ownerId ? personName(step.ownerId, users) : null,
                step.timestamp ? dateLabel(step.timestamp) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {step.attempts.length > 0 && (
              <details>
                <summary>Evidence check history</summary>
                <ul className="attempt-list">
                  {step.attempts.map((attempt) => (
                    <li key={attempt.id}>
                      <strong>
                        Check {attempt.number} ·{" "}
                        {businessStatus(attempt.outcome)}
                      </strong>
                      <p>{attempt.reason}</p>
                      <small>
                        {personName(attempt.actor_id, users)} ·{" "}
                        {new Date(attempt.created_at).toLocaleString()}
                      </small>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
      {workflow.escalation_reason && (
        <p className="workflow-note">
          Escalated by {personName(workflow.escalated_by, users)}:{" "}
          {workflow.escalation_reason}
        </p>
      )}
    </section>
  );
}
