"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type User } from "@/lib/api";
import {
  isPending,
  type Chat,
  type ChatSummary,
  type ChatTurn,
} from "@/lib/chat";

export function useChatSessions(user: User) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const currentRequest = useRef<AbortController | null>(null);
  const live = useRef(true);

  const remember = useCallback(
    (id: string) => {
      const hash = new URLSearchParams(location.hash.slice(1));
      hash.set("role", user.id);
      if (id) hash.set("chat", id);
      else hash.delete("chat");
      hash.delete("run");
      hash.delete("webjob");
      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}#${hash}`,
      );
    },
    [user.id],
  );

  useEffect(() => {
    live.current = true;
    const controller = new AbortController();
    currentRequest.current = controller;
    const hash = new URLSearchParams(location.hash.slice(1));
    const id = hash.get("role") === user.id ? hash.get("chat") : null;
    Promise.all([
      api<ChatSummary[]>("/api/chats", user, { signal: controller.signal }),
      id
        ? api<Chat>(`/api/chats/${encodeURIComponent(id)}`, user, {
            signal: controller.signal,
          })
        : Promise.resolve(null),
    ])
      .then(([items, saved]) => {
        if (controller.signal.aborted) return;
        setChats(items);
        setHasMore(items.length === 100);
        setChat(saved);
        setLoading(false);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => {
      live.current = false;
      controller.abort();
      currentRequest.current?.abort();
    };
  }, [user]);

  const pending = chat?.turns.find(isPending);
  const pendingId = pending?.id;
  const chatId = chat?.id;
  useEffect(() => {
    if (!pendingId || !chatId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const turn = await api<ChatTurn>(
          `/api/chats/${chatId}/turns/${pendingId}`,
          user,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setError("");
        setChat((current) =>
          current && current.id === chatId
            ? {
                ...current,
                turns: current.turns.map((item) =>
                  item.id === turn.id ? turn : item,
                ),
              }
            : current,
        );
        if (isPending(turn)) timer = setTimeout(poll, 1500);
        else {
          const items = await api<ChatSummary[]>("/api/chats", user, {
            signal: controller.signal,
          });
          if (!controller.signal.aborted) {
            setChats(items);
            setHasMore(items.length === 100);
          }
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            `${(reason as Error).message} Reconnecting to your saved reply…`,
          );
          timer = setTimeout(poll, 5000);
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [chatId, pendingId, user]);

  async function openChat(id: string) {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setLoading(true);
    setError("");
    setChat(null);
    setDraft("");
    try {
      const result = await api<Chat>(
        `/api/chats/${encodeURIComponent(id)}`,
        user,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        setChat(result);
        remember(result.id);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError((reason as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function newChat() {
    currentRequest.current?.abort();
    setChat(null);
    setDraft("");
    setError("");
    setLoading(false);
    remember("");
  }

  async function importAnswer(id: string) {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const result = await api<Chat>(
        `/api/chats/from-answer/${encodeURIComponent(id)}`,
        user,
        { method: "POST" },
      );
      if (!live.current) return;
      setChat(result);
      setDraft("");
      remember(result.id);
      setChats((items) => [
        result,
        ...items.filter((item) => item.id !== result.id),
      ]);
    } catch (reason) {
      if (live.current) setError((reason as Error).message);
    } finally {
      if (live.current) setSending(false);
    }
  }

  async function send(question: string, scope: Record<string, unknown>) {
    if (sending || pending || question.trim().length < 3) return;
    setSending(true);
    setError("");
    try {
      let active = chat;
      if (!active) {
        active = await api<Chat>("/api/chats", user, { method: "POST" });
        if (!live.current) return;
        setChat(active);
        remember(active.id);
      }
      await api(`/api/chats/${active.id}/turns`, user, {
        method: "POST",
        body: JSON.stringify({ question: question.trim(), ...scope }),
      });
      if (!live.current) return;
      setDraft("");
      const result = await api<Chat>(`/api/chats/${active.id}`, user);
      if (!live.current) return;
      setChat(result);
      setChats((items) => [
        result,
        ...items.filter((item) => item.id !== result.id),
      ]);
    } catch (reason) {
      if (live.current) setError((reason as Error).message);
    } finally {
      if (live.current) setSending(false);
    }
  }

  async function rename(title: string) {
    if (!chat || !title.trim()) return;
    try {
      const result = await api<ChatSummary>(`/api/chats/${chat.id}`, user, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      if (!live.current) return;
      setChat((current) =>
        current?.id === result.id ? { ...current, ...result } : current,
      );
      setChats((items) =>
        items.map((item) => (item.id === result.id ? result : item)),
      );
    } catch (reason) {
      if (live.current) setError((reason as Error).message);
    }
  }

  async function loadOlder() {
    const oldest = chats.at(-1);
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const items = await api<ChatSummary[]>(
        `/api/chats?before=${encodeURIComponent(oldest.id)}`,
        user,
      );
      if (!live.current) return;
      setChats((current) => [
        ...current,
        ...items.filter(
          (item) => !current.some((existing) => existing.id === item.id),
        ),
      ]);
      setHasMore(items.length === 100);
    } catch (reason) {
      if (live.current) setError((reason as Error).message);
    } finally {
      if (live.current) setLoadingOlder(false);
    }
  }

  return {
    chats,
    chat,
    draft,
    setDraft,
    loading,
    sending,
    error,
    pending,
    openChat,
    newChat,
    importAnswer,
    send,
    rename,
    hasMore,
    loadingOlder,
    loadOlder,
  };
}
