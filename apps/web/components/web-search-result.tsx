"use client";

import { useState } from "react";
import { api, type Answer } from "@/lib/api";
import { useSession } from "./session";
import { Dialog } from "./ui/dialog";
import { WebsiteEvidence, type WebsiteCapture } from "./website-import";

export function WebSearchResult({ answer }: { answer: Answer }) {
  const { user } = useSession();
  const [capture, setCapture] = useState<WebsiteCapture | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const search = answer.web_search;
  if (!search) return null;
  async function inspect() {
    setBusy(true);
    setError("");
    try {
      setCapture(
        await api<WebsiteCapture>(`/api/ask/${answer.id}/web-search`, user),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`notice websearch-result ${search.status}`}>
      <div role="status">
        <strong>
          WebSearch ·{" "}
          {search.status === "complete"
            ? "Sources read"
            : search.status === "partial"
              ? "Some sources unavailable"
              : "Unavailable"}
        </strong>
        <p>{search.message}</p>
      </div>
      <div className="tag-row">
        <a
          className="text-link"
          href={search.search_url}
          target="_blank"
          rel="noreferrer"
        >
          Open Google search
        </a>
        {search.search_capture_id && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void inspect()}
          >
            {busy ? "Loading Google scan…" : "Inspect Google scan"}
          </button>
        )}
      </div>
      {search.google_vision_observations?.length ? (
        <details>
          <summary>Google results vision scan</summary>
          {search.google_vision_observations.map((item, index) => (
            <p key={index}>
              {item.visual_description}{" "}
              <span className="muted">{item.limitations}</span>
            </p>
          ))}
        </details>
      ) : null}
      {error && <p role="alert">{error}</p>}
      {capture && (
        <Dialog
          label="Google browser and vision evidence"
          close={() => setCapture(null)}
        >
          <div className="panel-heading">
            <h2>Google browser and vision evidence</h2>
            <button className="text-button" onClick={() => setCapture(null)}>
              Close Google scan
            </button>
          </div>
          <div className="source-content">
            <WebsiteEvidence capture={capture} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
