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
  return (
    <section className="panel" aria-label="Import investigation records">
      <h2>Import investigation records</h2>
      <p className="muted small">
        Upload a JSON record with the customer profile, transaction summary and
        record source. Browser screening collects public sources separately.
      </p>
      <a href="/samples/investigation-intake.json" download>
        Download sample JSON format
      </a>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const file = new FormData(form).get("records");
          if (!(file instanceof File) || file.size > 100_000) {
            setError("Select a JSON file smaller than 100 KB.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const intake: unknown = JSON.parse(await file.text());
            const result = await api<InvestigationView>(
              "/api/investigations",
              user,
              { method: "POST", body: JSON.stringify({ intake }) },
            );
            form.reset();
            onCreated(result);
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : "Import failed.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="investigation-records">Investigation JSON</label>
        <input
          id="investigation-records"
          name="records"
          type="file"
          accept=".json,application/json"
          required
          disabled={busy}
        />
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "Importing…" : "Import records"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
