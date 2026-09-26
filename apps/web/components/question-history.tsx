"use client";

import { ChevronRight, MessageSquare } from "lucide-react";
import { HistoryItem, dateLabel } from "@/lib/api";
import { EmptyState, LoadingState } from "./ui/primitives";

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
      <EmptyState
        title="No saved questions yet"
        description="Ask a question to start your personal knowledge history."
      />
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
          <MessageSquare size={15} />
          <span>
            {item.question}
            <small>
              {dateLabel(item.created_at)} ·{" "}
              {item.outcome === "source_grounded"
                ? "Source extracts"
                : "No sources found"}
            </small>
          </span>
          <ChevronRight size={14} />
        </button>
      ))}
    </div>
  );
}
