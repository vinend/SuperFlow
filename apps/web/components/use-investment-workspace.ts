"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type User } from "@/lib/api";
import type {
  InvestmentSummary,
  InvestmentView,
  ProposalSourceView,
} from "@/lib/investment-contracts";
import { isInvestmentView } from "@/lib/investment-view";

const BASE = "/api/investment-analyses";

export function useInvestmentWorkspace(user: User, analysisId: string | null) {
  const [sources, setSources] = useState<ProposalSourceView[]>([]);
  const [analyses, setAnalyses] = useState<InvestmentSummary[]>([]);
  const [current, setCurrent] = useState<InvestmentView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const analyst = user.role_id === "finance";
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (analysisId) {
        const result = await api<InvestmentView>(
          `${BASE}/${encodeURIComponent(analysisId)}`,
          user,
          { signal },
        );
        if (!isInvestmentView(result))
          throw new Error(
            "Investment analysis could not be loaded. Refresh before continuing.",
          );
        if (!signal.aborted && mounted.current) setCurrent(result);
        return;
      }
      // Only Finance may start analyses; others see analyses they can access.
      const [list, available] = await Promise.all([
        api<InvestmentSummary[]>(BASE, user, { signal }),
        analyst
          ? api<ProposalSourceView[]>(`${BASE}/sources`, user, { signal })
          : Promise.resolve([]),
      ]);
      if (signal.aborted || !mounted.current) return;
      setAnalyses(list);
      setSources(available);
    },
    [user, analysisId, analyst],
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
      const result = await api<InvestmentView>(path, user, {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (!isInvestmentView(result))
        throw new Error(
          "Investment analysis is unavailable. Refresh before continuing.",
        );
      if (mounted.current && analysisId) setCurrent(result);
      return result;
    } catch (reason) {
      if (mounted.current) setError((reason as Error).message);
      return null;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const start = (proposalId: string, supporting: string[]) =>
    send(BASE, {
      proposal_document_id: proposalId,
      supporting_document_ids: supporting,
    });
  // Every action carries the revision it was made against plus a fresh key.
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
    analyses,
    current,
    error,
    loading,
    busy,
    analyst,
    start,
    mutate,
  };
}
