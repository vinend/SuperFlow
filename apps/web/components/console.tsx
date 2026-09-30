"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { ArrowRight, BookOpen, Plus, Search, X } from "lucide-react";
import { DOMAINS } from "@/lib/api";
import { displayVersion } from "@/lib/knowledge-view";
import { useSession } from "./session";
import {
  ApplicationShell,
  TITLES,
  KnowledgeView as View,
} from "./application-shell";
import { useKnowledgeWorkspace } from "./use-knowledge-workspace";
import { AnswerCard } from "./answer-card";
import { QuestionComposer } from "./question-composer";
import { QuestionHistory } from "./question-history";
import { DocumentTable } from "./document-table";
import { SourcePanel } from "./source-panel";
import { DocumentDetail } from "./document-detail";
import { DocumentEditor } from "./document-editor";
import { HomeAttention } from "./home-attention";
import { roleLabel } from "@/lib/product-view";
import { AskGenerativeArea } from "./ask-generative-area";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  SectionHeader,
} from "./ui/primitives";

const SUGGESTIONS = [
  { title: "Annual leave", question: "How many annual leave days do I get?" },
  {
    title: "Expense claims",
    question: "What documents do I need for expense reimbursement?",
  },
  { title: "System access", question: "How do I request system access?" },
];

export function Console({ view }: { view: View }) {
  const { user } = useSession();
  return (
    <ApplicationShell view={view}>
      {view === "ask" ? (
        <CopilotKitProvider
          key={user.id}
          runtimeUrl="/api/copilotkit"
          agentId="workspace"
          enableInspector={false}
          headers={{ "X-User-Id": user.id }}
        >
          <Workspace key={`${user.id}:${view}`} view={view} />
        </CopilotKitProvider>
      ) : (
        <Workspace key={`${user.id}:${view}`} view={view} />
      )}
    </ApplicationShell>
  );
}

function Workspace({ view }: { view: View }) {
  const router = useRouter();
  const w = useKnowledgeWorkspace();
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("title");
  const activeCount = w.documents.filter((doc) =>
    doc.versions.some((version) => version.status === "active"),
  ).length;
  const versionCount = w.documents.reduce(
    (count, doc) => count + doc.versions.length,
    0,
  );
  const visibleDocs = w.documents
    .filter(
      (doc) =>
        (!w.domain || doc.domain === w.domain) &&
        doc.title.toLowerCase().includes(w.search.toLowerCase()) &&
        (!status || displayVersion(doc)?.status === status),
    )
    .sort((a, b) =>
      sort === "recent"
        ? (displayVersion(b)?.created_at || "").localeCompare(
            displayVersion(a)?.created_at || "",
          )
        : a.title.localeCompare(b.title),
    );
  const recentDocs = [...w.documents]
    .sort((a, b) =>
      (displayVersion(b)?.created_at || "").localeCompare(
        displayVersion(a)?.created_at || "",
      ),
    )
    .slice(0, 4);
  const suggestions = (
    <div className="prompt-suggestions">
      <span className="suggestion-label">Try</span>
      {SUGGESTIONS.map((item) => (
        <button
          disabled={w.asking || w.loading}
          key={item.title}
          onClick={() => w.submitQuestion(undefined, item.question)}
          title={item.question}
        >
          <span>{item.title}</span>
        </button>
      ))}
    </div>
  );
  const filters = (
    <>
      <div className="filter-row">
        <label>
          Domain
          <select
            aria-label="Question domain"
            value={w.domain}
            disabled={w.asking}
            onChange={(event) => {
              w.setDomain(event.target.value);
              w.setDocumentFilter("");
            }}
          >
            <option value="">All domains</option>
            {DOMAINS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select
            aria-label="Question source"
            value={w.documentFilter}
            disabled={w.asking || w.loading}
            onChange={(event) => w.setDocumentFilter(event.target.value)}
          >
            <option value="">All accessible sources</option>
            {w.documents
              .filter((doc) => !w.domain || w.domain === doc.domain)
              .map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={w.includeOutdated}
          disabled={w.asking}
          onChange={(event) => w.setIncludeOutdated(event.target.checked)}
        />
        Include historical versions{" "}
        <span className="muted">· drafts excluded</span>
      </label>
    </>
  );
  const composer = (
    <QuestionComposer
      value={w.question}
      onChange={w.setQuestion}
      onSubmit={() => w.submitQuestion()}
      busy={w.asking}
      disabled={w.loading}
    />
  );
  const result = (
    <>
      {w.asking && (
        <LoadingState label="Retrieving permitted source sections…" />
      )}
      {w.answer && (
        <AnswerCard
          answer={w.answer}
          onSource={w.setSource}
          onDocument={w.openDocument}
        />
      )}
    </>
  );

  return (
    <main
      id="workspace-main"
      tabIndex={-1}
      className={`main-content ${w.source ? "with-source" : ""}`}
      aria-labelledby="page-title"
    >
      <PageHeader
        eyebrow={
          view === "home"
            ? `${w.user.department} / ${roleLabel(w.user.role_id)}`
            : view === "ask"
              ? "Knowledge / Ask"
              : "Knowledge / Repository"
        }
        title={view === "home" ? "Your workspace" : TITLES[view]}
        description={
          view === "home"
            ? "Find guidance, follow your work, and see what needs your attention."
            : view === "ask"
              ? "Ask a question. Inspect the evidence and the exact source version."
              : "A shared repository of enterprise sources. Your role determines what you can access."
        }
        action={
          view === "knowledge" && w.canManage ? (
            <button
              className="button primary"
              onClick={() => w.setEditor({ mode: "upload" })}
            >
              <Plus size={16} /> Add document
            </button>
          ) : view === "home" ? (
            <Link href="/knowledge" className="text-link">
              Browse knowledge <ArrowRight size={15} />
            </Link>
          ) : undefined
        }
      />
      {w.error && (
        <ErrorState
          message={w.error}
          retry={() => {
            w.setLoading(true);
            w.refresh()
              .then(() => w.setError(""))
              .catch((error: Error) => w.setError(error.message))
              .finally(() => w.setLoading(false));
          }}
        />
      )}
      {w.notice && (
        <div className="success-message" role="status">
          <span>{w.notice}</span>
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => w.setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {view === "home" && (
        <>
          {w.user.role_id !== "employee" && <HomeAttention />}
          <div className="home-workspace">
            <section className="home-primary">
              {w.user.role_id !== "governance" && (
                <>
                  <SectionHeader
                    title="Ask SuperFlow"
                    detail="Search across the sources available to your role."
                  />
                  {composer}
                  {suggestions}
                  {result}
                </>
              )}
              {w.user.role_id === "employee" && <HomeAttention />}
              <section className="knowledge-section">
                <SectionHeader
                  title="Recent source updates"
                  detail="Latest stored versions available to your role."
                  action={
                    <Link className="text-link" href="/knowledge">
                      View repository <ArrowRight size={14} />
                    </Link>
                  }
                />
                <DocumentTable
                  documents={recentDocs}
                  open={w.openDocument}
                  loading={w.loading}
                  compact
                />
              </section>
            </section>
            <aside className="home-secondary">
              <div className="knowledge-brief">
                <SectionHeader title="Your knowledge context" />
                <p>
                  <strong>{w.loading ? "—" : w.documents.length}</strong>{" "}
                  accessible documents{" "}
                  <span>· {w.loading ? "—" : activeCount} active</span>
                </p>
                <p className="muted small">
                  Current answers use active source versions. Open a citation to
                  inspect the exact section.
                </p>
                <Link href="/knowledge" className="text-link">
                  Explore your sources <ArrowRight size={13} />
                </Link>
              </div>
              <section className="home-history">
                <SectionHeader title="Recent questions" />
                <QuestionHistory
                  items={w.history}
                  open={w.openQuestion}
                  selectedId={w.answer?.id}
                  loading={w.loading}
                  disabled={w.asking}
                  limit={5}
                />
                {w.history.length > 0 && (
                  <Link href="/ask" className="text-link history-more">
                    All recent questions <ArrowRight size={14} />
                  </Link>
                )}
              </section>
            </aside>
          </div>
          <div className="platform-context">
            <span className="context-label">Knowledge to action</span>
            <div>
              <strong>Knowledge</strong>
              <ArrowRight size={13} />
              <strong>Evidence</strong>
              <ArrowRight size={13} />
              <span>Decision</span>
              <ArrowRight size={13} />
              <span>Action</span>
            </div>
            <p>
              Inspect the source, provide supporting information, and request an
              independent review when work needs to continue.
            </p>
          </div>
        </>
      )}
      {view === "ask" && <AskGenerativeArea w={w} filters={filters} />}
      {view === "knowledge" && (
        <>
          <div className="knowledge-summary">
            <span>
              <strong>{w.loading ? "—" : w.documents.length}</strong> documents
            </span>
            <span>
              <strong>{w.loading ? "—" : activeCount}</strong> active sources
            </span>
            <span>
              <strong>{w.loading ? "—" : versionCount}</strong> stored versions
            </span>
            <span className="summary-context">
              {roleLabel(w.user.role_id)} ·{" "}
              {w.canManage ? "Read & maintain" : "Read access"}
            </span>
          </div>
          <section className="knowledge-repository">
            <div className="knowledge-tools">
              <div className="search-input">
                <Search size={17} />
                <input
                  aria-label="Search documents"
                  placeholder="Find a document…"
                  value={w.search}
                  onChange={(event) => w.setSearch(event.target.value)}
                />
                {w.search && (
                  <button
                    className="icon-button"
                    aria-label="Clear document search"
                    onClick={() => w.setSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                aria-label="Knowledge domain"
                value={w.domain}
                onChange={(event) => w.setDomain(event.target.value)}
              >
                <option value="">All domains</option>
                {DOMAINS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                aria-label="Document status filter"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All states</option>
                <option value="active">Active</option>
                <option value="outdated">Outdated</option>
                <option value="draft">Draft</option>
              </select>
              <select
                aria-label="Sort documents"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="title">Title A–Z</option>
                <option value="recent">Latest versions</option>
              </select>
            </div>
            <DocumentTable
              documents={visibleDocs}
              open={w.openDocument}
              loading={w.loading}
            />
            <div className="repository-footer">
              <span>
                {w.loading
                  ? "Loading repository"
                  : `${visibleDocs.length} of ${w.documents.length} accessible documents`}
              </span>
              <span>
                Open a document to inspect its source and version history
              </span>
            </div>
          </section>
          <div className="knowledge-note">
            <BookOpen size={17} />
            <p>
              Select a source to read its sections, inspect version history, and
              follow related documents.
              {!w.canManage &&
                " Your current role has read access; SME and Governance can maintain sources."}
            </p>
          </div>
        </>
      )}
      {w.source && (
        <SourcePanel
          source={w.source}
          reliability={w.answer?.reliability}
          close={() => w.setSource(null)}
          openDocument={w.openDocument}
        />
      )}
      {w.detail && (
        <DocumentDetail
          key={`${w.detail.id}:${w.detailVersionId || "active"}`}
          document={w.detail}
          preferredVersionId={w.detailVersionId}
          documents={w.documents}
          close={w.closeDocument}
          edit={(mode) => {
            w.setEditor({ mode, document: w.detail! });
            w.setDetail(null);
          }}
          changed={w.changed}
          openRelated={w.openDocument}
          askDocument={(id) => {
            w.closeDocument();
            router.push(
              `/ask#role=${encodeURIComponent(w.user.id)}&source=${encodeURIComponent(id)}`,
            );
          }}
        />
      )}
      {w.editor && (
        <DocumentEditor
          mode={w.editor.mode}
          document={w.editor.document}
          documents={w.documents}
          close={() => {
            w.setEditor(null);
            w.closeDocument();
          }}
          saved={w.saved}
        />
      )}
    </main>
  );
}
