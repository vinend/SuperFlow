"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type User } from "@/lib/api";
import type {
  RegulatoryReviewSummary,
  RegulatoryReviewView,
  RegulatorySourceView,
} from "@/lib/regulatory-contracts";
import { isRegulatoryReviewView } from "@/lib/regulatory-view";

const BASE = "/api/regulatory-reviews";

export function useRegulatoryWorkspace(user: User, reviewId: string | null) {
  const [sources, setSources] = useState<RegulatorySourceView[]>([]);
  const [reviews, setReviews] = useState<RegulatoryReviewSummary[]>([]);
  const [current, setCurrent] = useState<RegulatoryReviewView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const reviewer = user.role_id === "compliance";
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (reviewId) {
        const result = await api<RegulatoryReviewView>(
          `${BASE}/${encodeURIComponent(reviewId)}`,
          user,
          { signal },
        );
        if (!isRegulatoryReviewView(result))
          throw new Error(
            "Regulatory review details could not be loaded. Refresh before continuing.",
          );
        if (!signal.aborted && mounted.current) setCurrent(result);
        return;
      }
      // Only Compliance may start reviews; others see reviews they can access.
      const [list, available] = await Promise.all([
        api<RegulatoryReviewSummary[]>(BASE, user, { signal }),
        reviewer
          ? api<RegulatorySourceView[]>(`${BASE}/sources`, user, { signal })
          : Promise.resolve([]),
      ]);
      if (signal.aborted || !mounted.current) return;
      setReviews(list);
      setSources(available);
    },
    [user, reviewId, reviewer],
  );
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    load(abort.signal)
      .catch((reason: Error) => {
        if (!abort.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => {
      mounted.current = false;
      abort.abort();
    };
  }, [load]);
  const send = async (path: string, values: Record<string, unknown>) => {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const result = await api<RegulatoryReviewView>(path, user, {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (!isRegulatoryReviewView(result))
        throw new Error(
          "Regulatory review details are unavailable. Refresh before continuing.",
        );
      if (mounted.current && reviewId) setCurrent(result);
      return result;
    } catch (reason) {
      if (mounted.current) setError((reason as Error).message);
      return null;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const start = (documentId: string) => send(BASE, { document_id: documentId });
  // Every decision carries the revision it was made against plus a fresh key.
  const mutate = (path: string, values: Record<string, unknown> = {}) =>
    current
      ? send(`${BASE}/${encodeURIComponent(current.id)}/${path}`, {
          expected_revision: current.revision,
          idempotency_key: crypto.randomUUID(),
          ...values,
        })
      : Promise.resolve(null);
  return {
    sources,
    reviews,
    current,
    error,
    loading,
    busy,
    reviewer,
    start,
    mutate,
  };
}
