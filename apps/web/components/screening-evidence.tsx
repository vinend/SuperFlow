"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { InvestigationView } from "@/lib/investigation";
import { useSession } from "./session";

type Source = {
  url: string;
  title: string;
  excerpt: string;
  capture_id: string;
};
type Capture = {
  observations?: {
    visible_text: string;
    visual_description: string;
    limitations: string;
  }[];
};

export function BrowserScreeningEvidence({
  investigationId,
  runs,
}: {
  investigationId: string;
  runs: InvestigationView["tool_runs"];
}) {
  const { user } = useSession();
  const [captures, setCaptures] = useState<Record<string, Capture>>({});
  const [error, setError] = useState("");
  const sources = runs.flatMap((run) =>
    run.result.provider === "google-puppeteer-vision" &&
    Array.isArray(run.result.sources)
      ? (run.result.sources as Source[])
      : [],
  );
  return (
    <div aria-label="Internet screening evidence">
      {sources.map((source) => (
        <details key={source.capture_id}>
          <summary>Internet · {source.title}</summary>
          <a href={source.url} target="_blank" rel="noreferrer">
            Open original source
          </a>
          <p>{source.excerpt}</p>
          <button
            type="button"
            className="button secondary"
            onClick={async () => {
              setError("");
              try {
                const capture = await api<Capture>(
                  `/api/investigations/${investigationId}/captures/${source.capture_id}`,
                  user,
                );
                setCaptures((previous) => ({
                  ...previous,
                  [source.capture_id]: capture,
                }));
              } catch {
                setError(
                  "Vision evidence is unavailable or access has changed.",
                );
              }
            }}
          >
            Inspect vision observations
          </button>
          {captures[source.capture_id]?.observations?.map(
            (observation, index) => (
              <div key={index}>
                <p>
                  <strong>Unverified vision observation</strong>
                </p>
                <p>{observation.visual_description}</p>
                <p>{observation.visible_text}</p>
                <p>{observation.limitations}</p>
              </div>
            ),
          )}
        </details>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
