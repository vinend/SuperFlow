"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

const PROMPTS = [
  "Where does reliability need attention?",
  "How much capacity could be released?",
  "What is slowing delivery?",
];

export function ImpactComposer({
  busy,
  submit,
}: {
  busy: boolean;
  submit: (question: string) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const send = (value: string) => {
    const clean = value.trim();
    if (clean.length >= 3 && !busy) void submit(clean);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(question);
  };
  return (
    <section
      className="impact-composer"
      aria-labelledby="impact-composer-title"
    >
      <div>
        <span className="composer-icon" aria-hidden="true">
          <Sparkles size={17} />
        </span>
        <div>
          <h2 id="impact-composer-title">Ask about impact</h2>
          <p>
            SuperFlow composes an approved view from metrics you may access.
          </p>
        </div>
      </div>
      <form onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="impact-question">
          Ask about quality, capacity, or delivery
        </label>
        <input
          id="impact-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about quality, capacity, or delivery…"
          maxLength={500}
          disabled={busy}
        />
        <button
          className="icon-button impact-submit"
          aria-label="Generate impact view"
          disabled={busy || question.trim().length < 3}
        >
          <ArrowUp size={17} />
        </button>
      </form>
      <div className="impact-prompts" aria-label="Suggested impact questions">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => send(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
