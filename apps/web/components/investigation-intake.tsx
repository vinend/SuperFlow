"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { InvestigationView } from "@/lib/investigation";
import { useSession } from "./session";

export function InvestigationIntake({
  onCreated,
}: {
  onCreated: (value: InvestigationView) => void;
}) {
  const { user } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submitIntake(intake: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api<InvestigationView>("/api/investigations", user, {
        method: "POST",
        body: JSON.stringify({ intake }),
      });
      onCreated(result);
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load the investigation.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Load investigation">
      <h2>Start an investigation</h2>
      <p className="muted small">
        Open a sample alert or import a prepared investigation record.
      </p>
      <button
        className="button primary"
        type="button"
        disabled={busy}
        onClick={async () => {
          try {
            const response = await fetch("/samples/investigation-intake.json");
            if (!response.ok)
              throw new Error("Sample investigation is unavailable.");
            await submitIntake(await response.json());
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load the sample.",
            );
          }
        }}
      >
        {busy ? "Loading…" : "Load sample investigation"}
      </button>
      <details>
        <summary>Import investigation</summary>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const file = new FormData(form).get("records");
            if (!(file instanceof File) || file.size > 100_000) {
              setError(
                "Select a supported investigation file smaller than 100 KB.",
              );
              return;
            }
            try {
              const intake: unknown = JSON.parse(await file.text());
              if (await submitIntake(intake)) form.reset();
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not read the investigation file.",
              );
            }
          }}
        >
          <label htmlFor="investigation-records">Investigation file</label>
          <input
            id="investigation-records"
            name="records"
            type="file"
            accept=".json,application/json"
            required
            disabled={busy}
          />
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Importing…" : "Import investigation"}
          </button>
        </form>
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
