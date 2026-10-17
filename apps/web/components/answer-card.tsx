"use client";

import { BookOpen, ChevronRight, FileText } from "lucide-react";
import { dateLabel } from "@/lib/api";
import { citedParagraphs } from "@/lib/knowledge-view";
import type { AnswerCardProps } from "@/lib/workspace-contracts";
import { StatusBadge } from "./ui/primitives";
import { EvidenceChecklist } from "./evidence-checklist";
import { askAction } from "@/lib/product-view";
import { useSession } from "./session";
import { motion, useReducedMotion } from "motion/react";
import { EvidenceOrigin } from "./evidence-origin";

export function AnswerCard({
  answer,
  onSource,
  onDocument,
  reliabilitySlot,
  view,
}: AnswerCardProps) {
  const { user } = useSession();
  const reduce = useReducedMotion();
  const officialSources = answer.sources.filter(
    (source) =>
      source.source_url?.startsWith("https://ojk.go.id/") &&
      source.extraction_method !== "web_capture",
  );
  const regulatory = view === "regulation_brief" || officialSources.length > 0;
  const nextAction = askAction(answer, user.role_id);
  return (
    <motion.section
      key={answer.id}
      className="answer-card"
      aria-label="Answer Card"
      data-response-view={regulatory ? "regulation_brief" : "source_answer"}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      <div className="answer-heading">
        <div className="answer-label">
          {regulatory ? "Regulatory reference" : "Answer"}{" "}
          <span>· {dateLabel(answer.created_at)}</span>
        </div>
        <span className="answer-outcome">
          {answer.outcome === "source_grounded"
            ? "Source-grounded"
            : "No supporting sources"}
        </span>
      </div>
      <h2>{answer.question}</h2>
      {officialSources.length > 0 && (
        <div className="notice" aria-label="Official source context">
          <strong>
            Official OJK evidence ·{" "}
            {new Set(officialSources.map((source) => source.document_id)).size}{" "}
            {new Set(officialSources.map((source) => source.document_id))
              .size === 1
              ? "document"
              : "documents"}
          </strong>
          <p>
            Page-level citations refer to the original OJK files. Confirm
            applicability and subsequent amendments with Compliance.
          </p>
        </div>
      )}
      <EvidenceChecklist
        result={answer.reliability}
        sources={answer.sources}
        onSource={onSource}
        onDocument={onDocument}
      />
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
            {answer.sources.map((source, index) => (
              <motion.button
                key={source.chunk_id}
                className="source-reference"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.24,
                  delay: reduce ? 0 : Math.min(index, 6) * 0.035,
                }}
                whileHover={reduce ? undefined : { x: 3 }}
                whileTap={reduce ? undefined : { scale: 0.99 }}
                onClick={() => onSource(source)}
              >
                <span className="citation-number">{source.citation_id}</span>
                <span className="reference-title">
                  {source.title}
                  <small>
                    v{source.version} · {source.section_path}
                  </small>
                  <EvidenceOrigin source={source} />
                </span>
                <StatusBadge status={source.status} />
                <ChevronRight size={15} />
              </motion.button>
            ))}
          </div>
        </div>
      )}
      <div className="answer-metadata">
        <FileText size={14} />
        <span>
          {answer.provider.startsWith("ollama-")
            ? "AI synthesis from cited sources"
            : "Source extracts"}{" "}
          ·{" "}
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
          <p>{answer.reliability.next_step}</p>
        </div>
        {nextAction && (
          <a
            className="button primary"
            href={
              nextAction.href || `/cases?from=${encodeURIComponent(answer.id)}`
            }
          >
            {nextAction.label}
          </a>
        )}
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
            Browse Knowledge <ChevronRight size={15} />
          </a>
        )}
      </div>
    </motion.section>
  );
}
