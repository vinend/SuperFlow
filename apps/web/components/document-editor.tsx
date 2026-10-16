"use client";

import { useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { api, DOMAINS, KnowledgeDocument, ROLES } from "@/lib/api";
import { useSession } from "./session";
import { Dialog } from "./ui/dialog";

export type EditorMode = "upload" | "metadata" | "version";

export function DocumentEditor({
  mode,
  document,
  documents,
  close,
  saved,
}: {
  mode: EditorMode;
  document?: KnowledgeDocument;
  documents: KnowledgeDocument[];
  close: () => void;
  saved: (document: KnowledgeDocument) => void;
}) {
  const { user, users } = useSession();
  const [roles, setRoles] = useState(document?.access_roles || ROLES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isVersion = mode === "version";
  const isMetadata = mode === "metadata";
  const title = isVersion
    ? "Add document version"
    : isMetadata
      ? "Edit document metadata"
      : "Add knowledge source";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const metadata = {
      title: values.get("title"),
      domain: values.get("domain"),
      owner_id: values.get("owner"),
      authority_level: Number(values.get("authority")),
      access_roles: roles,
      related_document_ids: values.getAll("related"),
    };
    try {
      let result: KnowledgeDocument;
      if (isMetadata) {
        result = await api<KnowledgeDocument>(
          `/api/documents/${document!.id}`,
          user,
          { method: "PATCH", body: JSON.stringify(metadata) },
        );
      } else {
        const form = new FormData();
        form.set("file", values.get("file") as File);
        form.set("version", String(values.get("version")));
        form.set("effective_date", String(values.get("effective_date")));
        form.set("status", String(values.get("status")));
        if (!isVersion) form.set("metadata", JSON.stringify(metadata));
        result = await api<KnowledgeDocument>(
          isVersion
            ? `/api/documents/${document!.id}/versions`
            : "/api/documents",
          user,
          { method: "POST", body: form },
        );
      }
      saved(result);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog label={title} className="editor-modal" close={close} busy={busy}>
      <div className="panel-heading">
        <span>{title}</span>
        <button
          className="icon-button"
          aria-label="Close document editor"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit} className="editor-form">
        <p className="muted">
          {isVersion
            ? `A new immutable source version for ${document!.title}. Publishing supersedes the current active version.`
            : "Add a source with its owner, authority, and permitted readers."}
        </p>
        {!isVersion && (
          <>
            <label>
              Document title
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                defaultValue={document?.title}
                placeholder="e.g. Remote Working Policy"
              />
            </label>
            <div className="form-grid">
              <label>
                Domain
                <select
                  name="domain"
                  defaultValue={document?.domain || "People"}
                >
                  {DOMAINS.map((domain) => (
                    <option key={domain}>{domain}</option>
                  ))}
                </select>
              </label>
              <label>
                Document owner
                <select
                  name="owner"
                  defaultValue={document?.owner_id || user.id}
                >
                  {users.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Source authority
              <select
                name="authority"
                defaultValue={document?.authority_level || 4}
              >
                {[5, 4, 3, 2, 1].map((level) => (
                  <option value={level} key={level}>
                    {level} / 5
                    {level === 5
                      ? " · authoritative policy"
                      : level === 2
                        ? " · proposal / external reference"
                        : ""}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Roles allowed to read this source</legend>
              <div className="role-checks">
                {ROLES.map((role) => (
                  <label key={role}>
                    <input
                      type="checkbox"
                      checked={roles.includes(role)}
                      onChange={(event) =>
                        setRoles(
                          event.target.checked
                            ? [...roles, role]
                            : roles.filter((item) => item !== role),
                        )
                      }
                    />
                    {role}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Related documents{" "}
              <span className="muted">
                (optional; Ctrl/Cmd to select multiple)
              </span>
              <select
                name="related"
                multiple
                defaultValue={document?.related_document_ids || []}
                className="multi-select"
              >
                {documents
                  .filter((item) => item.id !== document?.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        {!isMetadata && (
          <>
            <div className="form-grid">
              <label>
                Version label
                <input
                  name="version"
                  required
                  pattern="[A-Za-z0-9_.\-]+"
                  maxLength={30}
                  defaultValue={isVersion ? "" : "1.0"}
                  placeholder="e.g. 2.0"
                />
              </label>
              <label>
                Effective date
                <input
                  name="effective_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
            </div>
            <label>
              Version status
              <select name="status" defaultValue="active">
                <option value="active">Active · used for answers</option>
                <option value="draft">Draft · excluded from retrieval</option>
                <option value="outdated">
                  Outdated · historical reference
                </option>
              </select>
            </label>
            <label className="file-upload">
              <UploadCloud size={25} />
              <strong>Choose a source file</strong>
              <span>PDF, DOCX, TXT, Markdown, PNG, or JPEG · up to 10 MB</span>
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
              />
            </label>
            <p className="muted small">
              Scanned PDFs and images use local OCR when enabled. OCR text
              requires review against the original. Future-effective versions
              must remain draft.
            </p>
          </>
        )}
        {error && (
          <div role="alert" className="error-message">
            {error}
          </div>
        )}
        <div className="form-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || (!isVersion && !roles.length)}
            type="submit"
          >
            {busy
              ? "Saving…"
              : isMetadata
                ? "Save metadata"
                : isVersion
                  ? "Add version"
                  : "Upload document"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
