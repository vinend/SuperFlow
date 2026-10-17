"use client";

import { ChevronRight } from "lucide-react";
import { HistoryItem, dateLabel } from "@/lib/api";
import { LoadingState } from "./ui/primitives";

export function QuestionHistory({
  items,
  open,
  selectedId,
  loading,
  disabled,
  limit = 20,
}: {
  items: HistoryItem[];
  open: (id: string) => void;
  selectedId?: string;
  loading: boolean;
  disabled: boolean;
  limit?: number;
}) {
  if (loading) return <LoadingState label="Loading saved questions…" />;
  if (!items.length)
    return (
      <p className="history-empty">
        No saved questions yet. Your questions will appear here after you ask.
      </p>
    );
  return (
    <div className="history-list">
      {items.slice(0, limit).map((item) => (
        <button
          key={item.id}
          disabled={disabled}
          onClick={() => open(item.id)}
          className={selectedId === item.id ? "history-selected" : ""}
        >
          <span>
            {item.question}
            <small>
              {dateLabel(item.created_at)} ·{" "}
              {item.outcome === "source_grounded"
                ? item.provider?.startsWith("ollama-")
                  ? "Cited AI answer"
                  : "Source extracts"
                : "No sources found"}
            </small>
          </span>
          <ChevronRight size={14} />
        </button>
      ))}
    </div>
  );
}
