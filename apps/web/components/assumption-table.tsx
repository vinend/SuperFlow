"use client";

import { useState } from "react";
import type { Source, User } from "@/lib/api";
import type { InputView } from "@/lib/investment-contracts";
import { personName } from "@/lib/product-view";
import { formatValue, INPUT_LABELS } from "@/lib/investment-view";
import { DataTable } from "./ui/data-table";
import { ErrorState, StatusBadge } from "./ui/primitives";

export function AssumptionTable({
  inputs,
  onSource,
}: {
  inputs: InputView[];
  onSource: (source: Source) => void;
}) {
  return (
    <DataTable
      label="Assumptions"
      caption="Required inputs, the value used and every source that states it"
    >
      <thead>
        <tr>
          <th>Input</th>
          <th>Value used</th>
          <th>Source values</th>
        </tr>
      </thead>
      <tbody className="assumption-rows">
        {inputs.map((input) => (
          <tr key={input.key}>
            <td>
              <strong>{input.label}</strong>
              <small className="cell-detail">
                <StatusBadge status={INPUT_LABELS[input.status]} />
              </small>
            </td>
            <td>
              {input.status === "conflict"
                ? "Choose a source value"
                : formatValue(input.value, input.unit)}
            </td>
            <td>
              {input.assumptions.length === 0 ? (
                <span className="muted small">
                  Not stated in the selected sources.
                </span>
              ) : (
                <ul className="assumption-sources">
                  {input.assumptions.map((item) => (
                    <li key={item.id}>
                      <button
                        className="text-button"
                        onClick={() => onSource(item.source)}
                      >
                        [{item.source.citation_id}] {item.source.title} · v
                        {item.source.version}
                      </button>
                      <span>
                        {item.label}: {formatValue(item.value, item.unit)} (
                        {item.period})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function InputDecision({
  input,
  users,
  busy,
  error: requestError,
  onSelect,
  onSource,
}: {
  input: InputView;
  users: User[];
  busy: boolean;
  error: string;
  onSelect: (assumptionId: string, reason: string) => Promise<unknown>;
  onSource: (source: Source) => void;
}) {
  const [choice, setChoice] = useState(input.selection?.assumption_id || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const headingId = `input-${input.key}`;
  return (
    <article className="gap-finding" aria-labelledby={headingId}>
      <div className="gap-heading">
        <div>
          <h3 id={headingId}>{input.label}</h3>
          <p className="muted small">
            Sources state different values. SuperFlow does not pick one for you.
          </p>
        </div>
        <StatusBadge status={INPUT_LABELS[input.status]} />
      </div>
      <form
        className="workflow-form gap-decision"
        aria-label={`Select value for ${input.label}`}
        onSubmit={(event) => {
          event.preventDefault();
          const problem = !choice
            ? "Choose the source value to use."
            : !reason.trim()
              ? "Record why this source value should be used."
              : "";
          setError(problem);
          if (!problem) void onSelect(choice, reason.trim());
        }}
      >
        <fieldset className="value-choice">
          <legend>Source values</legend>
          {input.assumptions.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name={`choice-${input.key}`}
                value={item.id}
                checked={choice === item.id}
                disabled={busy}
                onChange={() => setChoice(item.id)}
              />
              <span>
                <strong>{formatValue(item.value, item.unit)}</strong> ·{" "}
                {item.source.title} ({item.label})<q>{item.quote}</q>
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => onSource(item.source)}
              >
                Inspect [{item.source.citation_id}]
              </button>
            </label>
          ))}
        </fieldset>
        {input.selection && (
          <p className="muted small">
            Selected by {personName(input.selection.selected_by, users)}:{" "}
            {input.selection.reason}
          </p>
        )}
        <label>
          Reason (required)
          <textarea
            aria-label={`Reason for ${input.label}`}
            rows={2}
            maxLength={2000}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {(error || requestError) && (
          <ErrorState message={error || requestError} />
        )}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "Recording…" : "Use selected value"}
        </button>
      </form>
    </article>
  );
}
