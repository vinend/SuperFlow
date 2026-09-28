"use client";

import { useState } from "react";
import { ErrorState } from "./ui/primitives";

export function MemoText({ memo }: { memo: string }) {
  return (
    <div className="investment-memo" aria-label="Investment memo">
      {memo.split("\n").map((line, index) =>
        line.trim() === "" ? null : line.startsWith("- ") ? (
          <p key={index} className="memo-item">
            {line.slice(2)}
          </p>
        ) : (
          <p key={index} className={index === 0 ? "memo-title" : undefined}>
            {line}
          </p>
        ),
      )}
    </div>
  );
}

export function MemoEditor({
  memo,
  edited,
  busy,
  error: requestError,
  onSave,
}: {
  memo: string;
  edited: boolean;
  busy: boolean;
  error: string;
  onSave: (memo: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memo);
  const [error, setError] = useState("");
  if (!editing)
    return (
      <>
        <MemoText memo={memo} />
        <p className="muted small">
          {edited
            ? "Edited by Finance. Figures in the memo do not recalculate."
            : "Generated from the sources and results above; it updates until you edit it."}
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setText(memo);
            setEditing(true);
          }}
        >
          Edit memo
        </button>
      </>
    );
  return (
    <form
      className="workflow-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (text.trim().length < 20) {
          setError("The memo needs at least 20 characters.");
          return;
        }
        setError("");
        if (await onSave(text)) setEditing(false);
      }}
    >
      <label>
        Draft memo
        <textarea
          aria-label="Draft memo"
          rows={16}
          maxLength={8000}
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {(error || requestError) && (
        <ErrorState message={error || requestError} />
      )}
      <div className="task-actions">
        <button className="button primary" type="submit" disabled={busy}>
          Save memo
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
