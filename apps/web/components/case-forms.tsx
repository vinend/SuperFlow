"use client";

import { useEffect, useState } from "react";
import { api, type Answer, type KnowledgeDocument, type User } from "@/lib/api";
import type { CaseView } from "@/lib/workflow-contracts";
import { askAction, businessStatus, roleLabel } from "@/lib/product-view";
import { useSession } from "./session";
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
  const { users } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CaseView["type"]>("general");
  const [owner, setOwner] = useState(user.id);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [saved, setSaved] = useState<CaseView | null>(null);
  useEffect(() => {
    if (!origin) return;
    const abort = new AbortController();
    api<Answer>(`/api/ask/${origin}`, user, { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) {
          setAnswer(value);
          setTitle(askAction(value)?.title || "Policy Review");
          setDescription(value.question);
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
      <ErrorState message="This source is restricted. Start a request using sources you can access." />
    );
  return (
    <form
      className="workflow-form case-create-form"
      aria-label="Submit request"
      onSubmit={async (event) => {
        event.preventDefault();
        const result =
          saved ||
          (await submit("/api/cases", {
            title,
            description,
            type,
            owner_id: owner,
            question_run_id: origin,
            allow_recovery: recovery,
          }));
        if (!result) return;
        setSaved(result);
        // Retry submission against the saved request, never create a duplicate.
        const started = await submit("/api/workflows/generic-review-v1/start", {
          case_id: result.id,
          expected_revision: result.revision,
          idempotency_key: `submit-${result.id}`,
        });
        if (started) created(started.id);
      }}
    >
      <h2>
        {saved
          ? "Request saved — submit for review"
          : answer
            ? askAction(answer)?.label
            : "New request"}
      </h2>
      {answer && (
        <p className="workflow-note">
          {businessStatus(answer.reliability.status)} ·{" "}
          {answer.reliability.summary}
        </p>
      )}
      <label>
        Request title
        <input
          aria-label="Request title"
          required
          minLength={3}
          maxLength={200}
          value={title}
          disabled={busy || Boolean(saved)}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          aria-label="Request description"
          rows={3}
          maxLength={4000}
          value={description}
          disabled={busy || Boolean(saved)}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="form-columns">
        <label>
          Request category
          <select
            aria-label="Request category"
            value={type}
            disabled={busy || Boolean(saved)}
            onChange={(event) =>
              setType(event.target.value as CaseView["type"])
            }
          >
            {["general", "operations", "audit"].map((item) => (
              <option key={item} value={item}>
                {item === "general"
                  ? "General request"
                  : item === "audit"
                    ? "Policy review"
                    : "Operations review"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Owner
          <select
            aria-label="Request owner"
            value={owner}
            disabled={
              busy ||
              Boolean(saved) ||
              !["manager", "governance"].includes(user.role_id)
            }
            onChange={(event) => setOwner(event.target.value)}
          >
            {users.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} — {roleLabel(person.role_id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        Your request will appear in My Work. An independent reviewer decides
        after the required supporting information has been checked.
      </p>
      {answer?.reliability.status === "BLOCKED" && (
        <label className="checkbox">
          <input
            type="checkbox"
            required
            checked={recovery}
            onChange={(event) => setRecovery(event.target.checked)}
          />
          I understand this request collects missing information. No exception
          or business action is authorized yet.
        </label>
      )}
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Submitting…" : "Submit Request"}
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
      <summary>Provide supporting information</summary>
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
          Choose the exact section that supports this request. A current
          replacement will replace historical material in the request context.
        </p>
        {error && <ErrorState message={error} />}
        <button
          className="button secondary"
          disabled={busy || loading || !chunkId}
        >
          Add information
        </button>
      </form>
    </details>
  );
}
