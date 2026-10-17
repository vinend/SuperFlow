"use client";

import { useState } from "react";
import { Download, FileText, RefreshCw, Sparkles, X } from "lucide-react";
import { api, API_URL, dateLabel, KnowledgeDocument } from "@/lib/api";
import { useSession } from "./session";
import { EditorMode } from "./document-editor";
import { Dialog } from "./ui/dialog";
import { StatusBadge } from "./ui/primitives";
import { WebsiteEvidence, type WebsiteCapture } from "./website-import";
import { EvidenceOrigin } from "./evidence-origin";

export function DocumentDetail({
  document,
  documents,
  close,
  edit,
  changed,
  openRelated,
  preferredVersionId,
  askDocument,
}: {
  document: KnowledgeDocument;
  documents: KnowledgeDocument[];
  close: () => void;
  edit: (mode: EditorMode) => void;
  changed: (document: KnowledgeDocument) => Promise<void>;
  openRelated: (id: string) => void;
  preferredVersionId?: string;
  askDocument: (id: string) => void;
}) {
  const { user } = useSession();
  const [versionId, setVersionId] = useState(
    document.versions.find((version) => version.id === preferredVersionId)
      ?.id ||
      document.versions.find((version) => version.status === "active")?.id ||
      document.versions[0]?.id,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [webEvidence, setWebEvidence] = useState<{
    versionId: string;
    capture: WebsiteCapture;
  } | null>(null);
  const version =
    document.versions.find((item) => item.id === versionId) ||
    document.versions[0];
  const canManage =
    user.permissions.includes("knowledge:write") && !document.context_run_id;

  async function inspectWebsite() {
    setBusy(true);
    setError("");
    try {
      const capture = await api<WebsiteCapture>(
        `/api/documents/${document.id}/versions/${version.id}/web-capture`,
        user,
      );
      setWebEvidence({ versionId: version.id, capture });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function inspectVersion(id: string) {
    setVersionId(id);
    const hash = new URLSearchParams(location.hash.slice(1));
    hash.set("role", user.id);
    hash.set("document", document.id);
    hash.set("version", id);
    window.history.replaceState(
      window.history.state,
      "",
      `${location.pathname}#${hash}`,
    );
  }

  async function reindex() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ indexed_chunks: number }>(
        `/api/documents/${document.id}/index`,
        user,
        { method: "POST" },
      );
      setMessage(
        `Re-indexed ${result.indexed_chunks} chunks. Existing citation IDs preserved.`,
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function status(value: string) {
    setBusy(true);
    setError("");
    try {
      await changed(
        await api<KnowledgeDocument>(
          `/api/documents/${document.id}/versions/${version.id}?status=${value}`,
          user,
          { method: "PATCH" },
        ),
      );
      setMessage("Version status updated.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/documents/${document.id}/versions/${version.id}/file`,
        { headers: { "X-User-Id": user.id } },
      );
      if (!response.ok)
        throw new Error("Source file is unavailable to this role.");
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = url;
      link.download = version.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  return (
    <Dialog label="Document details" className="detail-modal" close={close}>
      <div className="panel-heading">
        <span>
          <FileText size={19} /> Document details
        </span>
        <button
          aria-label="Close document details"
          className="icon-button"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <div className="detail-header">
        <div className="detail-identity">
          <div>
            <div className="context-label">{document.domain} / Knowledge</div>
            <h2>{document.title}</h2>
            <p className="muted">
              Owned by {document.owner_name} · Authority{" "}
              {document.authority_level} / 5
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => askDocument(document.id)}
          >
            <Sparkles size={14} /> Ask about this source
          </button>
        </div>
        {canManage && (
          <div className="tag-row">
            <button
              className="button secondary"
              onClick={() => edit("metadata")}
            >
              Edit metadata
            </button>
            <button className="button primary" onClick={() => edit("version")}>
              Add version
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={reindex}
            >
              <RefreshCw size={14} /> Re-index
            </button>
          </div>
        )}
      </div>
      <div className="detail-grid">
        <div className="detail-body">
          <label className="version-select">
            Inspect version
            <select
              aria-label="Inspect version"
              value={version.id}
              onChange={(event) => inspectVersion(event.target.value)}
            >
              {document.versions.map((item) => (
                <option key={item.id} value={item.id}>
                  v{item.version} · {item.status} ·{" "}
                  {dateLabel(item.effective_date)}
                </option>
              ))}
            </select>
          </label>
          <div className="tag-row">
            <StatusBadge status={version.status} />
            <span className="muted small">
              Effective {dateLabel(version.effective_date)} ·{" "}
              {version.chunk_count} source sections
            </span>
          </div>
          <EvidenceOrigin
            source={{
              source_origin: document.context_run_id ? "internet" : undefined,
              capture_engine: version.source_provenance?.capture_engine,
              filename: version.filename,
              media_type: version.media_type,
              extraction_method: version.chunks?.find(
                (chunk) =>
                  chunk.extraction_method === "web_capture" ||
                  chunk.extraction_method === "mixed" ||
                  chunk.extraction_method === "ocr",
              )?.extraction_method,
              vision_model:
                version.source_provenance?.vision_model ||
                (webEvidence?.versionId === version.id
                  ? webEvidence.capture.vision_model
                  : undefined),
            }}
          />
          {version.status !== "active" && (
            <div className="notice">
              This {version.status} version is not current authority. Default
              questions retrieve active versions only.
            </div>
          )}
          {error && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="success-message">
              {message}
            </div>
          )}
          <h3 className="source-content-heading">Source content</h3>
          {document.context_run_id && (
            <p className="notice">
              External evidence captured for this answer only. This is not a
              published knowledge-base source.
            </p>
          )}
          {version.source_provenance && (
            <div className="notice">
              <strong>
                {version.source_provenance.publisher} ·{" "}
                {version.source_provenance.kind === "question-web-context"
                  ? "WebSearch snapshot"
                  : version.source_provenance.kind.replaceAll("-", " ")}
              </strong>
              <p>
                Retrieved {dateLabel(version.source_provenance.retrieved_at)}.
                Applicability is unverified.
              </p>
              {version.source_provenance.jurisdiction && (
                <p>{version.source_provenance.jurisdiction}</p>
              )}
              {version.source_provenance.usage_scope && (
                <p>{version.source_provenance.usage_scope}</p>
              )}
              <a
                className="text-link"
                href={version.source_provenance.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Open original source
              </a>
            </div>
          )}
          {version.chunks?.some(
            (chunk) =>
              chunk.extraction_method === "web_capture" ||
              chunk.extraction_method === "vision",
          ) && (
            <section>
              <p className="notice">
                This website snapshot includes vision observations. Check the
                captured evidence before applying guidance.
              </p>
              {webEvidence?.versionId === version.id ? (
                <WebsiteEvidence capture={webEvidence.capture} />
              ) : (
                <button
                  className="button"
                  disabled={busy}
                  onClick={inspectWebsite}
                >
                  {version.media_type === "application/pdf"
                    ? "Inspect PDF vision evidence"
                    : "Inspect website capture"}
                </button>
              )}
            </section>
          )}
          <div className="document-excerpts">
            {version.chunks?.map((chunk) => (
              <section key={chunk.id}>
                <h3>{chunk.section_path}</h3>
                {(chunk.extraction_method === "ocr" ||
                  chunk.extraction_method === "mixed") && (
                  <p className="muted small">
                    OCR text: check the original document, especially names and
                    amounts.
                  </p>
                )}
                <p>{chunk.text}</p>
              </section>
            ))}
          </div>
        </div>
        <aside className="detail-sidebar">
          <h3>Version history</h3>
          <div className="version-history">
            {document.versions.map((item) => (
              <button
                key={item.id}
                aria-pressed={version.id === item.id}
                onClick={() => inspectVersion(item.id)}
              >
                <strong>v{item.version}</strong>
                <StatusBadge status={item.status} />
                <small>Effective {dateLabel(item.effective_date)}</small>
              </button>
            ))}
          </div>
          <h3>Version information</h3>
          <dl className="source-metadata">
            <div>
              <dt>File</dt>
              <dd>{version.filename}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>v{version.version}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{version.status}</dd>
            </div>
            <div>
              <dt>SHA-256</dt>
              <dd className="checksum">{version.checksum}</dd>
            </div>
          </dl>
          <button className="button secondary full" onClick={download}>
            <Download size={14} /> Download original
          </button>
          <h3>Access roles</h3>
          <p className="access-roles">{document.access_roles.join(" · ")}</p>
          <h3>Related sources</h3>
          {document.related_document_ids.length ? (
            document.related_document_ids.map((id) => (
              <button
                className="related-link"
                key={id}
                onClick={() => openRelated(id)}
              >
                {documents.find((item) => item.id === id)?.title ||
                  "Open related source"}
              </button>
            ))
          ) : (
            <p className="muted small">No linked sources.</p>
          )}
          {canManage && (
            <>
              <h3>Manage version status</h3>
              <select
                aria-label="Version status"
                value={version.status}
                disabled={busy}
                onChange={(event) => status(event.target.value)}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="outdated">Outdated</option>
              </select>
            </>
          )}
        </aside>
      </div>
    </Dialog>
  );
}
