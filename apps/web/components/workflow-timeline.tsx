"use client";

import type { WorkflowTimelineProps } from "@/lib/workspace-contracts";
import { stateLabel } from "@/lib/workflow-view";
import { dateLabel } from "@/lib/api";
import { StatusBadge, SectionHeader } from "./ui/primitives";

export function WorkflowTimeline({ workflow }: WorkflowTimelineProps) {
  return (
    <section aria-label="Workflow timeline">
      <SectionHeader
        title="Workflow progression"
        detail={`${workflow.definition_name} · v${workflow.definition_version}`}
      />
      <ol className="workflow-timeline">
        {workflow.steps.map((step) => (
          <li
            key={step.id}
            aria-current={
              workflow.current_step === step.key ? "step" : undefined
            }
            className={workflow.current_step === step.key ? "current" : ""}
          >
            <span className="timeline-marker" aria-hidden="true" />
            <div className="workflow-step-heading">
              <strong>{step.title}</strong>
              <StatusBadge status={stateLabel(step.status)} />
            </div>
            <p className="muted small">
              {step.type} {step.owner_id && `· ${step.owner_id}`}{" "}
              {step.started_at && `· ${dateLabel(step.started_at)}`}{" "}
              {step.retry_count > 0 && `· ${step.retry_count} retries`}
            </p>
            {step.attempts.length > 0 && (
              <details>
                <summary>{step.attempts.length} recorded attempts</summary>
                <ul className="attempt-list">
                  {step.attempts.map((attempt) => (
                    <li key={attempt.id}>
                      <strong>
                        Attempt {attempt.number} · {stateLabel(attempt.outcome)}
                      </strong>
                      <p>{attempt.reason}</p>
                      <small>
                        {attempt.actor_id} ·{" "}
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
          Escalated by {workflow.escalated_by}: {workflow.escalation_reason}
        </p>
      )}
    </section>
  );
}
