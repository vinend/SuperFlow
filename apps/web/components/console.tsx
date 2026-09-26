"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { DOMAINS } from "@/lib/api";
import { displayVersion } from "@/lib/knowledge-view";
import { useSession } from "./session";
import { ApplicationShell, TITLES, View } from "./application-shell";
import { useKnowledgeWorkspace } from "./use-knowledge-workspace";
import { AnswerCard } from "./answer-card";
import { QuestionComposer } from "./question-composer";
import { QuestionHistory } from "./question-history";
import { DocumentTable } from "./document-table";
import { SourcePanel } from "./source-panel";
import { DocumentDetail } from "./document-detail";
import { DocumentEditor } from "./document-editor";
import {
  EmptyState,
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
      <Workspace key={`${user.id}:${view}`} view={view} />
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
      <span className="eyebrow">START WITH</span>
      {SUGGESTIONS.map((item) => (
        <button
          disabled={w.asking || w.loading}
          key={item.title}
          onClick={() => w.submitQuestion(undefined, item.question)}
          title={item.question}
        >
          <span>{item.title}</span>
          <ArrowRight size={13} />
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
      toolbar={view === "ask" ? filters : undefined}
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
            ? `${w.user.department} / ${w.user.role_name}`
            : view === "ask"
              ? "KNOWLEDGE / ASK"
              : "KNOWLEDGE / REPOSITORY"
        }
        title={
          view === "home"
            ? `Welcome back, ${w.user.name.split(" ")[0]}.`
            : TITLES[view]
        }
        description={
          view === "home"
            ? "Your starting point for policies, procedures, and the knowledge behind your work."
            : view === "ask"
              ? "Work through a question with its sources, versions, and context in view."
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
          <div className="home-workspace">
            <section className="home-primary">
              <SectionHeader
                title="Ask SuperFlow"
                detail="Start with a question. Keep the source close."
                action={<Sparkles size={18} className="accent" />}
              />
              {composer}
              {suggestions}
              {result}
              <section className="knowledge-section">
                <SectionHeader
                  title="Recently added sources"
                  detail="The latest source versions available to your role."
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
              <SectionHeader
                title="Pick up where you left off"
                action={<Clock3 size={16} className="muted" />}
              />
              <QuestionHistory
                items={w.history}
                open={w.openQuestion}
                selectedId={w.answer?.id}
                loading={w.loading}
                disabled={w.asking}
                limit={5}
              />
              <Link href="/ask" className="text-link history-more">
                All recent questions <ArrowRight size={14} />
              </Link>
              <div className="knowledge-brief">
                <span className="eyebrow">YOUR KNOWLEDGE CONTEXT</span>
                <p>
                  <strong>{w.loading ? "—" : w.documents.length}</strong>{" "}
                  accessible documents{" "}
                  <span>· {w.loading ? "—" : activeCount} active</span>
                </p>
                <p className="muted small">
                  Default answers use active versions. Open any citation to
                  inspect the exact section.
                </p>
                <Link href="/knowledge" className="text-link">
                  Explore your sources <ArrowRight size={13} />
                </Link>
              </div>
            </aside>
          </div>
          <div className="platform-context">
            <span className="eyebrow">THE SUPERFLOW PLATFORM</span>
            <div>
              <strong>Governed Knowledge</strong>
              <ArrowRight size={13} />
              <strong>AI Agent</strong>
              <ArrowRight size={13} />
              <span>Reliability Layer</span>
              <ArrowRight size={13} />
              <span>Controlled Action</span>
              <ArrowRight size={13} />
              <span>Business Impact</span>
            </div>
            <p>
              Knowledge Core is available. Reliability and action modules follow
              in later phases.
            </p>
          </div>
        </>
      )}
      {view === "ask" && (
        <div className="ask-layout">
          <section className="ask-main">
            <div className="compose-heading">
              <BookOpen size={19} />
              <span>Ask across your knowledge repository</span>
              <Link className="text-link" href="/knowledge">
                View sources <ArrowRight size={13} />
              </Link>
            </div>
            {composer}
            {suggestions}
            {result}
            {!w.answer && !w.asking && !w.loading && (
              <EmptyState
                title="Your answer and evidence will appear here"
                description="Ask about a policy or procedure, or pick up a saved question. Matching sections remain linked to their original document versions."
              />
            )}
          </section>
          <aside className="question-history">
            <SectionHeader
              title="Recent questions"
              action={<Clock3 size={15} />}
            />
            <QuestionHistory
              items={w.history}
              open={w.openQuestion}
              selectedId={w.answer?.id}
              loading={w.loading}
              disabled={w.asking}
            />
            <p className="history-note">
              Saved to {w.user.name}’s demo identity. Source access is checked
              again when a question is opened.
            </p>
          </aside>
        </div>
      )}
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
              {w.user.role_name} ·{" "}
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
                Metadata, versions, and original files stored in PostgreSQL
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
