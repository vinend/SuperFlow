"use client";

import { BookOpen, ExternalLink, X } from "lucide-react";
import { dateLabel } from "@/lib/api";
import type { SourcePanelProps } from "@/lib/workspace-contracts";
import { Dialog } from "./ui/dialog";
import { Metadata, StatusBadge } from "./ui/primitives";
import { RELIABILITY_PRESENTATION } from "@/lib/reliability-view";

export function SourcePanel({
  source,
  close,
  openDocument,
  reliability,
}: SourcePanelProps) {
  return (
    <Dialog
      label="Source Panel"
      className="source-panel"
      close={close}
      contextual
    >
      <div className="panel-heading">
        <span>
          <BookOpen size={18} /> Source Panel
        </span>
        <button
          className="icon-button"
          aria-label="Close source panel"
          onClick={close}
        >
          <X size={19} />
        </button>
      </div>
      <div className="source-content">
        <div className="context-label">Citation [{source.citation_id}]</div>
        <h2>{source.title}</h2>
        {source.source_url?.startsWith("https://ojk.go.id/") && (
          <div className="notice">
            <a
              className="text-link"
              href={source.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Open official OJK PDF
            </a>
            <p>
              Official-source reference. Legal applicability and amendments
              still require human review.
            </p>
          </div>
        )}
        <div className="tag-row">
          <span className="domain-label">{source.domain}</span>
          <StatusBadge status={source.status} />
        </div>
        {reliability && (
          <p className="source-guard-context">
            Answer reliability:{" "}
            {RELIABILITY_PRESENTATION[reliability.status].label}. This state
            applies to the complete answer evidence set.
          </p>
        )}
        {source.status !== "active" && (
          <div className="notice">
            This is a {source.status} version. Consult an active source before
            relying on it as current authority.
          </div>
        )}
        {source.extraction_method === "web_capture" && (
          <p className="notice">
            Website capture and vision observations require human review.
            Inspect the saved capture in the document.
          </p>
        )}
        {(source.extraction_method === "ocr" ||
          source.extraction_method === "mixed") && (
          <div className="notice">
            This source contains OCR text. Check names, amounts, dates, and
            tables against the original document before relying on it.
          </div>
        )}
        <Metadata
          items={[
            { label: "Version", value: `v${source.version}` },
            {
              label: "Effective date",
              value: dateLabel(source.effective_date),
            },
            { label: "Owner", value: source.owner },
            { label: "Authority", value: `${source.authority_level} / 5` },
            { label: "Section", value: source.section_path },
            ...(source.extraction_method
              ? [
                  {
                    label: "Extraction",
                    value:
                      source.extraction_method === "web_capture"
                        ? "Website and vision capture"
                        : source.extraction_method === "pdf_text"
                          ? "PDF text"
                          : source.extraction_method === "ocr"
                            ? "OCR"
                            : source.extraction_method === "mixed"
                              ? "PDF text and OCR"
                              : "Document text",
                  },
                ]
              : []),
            ...(source.ocr_confidence != null
              ? [
                  {
                    label: "Lowest OCR recognition score",
                    value: source.ocr_confidence.toFixed(2) + " / 1",
                  },
                ]
              : []),
          ]}
        />
        <h3 className="context-label">Source excerpt</h3>
        <blockquote>{source.excerpt}</blockquote>
        <button
          className="button secondary full"
          onClick={() => openDocument(source.document_id, source.version_id)}
        >
          Open document <ExternalLink size={15} />
        </button>
        {reliability?.active_replacements
          .filter(
            (item) =>
              item.document_id === source.document_id &&
              item.version_id !== source.version_id,
          )
          .map((item) => (
            <button
              className="text-button active-replacement"
              key={item.version_id}
              onClick={() => openDocument(item.document_id, item.version_id)}
            >
              Open active replacement · v{item.version}
            </button>
          ))}
        <p className="muted small">
          This excerpt refers to the exact stored version shown above.
        </p>
      </div>
      <details className="source-identity">
        <summary>Stored source reference</summary>
        <dl>
          <dt>Document</dt>
          <dd>{source.document_id}</dd>
          <dt>Version ID</dt>
          <dd>{source.version_id}</dd>
          <dt>Chunk ID</dt>
          <dd>{source.chunk_id}</dd>
        </dl>
      </details>
    </Dialog>
  );
}
