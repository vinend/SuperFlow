import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");
if (
  !process.env.PLAYWRIGHT_BROWSERS_PATH &&
  existsSync(".runtime/playwright")
) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".runtime/playwright");
}

const database =
  process.env.TEST_DATABASE_URL ||
  "postgresql+psycopg://superflow:superflow_demo@127.0.0.1:5432/superflow_test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node scripts/python.mjs -m uvicorn superflow.main:app --host 127.0.0.1 --port 8001",
      url: "http://127.0.0.1:8001/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        DATABASE_URL: database,
        CORS_ORIGINS: "http://127.0.0.1:3001",
        RETRIEVAL_PROVIDER: "keyword",
        RETRIEVAL_ENGINE: "native",
        LLM_PROVIDER: "deterministic",
      },
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1 --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        NEXT_PUBLIC_API_URL: "/api/backend",
        SUPERFLOW_API_URL: "http://127.0.0.1:8001",
        SUPERFLOW_E2E: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
