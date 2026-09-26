"use client";

import { BookOpen, ChevronRight, FileText } from "lucide-react";
import { dateLabel } from "@/lib/api";
import { citedParagraphs } from "@/lib/knowledge-view";
import type { AnswerCardProps } from "@/lib/workspace-contracts";
import { StatusBadge } from "./ui/primitives";

export function AnswerCard({
  answer,
  onSource,
  onDocument,
  reliabilitySlot,
}: AnswerCardProps) {
  return (
    <section className="answer-card" aria-label="Answer Card">
      <div className="answer-heading">
        <div className="answer-label">
          Answer <span>· {dateLabel(answer.created_at)}</span>
        </div>
        <span className="answer-outcome">
          {answer.outcome === "source_grounded"
            ? "Source-grounded"
            : "No supporting sources"}
        </span>
      </div>
      <h2>{answer.question}</h2>
      <div className="answer-body">
        {citedParagraphs(answer.answer, answer.sources).map(
          ({ text, source }, index) => (
            <p key={index}>
              {text}
              {source && (
                <button
                  className="inline-citation"
                  aria-label={`Open citation ${source.citation_id}`}
                  onClick={() => onSource(source)}
                >
                  [{source.citation_id}]
                </button>
              )}
            </p>
          ),
        )}
      </div>
      {reliabilitySlot && (
        <div className="answer-reliability">{reliabilitySlot}</div>
      )}
      {answer.sources.length > 0 && (
        <div className="answer-sources">
          <div className="section-header">
            <h3>Evidence</h3>
            <span className="muted small">
              {answer.sources.length} retrieved sections
            </span>
          </div>
          <div className="source-references">
            {answer.sources.map((source) => (
              <button
                key={source.chunk_id}
                className="source-reference"
                onClick={() => onSource(source)}
              >
                <span className="citation-number">{source.citation_id}</span>
                <span className="reference-title">
                  {source.title}
                  <small>
                    v{source.version} · {source.section_path}
                  </small>
                </span>
                <StatusBadge status={source.status} />
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="answer-metadata">
        <FileText size={14} />
        <span>
          Source extracts ·{" "}
          {answer.filters.include_outdated
            ? "Historical versions included"
            : "Active versions only"}{" "}
          · {answer.filters.domain || "All domains"}
        </span>
        <span>
          {answer.sources.length
            ? "Inspect the cited section"
            : "No conclusion generated"}
        </span>
      </div>
      <div className="answer-next">
        <div>
          <span className="context-label">Next action</span>
          <p>
            {answer.sources.length
              ? "Read the full source before applying this guidance."
              : "Broaden your filters or consult a knowledge owner."}
          </p>
        </div>
        {answer.sources[0] ? (
          <button
            className="button secondary"
            onClick={() =>
              onDocument(
                answer.sources[0].document_id,
                answer.sources[0].version_id,
              )
            }
          >
            <BookOpen size={15} /> Read source document
          </button>
        ) : (
          <a className="button secondary" href="/knowledge">
            Browse Knowledge Hub <ChevronRight size={15} />
          </a>
        )}
      </div>
    </section>
  );
}
