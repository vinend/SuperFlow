"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { api } from "@/lib/api";
import { useSession } from "./session";

type IndexStatus = {
  engine: string;
  model: string;
  total_chunks: number;
  indexed_chunks: number;
  documents: { id: string; title: string; ready: boolean }[];
};
export function RagStatus({ revision }: { revision: string }) {
  const { user } = useSession();
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<IndexStatus>("/api/rag/status", user, { signal: controller.signal })
      .then(setStatus)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [user, revision]);
  async function rebuild() {
    if (!status) return;
    setBusy(true);
    setError("");
    try {
      for (const document of status.documents.filter((d) => !d.ready)) {
        setProgress(`Indexing ${document.title}…`);
        await api("/api/rag/index", user, {
          method: "POST",
          body: JSON.stringify({ document_id: document.id }),
        });
      }
      setStatus(await api<IndexStatus>("/api/rag/status", user));
      setProgress("Search index is ready.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rag-status">
      <summary>
        Search index ·{" "}
        {status
          ? `${status.indexed_chunks} / ${status.total_chunks} sections ready`
          : "Checking…"}
      </summary>
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
      >
        {status && (
          <p className="muted small">
            {status.engine} · {status.model}
          </p>
        )}
        {progress && <p role="status">{progress}</p>}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button
          className="button secondary"
          disabled={busy || !status || status.documents.every((d) => d.ready)}
          onClick={rebuild}
        >
          {busy ? "Indexing…" : "Index missing sections"}
        </button>
      </motion.div>
    </details>
  );
}
