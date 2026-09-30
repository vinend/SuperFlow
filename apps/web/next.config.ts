import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

loadEnvConfig(resolve(process.cwd(), "../.."));

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  distDir: process.env.SUPERFLOW_E2E ? ".next-e2e" : ".next",
  env: { COPILOTKIT_TELEMETRY_DISABLED: "true" },
};
export default config;
