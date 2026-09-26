import { existsSync } from "node:fs";
import { resolve, delimiter } from "node:path";
import { spawn } from "node:child_process";

if (existsSync(".env")) process.loadEnvFile(".env");

const localPython = resolve(".runtime/python/python.exe");
const python =
  process.env.PYTHON || (existsSync(localPython) ? localPython : "python");
const child = spawn(python, process.argv.slice(2), {
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONPATH: [resolve("apps/api"), process.env.PYTHONPATH]
      .filter(Boolean)
      .join(delimiter),
    PYTHONUTF8: "1",
  },
});
child.on("error", (error) => {
  console.error(
    `Python could not start: ${error.message}. Set PYTHON to a usable interpreter.`,
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
