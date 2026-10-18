import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");
if (existsSync(".runtime/playwright"))
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".runtime/playwright");
const database =
  process.env.TEST_DATABASE_URL ||
  "postgresql+psycopg://superflow:superflow_demo@127.0.0.1:5432/superflow_test";
if (!new URL(database).pathname.endsWith("_test"))
  throw new Error("Auth E2E requires a *_test database.");
export default defineConfig({
  testDir: "./tests",
  testMatch: "staging-auth.spec.ts",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node scripts/python.mjs -m uvicorn superflow.main:app --host 127.0.0.1 --port 8002",
      url: "http://127.0.0.1:8002/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        DATABASE_URL: database,
        AUTH_MODE: "password",
        APP_ENVIRONMENT: "local",
        PUBLIC_APP_URL: "http://127.0.0.1:3002",
        INVESTIGATION_PROVIDER: "browser",
        RETRIEVAL_PROVIDER: "keyword",
        RETRIEVAL_ENGINE: "native",
        LLM_PROVIDER: "deterministic",
      },
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev apps/web --webpack --hostname 127.0.0.1 --port 3002",
      url: "http://127.0.0.1:3002",
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        NEXT_PUBLIC_API_URL: "/api/backend",
        SUPERFLOW_API_URL: "http://127.0.0.1:8002",
        SUPERFLOW_E2E: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
