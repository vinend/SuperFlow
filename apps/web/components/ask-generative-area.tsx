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
import { SectionHeader } from "./ui/primitives";

const PROMPTS = [
  "Apa persyaratan autentikasi dalam POJK 21 Tahun 2023?",
  "Bagaimana pelindungan data konsumen dalam POJK 22 Tahun 2023?",
  "What changed in the latest regulation?",
  "Analyze proposal A.",
  "Investigate alert AML-2026-001.",
  "Where does reliability need attention?",
  "What do I need to do?",
  "What needs my approval?",
];

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
      if (w.documentFilter || w.includeOutdated || w.domain) {
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
        aria-label="Ask and intent"
        data-agent-ready={isReady}
      >
        <div className="compose-heading">
          <span>Ask / intent</span>
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
        <div className="query-scope" role="group" aria-label="Retrieval scope">
          {filters}
        </div>
        {!selection && (
          <div className="intent-suggestions" aria-label="Suggested requests">
            <span className="suggestion-label">Try a workspace</span>
            {PROMPTS.map((prompt) => (
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
          <section className="intent-history">
            <SectionHeader title="Recent knowledge questions" />
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
          </section>
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
          <p className="generated-loading" role="status">
            Selecting an approved workspace…
          </p>
        )}
        <GenerativeWorkspace
          selection={effectiveSelection}
          prompt={submittedPrompt}
          user={w.user}
          knowledge={{
            answer: w.answer,
            asking: w.asking,
            onSource: w.setSource,
            onDocument: w.openDocument,
          }}
        />
      </div>
    </div>
  );
}
