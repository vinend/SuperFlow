"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, CornerDownLeft } from "lucide-react";
import type { ReactNode } from "react";

// Controlled input + toolbar composition informed by 21st.dev InputBar. See docs/UI_REFERENCES.md.
export function QuestionComposer({
  value,
  onChange,
  onSubmit,
  busy,
  disabled,
  toolbar,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  disabled: boolean;
  toolbar?: ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = ref.current!;
    input.style.height = "auto";
    input.style.height = `${Math.max(52, Math.min(input.scrollHeight, 140))}px`;
    input.style.overflowY = input.scrollHeight > 140 ? "auto" : "hidden";
  }, [value]);
  return (
    <form
      className="question-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && !busy) onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="question">
        Your question
      </label>
      <textarea
        rows={1}
        ref={ref}
        id="question"
        aria-label="Your question"
        aria-describedby="question-hint"
        minLength={3}
        maxLength={2000}
        value={value}
        disabled={disabled || busy}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask about a policy, procedure, or enterprise reference…"
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!disabled && !busy && value.trim().length >= 3) onSubmit();
          }
        }}
      />
      {toolbar && <div className="composer-context">{toolbar}</div>}
      <div className="composer-footer">
        <span id="question-hint">
          <CornerDownLeft size={13} aria-hidden="true" /> Enter to ask{" "}
          <span>· Shift + Enter for a new line</span>
        </span>
        <button
          className="ask-button"
          type="submit"
          disabled={busy || disabled || value.trim().length < 3}
          aria-label="Ask question"
        >
          {busy ? <span className="spinner" /> : <ArrowUp size={16} />}
          <span>{busy ? "Retrieving" : "Ask SuperFlow"}</span>
        </button>
      </div>
    </form>
  );
}
