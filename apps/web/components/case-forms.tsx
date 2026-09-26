"use client";

import { useEffect, useState } from "react";
import { api, type Answer, type KnowledgeDocument, type User } from "@/lib/api";
import type { CaseView } from "@/lib/workflow-contracts";
import { ErrorState, LoadingState } from "./ui/primitives";

type Submit = (
  path: string,
  value: Record<string, unknown>,
  method?: string,
) => Promise<CaseView | null>;

export function CaseCreateForm({
  user,
  origin,
  busy,
  submit,
  created,
}: {
  user: User;
  origin: string | null;
  busy: boolean;
  submit: Submit;
  created: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CaseView["type"]>("general");
  const [owner, setOwner] = useState(user.id);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!origin) return;
    const abort = new AbortController();
    api<Answer>(`/api/ask/${origin}`, user, { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) {
          setAnswer(value);
          setTitle(value.question.slice(0, 200));
        }
      })
      .catch((reason: Error) => {
        if (!abort.signal.aborted) setError(reason.message);
      });
    return () => abort.abort();
  }, [origin, user]);
  if (origin && !answer && !error)
    return <LoadingState label="Checking saved answer context…" />;
  if (error) return <ErrorState message={error} />;
  if (answer?.reliability.status === "ACCESS_RESTRICTED")
    return (
      <ErrorState message="Restricted context cannot be carried into a case. Create a manual case with permitted sources." />
    );
  return (
    <form
      className="workflow-form case-create-form"
      aria-label="Create case"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await submit("/api/cases", {
          title,
          description,
          type,
          owner_id: owner,
          question_run_id: origin,
          allow_recovery: recovery,
        });
        if (result) created(result.id);
      }}
    >
      <h2>{origin ? "Carry knowledge into a case" : "New case"}</h2>
      {answer && (
        <p className="workflow-note">
          {answer.reliability.status} · {answer.reliability.summary} Only
          authorized source references are carried forward.
        </p>
      )}
      <label>
        Case title
        <input
          aria-label="Case title"
          required
          minLength={3}
          maxLength={200}
          value={title}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          aria-label="Case description"
          rows={3}
          maxLength={4000}
          value={description}
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="form-columns">
        <label>
          Type
          <select
            aria-label="Case type"
            value={type}
            disabled={busy}
            onChange={(event) =>
              setType(event.target.value as CaseView["type"])
            }
          >
            {[
              "general",
              "operations",
              "audit",
              "regulatory_review",
              "investment",
            ].map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Owner
          <input
            aria-label="Case owner"
            value={owner}
            disabled={busy || !["manager", "governance"].includes(user.role_id)}
            onChange={(event) => setOwner(event.target.value)}
          />
        </label>
      </div>
      <p className="muted small">
        Types classify the workspace; regulation and investment logic are
        deferred. New cases without approved evidence remain blocked.
      </p>
      {answer?.reliability.status === "BLOCKED" && (
        <label className="checkbox">
          <input
            type="checkbox"
            required
            checked={recovery}
            onChange={(event) => setRecovery(event.target.checked)}
          />
          Create this case only to collect missing evidence; no conclusion or
          action is authorized.
        </label>
      )}
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create case"}
      </button>
    </form>
  );
}

export function EvidenceAttach({
  user,
  current,
  busy,
  submit,
}: {
  user: User;
  current: CaseView;
  busy: boolean;
  submit: Submit;
}) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [chunks, setChunks] = useState<{ id: string; section_path: string }[]>(
    [],
  );
  const [chunkId, setChunkId] = useState("");
  const [requirement, setRequirement] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    api<KnowledgeDocument[]>("/api/documents", user, { signal: abort.signal })
      .then(setDocuments)
      .catch((reason: Error) => {
        if (!abort.signal.aborted) setError(reason.message);
      });
    return () => abort.abort();
  }, [user]);
  const pick = async (id: string) => {
    setDocumentId(id);
    setChunkId("");
    setChunks([]);
    setError("");
    if (!id) return;
    setLoading(true);
    try {
      const doc = await api<KnowledgeDocument>(`/api/documents/${id}`, user);
      const source = doc.versions.find(
        (version) => version.status === "active",
      );
      setChunks(source?.chunks || []);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <details className="evidence-attach">
      <summary>Attach source evidence</summary>
      <form
        className="workflow-form"
        onSubmit={async (event) => {
          event.preventDefault();
          await submit(`/api/cases/${current.id}/evidence`, {
            chunk_ids: [chunkId],
            requirement_key: requirement || null,
          });
        }}
      >
        <label>
          Permitted source
          <select
            aria-label="Evidence document"
            value={documentId}
            required
            disabled={busy || loading}
            onChange={(event) => void pick(event.target.value)}
          >
            <option value="">Select a source</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Current section
          <select
            aria-label="Evidence section"
            value={chunkId}
            required
            disabled={busy || loading}
            onChange={(event) => setChunkId(event.target.value)}
          >
            <option value="">
              {loading ? "Loading sections…" : "Select a current section"}
            </option>
            {chunks.map((chunk) => (
              <option key={chunk.id} value={chunk.id}>
                {chunk.section_path}
              </option>
            ))}
          </select>
        </label>
        <label>
          Evidence requirement
          <select
            aria-label="Evidence requirement"
            value={requirement}
            disabled={busy}
            onChange={(event) => setRequirement(event.target.value)}
          >
            <option value="">Supporting source (no extra requirement)</option>
            {current.evidence
              .filter((item) => item.key.startsWith("request-"))
              .map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label} · {item.status}
                </option>
              ))}
          </select>
        </label>
        <p className="muted small">
          Evidence references exact database chunks. Attaching a current
          replacement retires historical context for that source.
        </p>
        {error && <ErrorState message={error} />}
        <button
          className="button secondary"
          disabled={busy || loading || !chunkId}
        >
          Attach evidence
        </button>
      </form>
    </details>
  );
}
