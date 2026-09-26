"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type User } from "@/lib/api";
import type {
  ApprovalView,
  CaseView,
  DefinitionView,
  WorkflowView,
} from "@/lib/workflow-contracts";
import { isCaseView, type CaseSummary } from "@/lib/workflow-view";

export function useActionWorkspace(user: User, caseId: string | null) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [definitions, setDefinitions] = useState<DefinitionView[]>([]);
  const [runs, setRuns] = useState<WorkflowView[]>([]);
  const [approvals, setApprovals] = useState<ApprovalView[]>([]);
  const [current, setCurrent] = useState<CaseView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (caseId) {
        // A request contains its own progress, tasks, reviews and activity.
        // Do not make opening it wait for unrelated workspace-wide lists.
        const [result, templates] = await Promise.all([
          api<CaseView>(`/api/cases/${caseId}`, user, { signal }),
          api<DefinitionView[]>("/api/workflow-definitions", user, { signal }),
        ]);
        if (!isCaseView(result))
          throw new Error(
            "Request details could not be loaded. Refresh before continuing.",
          );
        if (!signal.aborted && mounted.current) {
          setCurrent(result);
          setDefinitions(templates);
        }
        return;
      }
      const [caseList, templates, workflowRuns, queue] = await Promise.all([
        api<CaseSummary[]>("/api/cases", user, { signal }),
        api<DefinitionView[]>("/api/workflow-definitions", user, { signal }),
        api<WorkflowView[]>("/api/workflow-runs", user, { signal }),
        api<ApprovalView[]>("/api/approvals", user, { signal }),
      ]);
      if (signal.aborted || !mounted.current) return;
      setCases(caseList);
      setDefinitions(templates);
      setRuns(workflowRuns);
      setApprovals(queue);
    },
    [user, caseId],
  );
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    controller.current = abort;
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
      controller.current?.abort();
    };
  }, [load]);
  const mutate = async (
    path: string,
    values: Record<string, unknown>,
    method = "POST",
  ) => {
    if (busy) return null;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await api<CaseView>(path, user, {
        method,
        signal: abort.signal,
        body: JSON.stringify({
          ...(current
            ? {
                expected_revision: current.revision,
                idempotency_key: crypto.randomUUID(),
              }
            : {}),
          ...values,
        }),
      });
      if (!isCaseView(result))
        throw new Error(
          "Request details are unavailable. Refresh before continuing.",
        );
      if (!mounted.current || abort.signal.aborted) return null;
      // Creation returns an ID to the router; render its workspace only after the
      // new URL owns the request lifecycle. Avoid actions during navigation.
      if (caseId) setCurrent(result);
      return result;
    } catch (reason) {
      if (!abort.signal.aborted && mounted.current)
        setError((reason as Error).message);
      return null;
    } finally {
      if (!abort.signal.aborted && mounted.current) setBusy(false);
    }
  };
  return {
    cases,
    definitions,
    runs,
    approvals,
    current,
    error,
    loading,
    busy,
    mutate,
  };
}
