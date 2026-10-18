"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { ArrowRight, Plus, Search, X } from "lucide-react";
import { DOMAINS } from "@/lib/api";
import { displayVersion } from "@/lib/knowledge-view";
import { useSession } from "./session";
import {
  ApplicationShell,
  TITLES,
  KnowledgeView as View,
} from "./application-shell";
import { useKnowledgeWorkspace } from "./use-knowledge-workspace";
import { DocumentTable } from "./document-table";
import { SourcePanel } from "./source-panel";
import { DocumentDetail } from "./document-detail";
import { DocumentEditor } from "./document-editor";
import { WebsiteImport } from "./website-import";
import { RagStatus } from "./rag-status";
import { HomeAttention } from "./home-attention";
import { roleLabel } from "@/lib/product-view";
import { AskGenerativeArea } from "./ask-generative-area";
import { ErrorState, PageHeader, SectionHeader } from "./ui/primitives";

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
  const [websiteImport, setWebsiteImport] = useState(false);
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
    .slice(0, 2);
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
              ? "Ask"
              : "Knowledge Library"
        }
        title={
          view === "home" ? `Hello, ${w.user.name.split(" ")[0]}` : TITLES[view]
        }
        description={
          view === "home"
            ? "See what needs your attention, ask a question, or open a source."
            : view === "ask"
              ? "Ask a question. Inspect the evidence and the exact source version."
              : "Company policies, regulations, procedures, and reference documents available to you."
        }
        action={
          view === "knowledge" && w.canManage ? (
            <div className="tag-row">
              <button className="button" onClick={() => setWebsiteImport(true)}>
                Import website
              </button>
              <button
                className="button primary"
                onClick={() => w.setEditor({ mode: "upload" })}
              >
                <Plus size={16} /> Add document
              </button>
            </div>
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
        <div className="home-launchpad">
          <HomeAttention />
          {w.user.role_id !== "governance" && (
            <section className="home-ask-entry">
              <h2>Need to know something?</h2>
              <p>
                Ask a question and see the answer with its sources and next
                step.
              </p>
              <Link href="/ask" className="button primary">
                Ask SuperFlow <ArrowRight size={16} />
              </Link>
            </section>
          )}
          <section className="knowledge-section">
            <SectionHeader
              title="Recently updated"
              action={
                <Link className="text-link" href="/knowledge">
                  Browse Knowledge Library <ArrowRight size={14} />
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
        </div>
      )}{" "}
      {view === "ask" && <AskGenerativeArea w={w} filters={filters} />}
      {view === "knowledge" && (
        <>
          {w.canManage && (
            <RagStatus
              revision={w.documents
                .map((d) => d.id + d.versions.length)
                .join(",")}
            />
          )}
          {w.canManage && (
            <p className="muted small">
              Source maintenance: upload, website import, versions, access, and
              indexing are available to your role.
            </p>
          )}
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
              {w.canManage && (
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
              )}
              <select
                aria-label="Sort documents"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="title">Title A–Z</option>
                <option value="recent">Recently updated</option>
              </select>{" "}
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
      {websiteImport && (
        <WebsiteImport close={() => setWebsiteImport(false)} saved={w.saved} />
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
