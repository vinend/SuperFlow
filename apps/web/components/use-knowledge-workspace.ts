"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Answer, HistoryItem, KnowledgeDocument, Source } from "@/lib/api";
import { useSession } from "./session";
import { waitForWebSearch } from "@/lib/web-search-client";
import type { EditorMode } from "./document-editor";

export function useKnowledgeWorkspace() {
  const { user } = useSession();
  const mounted = useRef(true);
  const webController = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      webController.current?.abort();
    };
  }, []);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [domain, setDomain] = useState("");
  const [documentFilter, setDocumentFilter] = useState("");
  const [includeOutdated, setIncludeOutdated] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [webQuery, setWebQuery] = useState("");
  const [webUrls, setWebUrls] = useState("");
  const [search, setSearch] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, setAsking] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [detail, setDetail] = useState<KnowledgeDocument | null>(null);
  const [detailVersionId, setDetailVersionId] = useState<string | undefined>();
  const [editor, setEditor] = useState<{
    mode: EditorMode;
    document?: KnowledgeDocument;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const canManage = user.permissions.includes("knowledge:write");

  const remember = useCallback(
    (values: Record<string, string>) => {
      if (!mounted.current) return;
      const hash = new URLSearchParams(location.hash.slice(1));
      hash.set("role", user.id);
      for (const [key, value] of Object.entries(values)) {
        if (value) hash.set(key, value);
        else hash.delete(key);
      }
      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}#${hash}`,
      );
    },
    [user.id],
  );
  function applyAnswer(result: Answer) {
    if (!mounted.current) return;
    setAnswer(result);
    setQuestion(result.question);
    setDomain(result.filters.domain || "");
    setDocumentFilter(result.filters.document_ids[0] || "");
    setIncludeOutdated(result.filters.include_outdated);
    setWebSearch(Boolean(result.filters.web_search));
    setWebQuery(result.filters.web_query || "");
    setWebUrls((result.filters.web_urls || []).join("\n"));
  }
  function closeDocument() {
    setDetail(null);
    remember({ document: "", version: "" });
  }

  const loadData = useCallback(
    (signal?: AbortSignal) => {
      return Promise.all([
        api<KnowledgeDocument[]>("/api/documents", user, { signal }),
        api<HistoryItem[]>("/api/ask", user, { signal }),
      ]);
    },
    [user],
  );

  async function refresh() {
    const [docs, runs] = await loadData();
    setDocuments(docs);
    setHistory(runs);
  }

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal)
      .then(async ([docs, runs]) => {
        setDocuments(docs);
        setHistory(runs);
        const hash = new URLSearchParams(location.hash.slice(1));
        if (hash.get("role") === user.id) {
          const sourceId = hash.get("source");
          if (sourceId && docs.some((doc) => doc.id === sourceId))
            setDocumentFilter(sourceId);
          if (hash.get("run")) {
            const result = await api<Answer>(
              `/api/ask/${encodeURIComponent(hash.get("run")!)}`,
              user,
              { signal: controller.signal },
            );
            applyAnswer(result);
          }
          if (hash.get("webjob")) {
            setLoading(false);
            setWebSearch(true);
            setAsking(true);
            const result = await waitForWebSearch(
              hash.get("webjob")!,
              user,
              controller.signal,
            );
            applyAnswer(result);
            remember({ run: result.id, webjob: "" });
            setAsking(false);
          }
          if (hash.get("document")) {
            const result = await api<KnowledgeDocument>(
              `/api/documents/${encodeURIComponent(hash.get("document")!)}`,
              user,
              { signal: controller.signal },
            );
            setDetail(result);
            setDetailVersionId(hash.get("version") || undefined);
          }
        }
        setLoading(false);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) {
          setError(reason.message);
          setAsking(false);
          setLoading(false);
        }
      });
    return () => controller.abort();
    // The workspace remounts for each identity; restored records are re-authorized by the API.
  }, [loadData, user, remember]);

  async function submitQuestion(
    event?: React.FormEvent<HTMLFormElement>,
    suggested?: string,
  ) {
    event?.preventDefault();
    const text = suggested || question.trim();
    if (text.length < 3 || asking) return;
    setQuestion(text);
    setAsking(true);
    setError("");
    setSource(null);
    setAnswer(null);
    let completed = false;
    try {
      const payload = {
        question: text,
        domain: domain || null,
        document_ids: documentFilter ? [documentFilter] : [],
        include_outdated: includeOutdated,
        web_search: webSearch,
        web_query: webQuery.trim() || null,
        web_urls: webUrls.split(/\s+/).filter(Boolean).slice(0, 2),
      };
      let result: Answer;
      if (webSearch) {
        const job = await api<{ id: string }>("/api/web-search/asks", user, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        remember({ webjob: job.id, run: "", document: "", version: "" });
        webController.current = new AbortController();
        result = await waitForWebSearch(
          job.id,
          user,
          webController.current.signal,
        );
      } else {
        result = await api<Answer>("/api/ask", user, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      applyAnswer(result);
      remember({ run: result.id, webjob: "", document: "", version: "" });
      completed = true;
    } catch (reason) {
      if (mounted.current && (reason as Error).name !== "AbortError")
        setError((reason as Error).message);
    } finally {
      setAsking(false);
    }
    if (completed && mounted.current) {
      void refresh().catch((reason: Error) => {
        if (mounted.current) setError(reason.message);
      });
    }
  }

  async function openQuestion(id: string) {
    if (asking) return;
    setError("");
    setSource(null);
    setAsking(true);
    setAnswer(null);
    try {
      const result = await api<Answer>(`/api/ask/${id}`, user);
      applyAnswer(result);
      remember({ run: result.id, document: "", version: "" });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setAsking(false);
    }
  }

  async function openDocument(id: string, versionId?: string) {
    setError("");
    try {
      const document = await api<KnowledgeDocument>(
        `/api/documents/${id}`,
        user,
      );
      if (!mounted.current) return;
      setDetail(document);
      setDetailVersionId(versionId);
      remember({ document: id, version: versionId || "" });
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function saved(document: KnowledgeDocument) {
    if (!mounted.current) return;
    setEditor(null);
    setDetail(document);
    setDetailVersionId(undefined);
    setSource(null);
    setNotice("Knowledge source saved successfully.");
    remember({ document: document.id, version: "" });
    try {
      await changed(document);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function changed(document: KnowledgeDocument) {
    setDetail(document);
    try {
      await refresh();
      if (answer) {
        try {
          setAnswer(await api<Answer>(`/api/ask/${answer.id}`, user));
          setSource(null);
        } catch {
          setAnswer(null);
          setSource(null);
        }
      }
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  return {
    user,
    documents,
    history,
    loading,
    setLoading,
    error,
    setError,
    question,
    setQuestion,
    domain,
    setDomain,
    documentFilter,
    setDocumentFilter,
    includeOutdated,
    setIncludeOutdated,
    webSearch,
    setWebSearch,
    webQuery,
    setWebQuery,
    webUrls,
    setWebUrls,
    search,
    setSearch,
    answer,
    asking,
    source,
    setSource,
    detail,
    setDetail,
    closeDocument,
    detailVersionId,
    editor,
    setEditor,
    notice,
    setNotice,
    canManage,
    refresh,
    submitQuestion,
    openQuestion,
    openDocument,
    saved,
    changed,
  };
}
