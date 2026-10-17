import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

loadEnvConfig(resolve(process.cwd(), "../.."));

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  experimental: { proxyClientMaxBodySize: "12mb", proxyTimeout: 600_000 },
  distDir: process.env.SUPERFLOW_E2E ? ".next-e2e" : ".next",
  env: { COPILOTKIT_TELEMETRY_DISABLED: "true" },
  async rewrites() {
    const backend = (
      process.env.SUPERFLOW_API_URL || "http://127.0.0.1:8000"
    ).replace(/\/$/, "");
    return [
      { source: "/api/backend/:path*", destination: `${backend}/:path*` },
    ];
  },
};
export default config;
