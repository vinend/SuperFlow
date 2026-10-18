"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useAgent,
  useAgentContext,
  useCopilotKit,
  useFrontendTool,
} from "@copilotkit/react-core/v2/headless";
import { api } from "@/lib/api";
import {
  APPROVED_WORKSPACE_TOOL,
  WorkspaceResolutionSchema,
  type WorkspaceResolution,
} from "@/lib/workspace-catalog";
import type { useKnowledgeWorkspace } from "./use-knowledge-workspace";
import { QuestionComposer } from "./question-composer";
import { QuestionHistory } from "./question-history";
import { GenerativeWorkspace } from "./generative-workspace";
import { AskActivity } from "./ask-activity";

const PROMPTS: Record<string, string[]> = {
  employee: [
    "How many annual leave days do I get?",
    "How do I request system access?",
    "What do I need to do?",
  ],
  manager: [
    "What needs my approval?",
    "What do I need to do?",
    "What documents support an expense request?",
  ],
  compliance: [
    "What changed in the latest regulation?",
    "Apa persyaratan autentikasi dalam POJK 21 Tahun 2023?",
    "What needs my review?",
  ],
  finance: [
    "Analyze proposal A.",
    "Which assumptions need review?",
    "What needs my approval?",
  ],
  governance: ["Which sources need review?"],
};

export function AskGenerativeArea({
  w,
  filters,
}: {
  w: ReturnType<typeof useKnowledgeWorkspace>;
  filters: ReactNode;
}) {
  const { agent, isReady } = useAgent({ agentId: "workspace" });
  const { copilotkit } = useCopilotKit();
  const [selection, setSelection] = useState<WorkspaceResolution | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const effectiveSelection: WorkspaceResolution | null =
    selection ??
    (!busy && w.answer
      ? {
          status: "ready",
          intent: "knowledge_answer",
          view: null,
          investigation_id: null,
          alert_reference: null,
          message: "Opening your saved source-grounded answer.",
        }
      : null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useAgentContext({
    description:
      "Current SuperFlow demo identity (context only; FastAPI reauthorizes every domain read)",
    value: { user_id: w.user.id, role: w.user.role_id },
  });
  useFrontendTool(
    {
      name: APPROVED_WORKSPACE_TOOL,
      description:
        "Display one approved SuperFlow workspace selected by the workspace agent. Read only; never approve, submit, or alter domain state.",
      parameters: WorkspaceResolutionSchema,
      handler: async (input) => {
        const parsed = WorkspaceResolutionSchema.parse(input);
        if (live.current) setSelection(parsed);
        return "Approved workspace displayed. Domain APIs remain authoritative.";
      },
    },
    [],
  );

  async function resolve(prompt: string) {
    if (busy || w.asking || prompt.trim().length < 3) return;
    const clean = prompt.trim();
    w.setQuestion(clean);
    setSubmittedPrompt(clean);
    setSelection(null);
    setError("");
    setBusy(true);
    try {
      if (w.documentFilter || w.includeOutdated || w.domain || w.webSearch) {
        setSelection({
          status: "ready",
          intent: "knowledge_answer",
          view: null,
          investigation_id: null,
          alert_reference: null,
          message: "Searching within your selected knowledge sources.",
        });
        await w.submitQuestion(undefined, clean);
        return;
      }
      let resolution: WorkspaceResolution | null = null;
      if (isReady) {
        try {
          agent.addMessage({
            id: crypto.randomUUID(),
            role: "user",
            content: clean,
          });
          await agent.runAgent();
          resolution = WorkspaceResolutionSchema.parse(
            (agent.state as Record<string, unknown>).resolution,
          );
        } catch {
          // The approved deterministic backend route remains available when the
          // transient AG-UI runtime is unavailable.
        }
      }
      if (!resolution) {
        resolution = WorkspaceResolutionSchema.parse(
          await api<unknown>("/api/workspace-intent", w.user, {
            method: "POST",
            body: JSON.stringify({ prompt: clean }),
          }),
        );
      }
      if (!live.current) return;
      let displayed = false;
      if (isReady) {
        try {
          const tool = await copilotkit.runTool({
            name: APPROVED_WORKSPACE_TOOL,
            agentId: "workspace",
            parameters: resolution,
          });
          displayed = !tool.error;
        } catch {
          // Runtime registration may still be loading or reconnecting. The
          // same schema-validated, read-only view can be displayed directly.
        }
      }
      if (!displayed && live.current) setSelection(resolution);
      if (
        resolution.intent === "knowledge_answer" &&
        resolution.status === "ready"
      )
        await w.submitQuestion(undefined, clean);
    } catch {
      if (live.current)
        setError(
          "The workspace could not be opened. Try again or use the direct navigation. Knowledge Ask remains available from Home.",
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }

  return (
    <div
      className={`generative-layout ${effectiveSelection ? "has-result" : ""}`}
    >
      <aside
        className="intent-rail"
        aria-label="Ask SuperFlow"
        data-agent-ready={isReady}
      >
        <div className="compose-heading">
          <span>Your question</span>
          <Link className="text-link" href="/knowledge">
            View sources
          </Link>
        </div>
        <QuestionComposer
          value={w.question}
          onChange={w.setQuestion}
          onSubmit={() => void resolve(w.question)}
          busy={busy || w.asking}
          disabled={w.loading}
        />
        <details className="search-options">
          <summary>
            Search options
            {w.webSearch || w.domain || w.documentFilter || w.includeOutdated
              ? " · customized"
              : ""}
          </summary>
          <div className="websearch-controls">
            <button
              type="button"
              className={`button secondary websearch-toggle ${w.webSearch ? "enabled" : ""}`}
              aria-pressed={w.webSearch}
              disabled={busy || w.asking}
              onClick={() => w.setWebSearch(!w.webSearch)}
            >
              Enable WebSearch{" "}
              <span aria-hidden="true">{w.webSearch ? "On" : "Off"}</span>
            </button>
            {w.webSearch && (
              <details className="websearch-options">
                <summary>WebSearch options</summary>
                <p className="muted small">
                  Public pages are read on this device. Your question is sent to
                  Google as a public search query. Reading up to two results can
                  take several minutes.
                </p>
                <label>
                  Public Google query (optional)
                  <input
                    maxLength={200}
                    value={w.webQuery}
                    onChange={(event) => w.setWebQuery(event.target.value)}
                    placeholder="Defaults to your question"
                    disabled={busy || w.asking}
                  />
                </label>
                <label>
                  Selected result URLs (optional)
                  <textarea
                    value={w.webUrls}
                    onChange={(event) => w.setWebUrls(event.target.value)}
                    placeholder="If Google blocks automation, paste up to two public result URLs."
                    disabled={busy || w.asking}
                  />
                </label>
                <p className="muted small">
                  Pasted URLs are read directly and labelled as your selected
                  sources; they are not claimed as an automated Google search.
                </p>
              </details>
            )}
            {w.webSearch && w.asking && (
              <p role="status" className="muted small">
                WebSearch is running locally: browser search, source reading,
                vision, then AI synthesis. Please keep this page open.
              </p>
            )}
          </div>
          <div
            className="query-scope"
            role="group"
            aria-label="Retrieval scope"
          >
            {filters}
          </div>
        </details>
        {!selection && (
          <div className="intent-suggestions" aria-label="Suggested requests">
            <span className="suggestion-label">Try asking</span>
            {(PROMPTS[w.user.role_id] || PROMPTS.employee).map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={busy || w.loading}
                onClick={() => void resolve(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        {w.history.length > 0 && (
          <details className="intent-history">
            <summary>Recent questions</summary>
            <QuestionHistory
              items={w.history}
              open={async (id) => {
                setSelection({
                  status: "ready",
                  intent: "knowledge_answer",
                  view: null,
                  investigation_id: null,
                  alert_reference: null,
                  message: "Opening your saved source-grounded answer.",
                });
                await w.openQuestion(id);
              }}
              selectedId={w.answer?.id}
              loading={w.loading}
              disabled={busy || w.asking}
              limit={5}
            />
          </details>
        )}
      </aside>
      <div className="generated-column">
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {w.error && (
          <p className="error-message" role="alert">
            {w.error}
          </p>
        )}
        {busy && !selection && (
          <AskActivity
            progress={{
              stage: "routing",
              message: "Selecting an approved workspace for your request.",
            }}
          />
        )}
        {!(busy && !selection) && (
          <GenerativeWorkspace
            selection={effectiveSelection}
            prompt={submittedPrompt}
            user={w.user}
            knowledge={{
              answer: w.answer,
              asking: w.asking,
              progress: w.progress,
              webSearch: w.webSearch,
              scope:
                w.documents.find((document) => document.id === w.documentFilter)
                  ?.title ||
                w.domain ||
                "Your accessible sources",
              onSource: w.setSource,
              onDocument: w.openDocument,
            }}
          />
        )}
      </div>
    </div>
  );
}
