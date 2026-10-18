"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { api, type KnowledgeDocument } from "@/lib/api";
import { useSession } from "./session";

export function OjkDiscovery({
  saved,
  choosePage,
}: {
  saved: (document: KnowledgeDocument) => void;
  choosePage: (url: string) => void;
}) {
  const { user } = useSession();
  const reduce = useReducedMotion();
  const [results, setResults] = useState<{ title: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResults([]);
    const values = new FormData(event.currentTarget);
    try {
      const value = await api<{ results: typeof results }>(
        "/api/ojk/search",
        user,
        {
          method: "POST",
          body: JSON.stringify({ query: values.get("query") }),
        },
      );
      setResults(value.results);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importPdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      saved(
        await api<KnowledgeDocument>("/api/ojk/import", user, {
          method: "POST",
          body: JSON.stringify({ url, title }),
        }),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="ojk-discovery">
      <summary>Find and import official OJK documents</summary>
      <form className="editor-form" onSubmit={search}>
        <label>
          Search OJK on Google
          <input
            name="query"
            placeholder="POJK layanan digital bank umum"
            required
            minLength={3}
            maxLength={200}
            disabled={busy}
          />
        </label>
        <button className="button secondary" disabled={busy}>
          {busy ? "Working…" : "Search with headless browser"}
        </button>
        <p className="muted small">
          Google may block automated searches. You can also paste an official
          PDF link below. Search snippets are never added as evidence.
        </p>
      </form>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <motion.ul
          className="source-references"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {results.map((item) => (
            <li key={item.url}>
              <strong>{item.title}</strong>
              <p className="muted small">{item.url}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  if (/\.pdf(?:$|\?)/i.test(item.url)) {
                    setUrl(item.url);
                    setTitle(item.title.slice(0, 200));
                  } else choosePage(item.url);
                }}
              >
                {/\.pdf(?:$|\?)/i.test(item.url)
                  ? "Use this PDF"
                  : "Use this page"}
              </button>
            </li>
          ))}
        </motion.ul>
      )}
      <form className="editor-form" onSubmit={importPdf}>
        <label>
          Official OJK PDF URL
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ojk.go.id/…/document.pdf"
            maxLength={2048}
            disabled={busy}
          />
        </label>
        <label>
          Reference title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={3}
            maxLength={200}
            disabled={busy}
          />
        </label>
        <label>
          <input name="review" type="checkbox" required disabled={busy} />{" "}
          Import as a public reference for all roles. Legal applicability
          still requires review.
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? "Downloading and indexing…" : "Import OJK PDF into Knowledge"}
        </button>
        <p className="muted small">
          The original PDF, checksum, source URL, page citations and searchable
          index are saved together. Large files may take a few minutes.
        </p>
      </form>
    </details>
  );
}
