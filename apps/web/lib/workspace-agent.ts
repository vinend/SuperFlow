import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { Observable } from "rxjs";
import { WorkspaceResolutionSchema } from "./workspace-catalog";

const API_URL =
  process.env.SUPERFLOW_API_URL ||
  (process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_API_URL
    : undefined) ||
  "http://127.0.0.1:8000";

export class SuperFlowWorkspaceAgent extends AbstractAgent {
  constructor(
    private readonly userId: string,
    private readonly authHeaders: Record<string, string> = {},
  ) {
    super({
      agentId: "workspace",
      description: "Routes requests to approved SuperFlow workspaces.",
    });
  }

  override clone() {
    return new SuperFlowWorkspaceAgent(this.userId, this.authHeaders);
  }

  override run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const controller = new AbortController();
      const execute = async () => {
        const last = [...input.messages]
          .reverse()
          .find((item) => item.role === "user");
        const prompt =
          typeof last?.content === "string" ? last.content.trim() : "";
        const runId = input.runId;
        const messageId = crypto.randomUUID();
        subscriber.next({
          type: EventType.RUN_STARTED,
          threadId: input.threadId,
          runId,
        });
        try {
          if (prompt.length < 3 || prompt.length > 2000)
            throw new Error("Enter a request between 3 and 2000 characters.");
          const response = await fetch(`${API_URL}/api/workspace-intent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": this.userId,
              ...this.authHeaders,
            },
            body: JSON.stringify({ prompt }),
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error("Workspace routing is temporarily unavailable.");
          const resolution = WorkspaceResolutionSchema.parse(
            await response.json(),
          );
          subscriber.next({
            type: EventType.STATE_SNAPSHOT,
            snapshot: { resolution },
          });
          subscriber.next({
            type: EventType.TEXT_MESSAGE_START,
            messageId,
            role: "assistant",
          });
          subscriber.next({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: resolution.message,
          });
          subscriber.next({ type: EventType.TEXT_MESSAGE_END, messageId });
          subscriber.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId,
          });
          subscriber.complete();
        } catch {
          if (controller.signal.aborted) return;
          // No backend error body or model output is echoed to the browser.
          subscriber.error(
            new Error(
              "Workspace routing is temporarily unavailable. Direct navigation and Knowledge Ask remain available.",
            ),
          );
        }
      };
      void execute();
      return () => controller.abort();
    });
  }
}
