"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type User } from "@/lib/api";
import type { ImpactWorkspace } from "@/lib/analytics-contracts";
import { isImpactWorkspace } from "@/lib/analytics-view";

export function useImpactWorkspace(user: User) {
  const [workspace, setWorkspace] = useState<ImpactWorkspace | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const accept = useCallback((value: unknown) => {
    if (!isImpactWorkspace(value))
      throw new Error(
        "Impact data did not match the approved component registry. Refresh after checking the API version.",
      );
    if (mounted.current) setWorkspace(value);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    api<ImpactWorkspace>("/api/impact", user, { signal: abort.signal })
      .then(accept)
      .catch((reason: Error) => {
        if (!abort.signal.aborted && mounted.current) setError(reason.message);
      })
      .finally(() => {
        if (!abort.signal.aborted && mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
      abort.abort();
    };
  }, [accept, user]);

  const ask = async (question: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      accept(
        await api<ImpactWorkspace>("/api/impact", user, {
          method: "POST",
          body: JSON.stringify({ question }),
        }),
      );
    } catch (reason) {
      if (mounted.current) setError((reason as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return { workspace, error, loading, busy, ask };
}
