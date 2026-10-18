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

async function handle(request: NextRequest) {
  const backend = process.env.SUPERFLOW_API_URL || "http://127.0.0.1:8000";
  const config = await fetch(`${backend}/api/auth/config`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => response.json())
    .catch(() => null);
  if (!config)
    return Response.json(
      { error: "Authentication unavailable." },
      { status: 503 },
    );
  if (config.mode === "password") {
    const authHeaders = {
      Cookie: request.headers.get("cookie") || "",
      Origin: request.headers.get("origin") || "",
    };
    const response = await fetch(`${backend}/api/auth/me`, {
      headers: authHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!response?.ok)
      return Response.json({ error: "Sign in to SuperFlow." }, { status: 401 });
    const user = await response.json();
    // Never retain session cookies in the process-wide demo handler cache.
    const handler = createCopilotRuntimeHandler({
      runtime: new CopilotRuntime({
        agents: {
          workspace: new SuperFlowWorkspaceAgent(user.id, authHeaders),
        },
        runner: new InMemoryAgentRunner(),
      }),
      basePath: "/api/copilotkit",
    });
    return handler(request);
  }
  const userId = request.headers.get("X-User-Id") || "";
  if (!DEMO_USERS.has(userId))
    return Response.json({ error: "Unknown demo identity." }, { status: 401 });
  return handlerFor(userId)(request);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
