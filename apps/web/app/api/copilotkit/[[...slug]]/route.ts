import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { SuperFlowWorkspaceAgent } from "@/lib/workspace-agent";

export const runtime = "nodejs";

const DEMO_USERS = new Set([
  "employee",
  "manager",
  "sme",
  "compliance",
  "compliance_checker",
  "finance",
  "governance",
]);

// Separate ephemeral AG-UI threads by demo identity. Business state stays in PostgreSQL.
const handlers = new Map<
  string,
  ReturnType<typeof createCopilotRuntimeHandler>
>();

function handlerFor(userId: string) {
  let handler = handlers.get(userId);
  if (!handler) {
    handler = createCopilotRuntimeHandler({
      runtime: new CopilotRuntime({
        agents: { workspace: new SuperFlowWorkspaceAgent(userId) },
        runner: new InMemoryAgentRunner(),
      }),
      basePath: "/api/copilotkit",
    });
    handlers.set(userId, handler);
  }
  return handler;
}

function handle(request: NextRequest) {
  const userId = request.headers.get("X-User-Id") || "";
  if (!DEMO_USERS.has(userId))
    return Response.json({ error: "Unknown demo identity." }, { status: 401 });
  return handlerFor(userId)(request);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
