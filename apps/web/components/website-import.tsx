"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api, DOMAINS, KnowledgeDocument, ROLES } from "@/lib/api";
import { useSession } from "./session";
import { Dialog } from "./ui/dialog";
import { OjkDiscovery } from "./ojk-discovery";
import { EvidenceOrigin } from "./evidence-origin";

export type WebsiteCapture = {
  id: string;
  url: string;
  title: string;
  captured_at: string;
  text: string;
  text_truncated: boolean;
  coverage: string;
  vision_model: string;
  screenshots: { y: number; image: string; sha256: string }[];
  observations: {
    screenshot: number;
    visible_text: string;
    visual_description: string;
    limitations: string;
  }[];
};

export function WebsiteEvidence({ capture }: { capture: WebsiteCapture }) {
  return (
    <div className="website-evidence">
      <EvidenceOrigin
        source={{
          source_origin: "internet",
          capture_engine: "puppeteer",
          vision_model: capture.vision_model,
        }}
      />
      <p>
        <strong>Source:</strong> {capture.url}
      </p>
      <p className="muted small">
        Captured {new Date(capture.captured_at).toLocaleString()} ·{" "}
        {capture.vision_model}
      </p>
      <p className="notice">
        {capture.coverage} Vision output can be inaccurate; compare it with the
        screenshots before applying guidance.
      </p>
      {capture.screenshots.map((screenshot, index) => (
        <details key={`${index}:${screenshot.sha256}`} open={index === 0}>
          <summary>
            Screenshot {index + 1} · vertical offset {screenshot.y}px
          </summary>
          {/* Browser-captured data, never a remote image URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="website-screenshot"
            src={`data:image/png;base64,${screenshot.image}`}
            alt={`Captured website viewport ${index + 1}`}
          />
          <p className="muted small">SHA256: {screenshot.sha256}</p>
          <a
            className="text-link"
            href={`data:image/png;base64,${screenshot.image}`}
            download={`website-screenshot-${index + 1}.png`}
          >
            Download full-resolution screenshot
          </a>
        </details>
      ))}
      <details>
        <summary>
          Extracted website text{capture.text_truncated ? " (truncated)" : ""}
        </summary>
        <pre>{capture.text}</pre>
      </details>
      {capture.observations.map((item) => (
        <section key={item.screenshot}>
          <span className="method-badge">
            Vision observation · not a cited fact
          </span>
          <h3>Vision scan · screenshot {item.screenshot}</h3>
          <p>{item.visual_description}</p>
          <details>
            <summary>Text read by vision</summary>
            <pre>{item.visible_text}</pre>
          </details>
          <p className="muted small">Limitations: {item.limitations}</p>
        </section>
      ))}
    </div>
  );
}

export function WebsiteImport({
  close,
  saved,
}: {
  close: () => void;
  saved: (document: KnowledgeDocument) => void;
}) {
  const { user, users } = useSession();
  const [capture, setCapture] = useState<WebsiteCapture | null>(null);
  const [roles, setRoles] = useState<string[]>([user.role_id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  async function scan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      setCapture(
        await api<WebsiteCapture>("/api/web-sources/preview", user, {
          method: "POST",
          body: JSON.stringify({ url: values.get("url") }),
        }),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      saved(
        await api<KnowledgeDocument>("/api/web-sources", user, {
          method: "POST",
          body: JSON.stringify({
            capture_id: capture!.id,
            reviewed: values.get("reviewed") === "on",
            metadata: {
              title: values.get("title"),
              domain: values.get("domain"),
              owner_id: values.get("owner"),
              authority_level: 2,
              access_roles: roles,
              related_document_ids: [],
            },
          }),
        }),
      );
      close();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      label="Import website"
      className="editor-modal"
      close={close}
      busy={busy}
    >
      <div className="panel-heading">
        <span>Import website</span>
        <button
          className="icon-button"
          aria-label="Close website import"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {!capture ? (
        <div>
          <OjkDiscovery
            saved={(document) => {
              saved(document);
              close();
            }}
            choosePage={setUrl}
          />
          <form className="editor-form" onSubmit={scan}>
            <p className="muted">
              Scan one public page with a headless browser and a local vision
              model. No login or recursive crawl.
            </p>
            <label>
              Website URL
              <input
                name="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                type="url"
                required
                maxLength={2048}
                placeholder="https://example.com"
                disabled={busy}
              />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? "Capturing and scanning…" : "Scan website"}
            </button>
            {busy && (
              <p role="status" className="muted">
                The first model load can take a few minutes. Keep this window
                open.
              </p>
            )}
          </form>
        </div>
      ) : (
        <div className="editor-form">
          <WebsiteEvidence capture={capture} />
          <form className="editor-form" onSubmit={save}>
            <label>
              Document title
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                defaultValue={capture.title || "Website capture"}
              />
            </label>
            <div className="form-grid">
              <label>
                Domain
                <select name="domain" defaultValue="Operations">
                  {DOMAINS.map((domain) => (
                    <option key={domain}>{domain}</option>
                  ))}
                </select>
              </label>
              <label>
                Document owner
                <select name="owner" defaultValue={user.id}>
                  {users.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
            <p className="notice">
              Saves page text as a draft with external-reference authority
              (2/5). Vision observations stay as review evidence and are not
              added as knowledge facts. A knowledge owner can publish it after
              review. Website-derived answers will continue to require human
              review.
            </p>
            <label>
              <input name="reviewed" type="checkbox" required /> I reviewed the
              captured text, screenshots, and vision observations.
            </label>
            <div className="tag-row">
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => setCapture(null)}
              >
                Scan another page
              </button>
              <button
                className="button primary"
                disabled={busy || roles.length === 0}
              >
                {busy ? "Saving…" : "Save draft source"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Dialog>
  );
}
