import type { Answer } from "./api";
import type { WorkspaceResolution } from "./workspace-catalog";

export type ChatEvent = { stage: string; message: string; at: string };
export type ChatSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};
export type ChatTurn = {
  id: string;
  question: string;
  status: "queued" | "running" | "complete" | "failed";
  resolution: WorkspaceResolution | null;
  answer: Answer | null;
  events: ChatEvent[];
  error: string | null;
  created_at: string;
  scope: {
    domain: string | null;
    document_ids: string[] | null;
    include_outdated: boolean | null;
    web_search: boolean | null;
    web_query?: string | null;
    web_urls?: string[] | null;
  };
};
export type Chat = ChatSummary & { turns: ChatTurn[] };
export function isPending(turn: ChatTurn) {
  return turn.status === "queued" || turn.status === "running";
}
