"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageSquare, Plus, Search, Sparkles, Pencil } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  useAgent,
  useAgentContext,
  useCopilotKit,
  useFrontendTool,
} from "@copilotkit/react-core/v2/headless";
import {
  APPROVED_WORKSPACE_TOOL,
  WorkspaceResolutionSchema,
  WORKSPACE_LABELS,
  type WorkspaceResolution,
} from "@/lib/workspace-catalog";
import { isPending, type ChatTurn } from "@/lib/chat";
import type { useKnowledgeWorkspace } from "./use-knowledge-workspace";
import { useChatSessions } from "./use-chat-sessions";
import { QuestionComposer } from "./question-composer";
import { GenerativeWorkspace } from "./generative-workspace";
import { AnswerCard } from "./answer-card";
import { AskActivity } from "./ask-activity";

const PROMPTS = [
  "Apa persyaratan autentikasi dalam POJK 21 Tahun 2023?",
  "How do cash flow actuals differ from projections in the FDIC guide?",
  "How does NIST connect incident response to cybersecurity risk management?",
  "What does the ILO recommend for well-being while teleworking?",
  "Analyze proposal A.",
  "What do I need to do?",
];

function ProcessHistory({ turn }: { turn: ChatTurn }) {
  const last = turn.events.at(-1);
  const elapsed = last
    ? Math.max(
        0,
        Math.round((Date.parse(last.at) - Date.parse(turn.created_at)) / 1000),
      )
    : 0;
  return (
    <details className="chat-process" open={isPending(turn) ? true : undefined}>
      <summary>
        <span
          className={isPending(turn) ? "process-dot working" : "process-dot"}
        />
        {isPending(turn) ? "Following your request" : "Process history"}
        <span>
          {turn.events.length} steps{elapsed > 0 ? ` · ${elapsed}s` : ""}
        </span>
      </summary>
      <ol aria-label="Process history">
        {turn.events.map((event, index) => (
          <li key={`${event.stage}:${event.at}:${index}`}>
            <span className="process-stage">
              {event.stage.replaceAll("_", " ")}
            </span>
            <p>{event.message}</p>
            <time dateTime={event.at}>
              +
              {Math.max(
                0,
                Math.round(
                  (Date.parse(event.at) - Date.parse(turn.created_at)) / 1000,
                ),
              )}
              s
            </time>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function AskGenerativeArea({
  w,
  filters,
}: {
  w: ReturnType<typeof useKnowledgeWorkspace>;
  filters: ReactNode;
}) {
  const c = useChatSessions(w.user);
  const { isReady } = useAgent({ agentId: "workspace" });
  const { copilotkit } = useCopilotKit();
  const [search, setSearch] = useState("");
  const [domainTurn, setDomainTurn] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const [displayedWorkspace, setDisplayedWorkspace] =
    useState<WorkspaceResolution | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const dispatched = useRef("");
  const importedLegacy = useRef("");
  const restoredScope = useRef("");
  const reduced = useReducedMotion();
  const busy = c.sending || Boolean(c.pending);
  const latest = c.chat?.turns.at(-1);
  const legacyId = w.answer?.id;
  const chatId = c.chat?.id;
  const importAnswer = c.importAnswer;
  const scope = latest?.scope;
  const {
    setDomain,
    setDocumentFilter,
    setIncludeOutdated,
    setWebSearch,
    setWebQuery,
    setWebUrls,
  } = w;
  useEffect(() => {
    if (!chatId) {
      restoredScope.current = "";
      return;
    }
    if (!scope || restoredScope.current === chatId) return;
    restoredScope.current = chatId;
    setDomain(scope.domain || "");
    setDocumentFilter(scope.document_ids?.[0] || "");
    setIncludeOutdated(Boolean(scope.include_outdated));
    setWebSearch(Boolean(scope.web_search));
    setWebQuery(scope.web_query || "");
    setWebUrls((scope.web_urls || []).join("\n"));
  }, [
    chatId,
    scope,
    setDomain,
    setDocumentFilter,
    setIncludeOutdated,
    setWebSearch,
    setWebQuery,
    setWebUrls,
  ]);
  useEffect(() => {
    if (c.loading || chatId || !legacyId || importedLegacy.current === legacyId)
      return;
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get("run") !== legacyId) return;
    importedLegacy.current = legacyId;
    void importAnswer(legacyId);
  }, [legacyId, chatId, c.loading, importAnswer]);

  useAgentContext({
    description:
      "Current SuperFlow identity; domain APIs reauthorize every read.",
    value: {
      user_id: w.user.id,
      role: w.user.role_id,
      chat_id: c.chat?.id ?? null,
    },
  });
  useFrontendTool(
    {
      name: APPROVED_WORKSPACE_TOOL,
      description:
        "Display an approved SuperFlow response card or domain workspace. Read only.",
      parameters: WorkspaceResolutionSchema,
      handler: async (input) => {
        const approved = WorkspaceResolutionSchema.parse(input);
        setDisplayedWorkspace(approved);
        return "Approved conversation workspace displayed. Domain APIs remain authoritative.";
      },
    },
    [],
  );

  useEffect(() => {
    if (
      !isReady ||
      latest?.status !== "complete" ||
      !latest.resolution ||
      dispatched.current === latest.id
    )
      return;
    const resolution = WorkspaceResolutionSchema.safeParse(latest.resolution);
    if (!resolution.success) return;
    dispatched.current = latest.id;
    void copilotkit
      .runTool({
        name: APPROVED_WORKSPACE_TOOL,
        agentId: "workspace",
        parameters: resolution.data,
      })
      .catch(() => {
        // The same validated response remains visible during runtime reconnection.
      });
  }, [copilotkit, isReady, latest]);

  useEffect(() => {
    const element = scroller.current;
    if (element && nearBottom.current)
      element.scrollTo({ top: element.scrollHeight, behavior: "instant" });
  }, [c.chat?.id, c.chat?.turns.length, latest?.status, latest?.events.length]);

  function send(prompt: string) {
    nearBottom.current = true;
    void c.send(prompt, {
      domain: w.domain || null,
      document_ids: w.documentFilter ? [w.documentFilter] : [],
      include_outdated: w.includeOutdated,
      web_search: w.webSearch,
      web_query: w.webSearch && w.webQuery.trim() ? w.webQuery.trim() : null,
      web_urls: w.webSearch
        ? w.webUrls
            .split(/\r?\n/)
            .map((url) => url.trim())
            .filter(Boolean)
        : [],
    });
  }

  return (
    <div className="ask-chat-layout" data-agent-ready={isReady}>
      <aside className="chat-sidebar" aria-label="Chat sessions">
        <button
          className="button primary full"
          disabled={c.sending}
          onClick={() => {
            c.newChat();
            setDomain("");
            setDocumentFilter("");
            setIncludeOutdated(false);
            setWebSearch(false);
            setWebQuery("");
            setWebUrls("");
            setDomainTurn(null);
            setRenaming(false);
            nearBottom.current = true;
          }}
        >
          <Plus size={16} /> New chat
        </button>
        <label className="chat-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search chats</span>
          <input
            placeholder="Search chats"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="chat-list-heading">
          Your conversations <span>{c.chats.length}</span>
        </div>
        <nav className="chat-session-list" aria-label="Saved chats">
          {c.chats
            .filter((chat) =>
              chat.title.toLowerCase().includes(search.toLowerCase()),
            )
            .map((chat) => (
              <button
                key={chat.id}
                className={chat.id === c.chat?.id ? "selected" : ""}
                disabled={c.sending}
                aria-current={chat.id === c.chat?.id ? "page" : undefined}
                onClick={() => {
                  nearBottom.current = true;
                  setDomainTurn(null);
                  setRenaming(false);
                  void c.openChat(chat.id);
                }}
              >
                <MessageSquare size={15} aria-hidden="true" />
                <span>{chat.title}</span>
              </button>
            ))}
          {!c.loading && !c.chats.length && (
            <p className="muted small">Your chats will be saved here.</p>
          )}
        </nav>
        {c.hasMore && (
          <button
            className="button secondary full"
            disabled={c.loadingOlder}
            onClick={() => void c.loadOlder()}
          >
            {c.loadingOlder ? "Loading…" : "Older chats"}
          </button>
        )}
        {w.history.length > 0 && (
          <details className="chat-previous">
            <summary>Previous saved answers</summary>
            <p className="muted small">
              Open an earlier answer to continue in a chat.
            </p>
            {w.history.slice(0, 10).map((item) => (
              <button
                key={item.id}
                disabled={c.sending}
                onClick={() => void c.importAnswer(item.id)}
              >
                {item.question}
              </button>
            ))}
          </details>
        )}
        <Link className="text-link chat-source-link" href="/knowledge">
          Browse knowledge base →
        </Link>
      </aside>

      <section className="chat-workspace" aria-label="Conversation">
        <header className="chat-heading">
          <div>
            <span className="context-label">
              Ask → Understand → Review → Act
            </span>
            {renaming ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void c.rename(title);
                  setRenaming(false);
                }}
              >
                <label className="sr-only" htmlFor="chat-title">
                  Chat title
                </label>
                <input
                  autoFocus
                  id="chat-title"
                  value={title}
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <button className="button secondary" type="submit">
                  Save
                </button>
              </form>
            ) : (
              <h2>
                {c.chat?.title || "A little clarity. A lot of possibility."}
              </h2>
            )}
          </div>
          {c.chat && (
            <button
              className="icon-button"
              aria-label="Rename chat"
              onClick={() => {
                setTitle(c.chat!.title);
                setRenaming(!renaming);
              }}
            >
              <Pencil size={16} />
            </button>
          )}
        </header>

        <div
          className="chat-messages"
          ref={scroller}
          role="region"
          aria-label="Chat messages"
          tabIndex={0}
          onScroll={(event) => {
            const el = event.currentTarget;
            nearBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }}
        >
          {c.loading ? (
            <p role="status" className="muted">
              Opening your saved conversations…
            </p>
          ) : !c.chat?.turns.length ? (
            <div className="chat-welcome">
              <Image
                src="/branding/superbank-symbol.png"
                width={64}
                height={64}
                alt="Superbank"
                priority
              />
              <span className="context-label">Your knowledge, connected</span>
              <h3>What can we work through?</h3>
              <p>
                Ask a question, inspect the evidence, then keep the conversation
                going. Every reply keeps its sources and process with it.
              </p>
              <div className="chat-prompts" aria-label="Suggested requests">
                {PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    disabled={busy || w.loading}
                    onClick={() => send(prompt)}
                  >
                    <Sparkles size={15} aria-hidden="true" />
                    {prompt}
                  </button>
                ))}
              </div>
              {w.answer && (
                <button
                  className="button secondary"
                  disabled={c.sending}
                  onClick={() => void c.importAnswer(w.answer!.id)}
                >
                  Continue your selected saved answer
                </button>
              )}
            </div>
          ) : (
            c.chat.turns.map((turn, index) => {
              const resolution = turn.resolution
                ? WorkspaceResolutionSchema.safeParse(turn.resolution)
                : null;
              const authorized = resolution?.success ? resolution.data : null;
              // The display tool drives the selected card, but can never override
              // this turn's server-authorized resolution. Outages use the same card.
              const selected =
                displayedWorkspace &&
                authorized &&
                JSON.stringify(displayedWorkspace) ===
                  JSON.stringify(authorized)
                  ? displayedWorkspace
                  : authorized;
              const domain =
                selected?.status === "ready" &&
                selected.intent !== "knowledge_answer";
              const showDomain =
                domain &&
                (domainTurn === turn.id ||
                  (!domainTurn && index === c.chat!.turns.length - 1));
              return (
                <motion.article
                  key={turn.id}
                  className="chat-turn"
                  aria-label={`Message ${index + 1}`}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="chat-user-message">
                    <span>You</span>
                    <p>{turn.question}</p>
                  </div>
                  <div className="chat-assistant-message">
                    <div className="chat-assistant-label">
                      <Image
                        src="/branding/superbank-symbol.png"
                        alt=""
                        width={26}
                        height={26}
                      />
                      SuperFlow
                      <span>
                        {turn.scope.web_search
                          ? "Web + knowledge"
                          : "Your workspace"}
                      </span>
                    </div>
                    {isPending(turn) && (
                      <AskActivity
                        startedAt={turn.created_at}
                        progress={turn.events.at(-1)}
                        webSearch={Boolean(turn.scope.web_search)}
                        scope={turn.scope.domain || "Your accessible sources"}
                      />
                    )}
                    {turn.error && (
                      <div className="error-message" role="alert">
                        <p>{turn.error}</p>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => c.setDraft(turn.question)}
                        >
                          Edit and retry
                        </button>
                      </div>
                    )}
                    {turn.answer && !turn.error && (
                      <AnswerCard
                        answer={turn.answer}
                        onSource={w.setSource}
                        onDocument={w.openDocument}
                        view={
                          selected?.view === "regulation_brief"
                            ? "regulation_brief"
                            : "source_answer"
                        }
                      />
                    )}
                    {selected?.status === "denied" && (
                      <p role="status" aria-label="Workspace unavailable">
                        {selected.message}
                      </p>
                    )}
                    {domain && (
                      <>
                        <button
                          className="button secondary"
                          onClick={() =>
                            setDomainTurn(showDomain ? "closed" : turn.id)
                          }
                        >
                          {showDomain ? "Close" : "Open"}{" "}
                          {selected?.intent
                            ? WORKSPACE_LABELS[selected.intent]
                            : "workspace"}
                        </button>
                        {showDomain && (
                          <GenerativeWorkspace
                            selection={selected}
                            prompt={turn.question}
                            user={w.user}
                            knowledge={{
                              answer: null,
                              asking: false,
                              onSource: w.setSource,
                              onDocument: w.openDocument,
                            }}
                          />
                        )}
                        <p className="muted small">
                          This opens the current authorized workspace. Its live
                          data may change after this message.
                        </p>
                      </>
                    )}
                    <ProcessHistory turn={turn} />
                  </div>
                </motion.article>
              );
            })
          )}
        </div>

        <div className="chat-compose-area">
          {c.error && (
            <p className="error-message" role="alert">
              {c.error}
            </p>
          )}
          <details
            className="chat-scope"
            open={
              Boolean(
                w.documentFilter ||
                w.domain ||
                w.includeOutdated ||
                w.webSearch,
              ) || undefined
            }
          >
            <summary>
              Sources & search{" "}
              <span>
                {w.domain || "All accessible knowledge"}
                {w.webSearch ? " · WebSearch on" : ""}
              </span>
            </summary>
            <div
              className="query-scope"
              role="group"
              aria-label="Retrieval scope"
            >
              {filters}
            </div>
            <div className="websearch-controls">
              <button
                type="button"
                aria-label="Enable WebSearch"
                className={`button secondary websearch-toggle ${w.webSearch ? "enabled" : ""}`}
                aria-pressed={w.webSearch}
                disabled={busy}
                onClick={() => w.setWebSearch(!w.webSearch)}
              >
                Enable WebSearch{" "}
                <span aria-hidden="true">{w.webSearch ? "On" : "Off"}</span>
              </button>
              {w.webSearch && (
                <details className="websearch-options">
                  <summary>WebSearch options</summary>
                  <p className="muted small">
                    Puppeteer and vision run on this device. Your public search
                    query is sent to Google. Browser scans can take several
                    minutes.
                  </p>
                  <label>
                    Public Google query (optional)
                    <input
                      maxLength={200}
                      value={w.webQuery}
                      onChange={(event) => w.setWebQuery(event.target.value)}
                      disabled={busy}
                      placeholder="Defaults to this message"
                    />
                  </label>
                  <label>
                    Selected result URLs (optional)
                    <textarea
                      value={w.webUrls}
                      onChange={(event) => w.setWebUrls(event.target.value)}
                      disabled={busy}
                      placeholder="Up to two public URLs, one per line"
                    />
                  </label>
                  <p className="muted small">
                    Pasted URLs are read directly; they are not claimed as
                    automated Google results.
                  </p>
                </details>
              )}
            </div>
          </details>
          <QuestionComposer
            expanded
            value={c.draft}
            onChange={c.setDraft}
            onSubmit={() => send(c.draft)}
            busy={busy}
            disabled={c.loading || w.loading}
          />
          <p className="chat-footnote">
            {busy
              ? "You can leave and reopen this chat. Your reply and process are saved."
              : "Follow-ups use this chat’s context. Check the cited evidence before acting."}
          </p>
        </div>
      </section>
    </div>
  );
}
