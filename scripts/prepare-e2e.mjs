import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const database =
  process.env.TEST_DATABASE_URL ||
  "postgresql+psycopg://superflow:superflow_demo@127.0.0.1:5432/superflow_test";
if (!new URL(database).pathname.endsWith("_test"))
  throw new Error("E2E database must end with _test.");
for (const args of [
  ["-m", "alembic", "-c", "apps/api/alembic.ini", "upgrade", "head"],
  [
    "-m",
    "superflow.seed",
    "--reset",
    "--confirm-synthetic-data",
    ...(process.argv.includes("--presentation") ? ["--presentation"] : []),
  ],
]) {
  const result = spawnSync(process.execPath, ["scripts/python.mjs", ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: database,
      APP_ENVIRONMENT: "local",
      AUTH_MODE: "local",
      INVESTIGATION_PROVIDER: "synthetic",
      RETRIEVAL_PROVIDER: "keyword",
    },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
