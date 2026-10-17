export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

import type { GuardResult } from "./reliability-contracts";
import { isGuardResult } from "./reliability-view";

export type User = {
  id: string;
  name: string;
  role_id: string;
  role_name: string;
  department: string;
  permissions: string[];
};
export type Chunk = {
  id: string;
  section_path: string;
  text: string;
  extraction_method?:
    "native" | "pdf_text" | "ocr" | "mixed" | "web_capture" | "vision";
  page_number?: number | null;
  ocr_confidence?: number | null;
};
export type Version = {
  source_provenance?: {
    jurisdiction?: string;
    usage_scope?: string;
    vision_model?: string | null;
    capture_engine?: "puppeteer" | null;
    source_url: string;
    publisher: string;
    retrieved_at: string;
    kind: string;
    legal_status: string;
    landing_url?: string | null;
  } | null;
  id: string;
  version: string;
  status: "active" | "outdated" | "draft";
  effective_date: string;
  filename: string;
  checksum: string;
  media_type: string;
  chunk_count: number;
  created_at: string;
  chunks?: Chunk[];
};
export type KnowledgeDocument = {
  id: string;
  title: string;
  domain: string;
  owner_id: string;
  owner_name: string;
  authority_level: number;
  access_roles: string[];
  related_document_ids: string[];
  context_run_id?: string | null;
  created_at: string;
  versions: Version[];
};
export type Source = {
  publisher?: string | null;
  jurisdiction?: string | null;
  usage_scope?: string | null;
  source_origin?: "knowledge_base" | "internet";
  media_type?: string | null;
  capture_engine?: "puppeteer" | null;
  vision_model?: string | null;
  source_url?: string | null;
  legal_status?: string | null;
  citation_id: number;
  document_id: string;
  version_id: string;
  chunk_id: string;
  title: string;
  domain: string;
  version: string;
  status: string;
  effective_date: string;
  owner: string;
  authority_level: number;
  section_path: string;
  excerpt: string;
  score: number;
  extraction_method?:
    "native" | "pdf_text" | "ocr" | "mixed" | "web_capture" | "vision";
  page_number?: number | null;
  ocr_confidence?: number | null;
};
export type Answer = {
  web_search?: {
    status: "complete" | "partial" | "blocked" | "unavailable";
    query: string;
    search_url: string;
    sources_read: number;
    search_capture_id?: string | null;
    message: string;
    discovery?: string;
    failures: { url: string; message: string }[];
    google_vision_observations?: {
      visual_description: string;
      visible_text: string;
      limitations: string;
    }[];
  } | null;
  id: string;
  question: string;
  answer: string;
  outcome: "source_grounded" | "no_sources";
  sources: Source[];
  provider: string;
  notice: string;
  reliability: GuardResult;
  filters: {
    domain: string | null;
    document_ids: string[];
    include_outdated: boolean;
    web_search?: boolean;
    web_query?: string | null;
    web_urls?: string[];
  };
  created_at: string;
};
export type HistoryItem = Pick<
  Answer,
  "id" | "question" | "outcome" | "created_at"
> & { provider?: string };
export const DOMAINS = [
  "People",
  "Compliance",
  "Finance",
  "Operations",
  "Governance",
];
export const ROLES = [
  "employee",
  "manager",
  "sme",
  "compliance",
  "finance",
  "governance",
];

export async function api<T>(
  path: string,
  user?: User,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (user) headers.set("X-User-Id", user.id);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error(
      "Cannot reach the knowledge API. Check that the API and PostgreSQL are running.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string"
        ? /^\/api\/(cases|workflow|tasks|approvals|regulatory|investment|impact)/.test(
            path,
          )
          ? detail
              .replace(/\bCases\b/g, "Requests")
              .replace(/\bCase\b/g, "Request")
              .replace(/\bcase\b/g, "request")
              .replace(/\bworkflows\b/gi, "reviews")
              .replace(/\bworkflow\b/gi, "review")
              .replace(/\btask\b/gi, "action item")
              .replace(/\bGuard\b/g, "Reliability")
              .replace(/\bdemo authority\b/g, "review authority")
              .replace(
                /Idempotency key already belongs to a different request\./,
                "This action has already been submitted with different details. Refresh before retrying.",
              )
          : detail
        : `Request failed (${response.status}). Check the form fields and retry.`,
    );
  }
  const body = await response.json();
  if (
    path.startsWith("/api/ask") &&
    body &&
    typeof body === "object" &&
    "answer" in body &&
    (!isGuardResult(body.reliability) ||
      (body.reliability.status === "ACCESS_RESTRICTED" &&
        body.sources?.length > 0))
  ) {
    throw new Error(
      "Reliability result is unavailable or invalid. Ask again after checking the API version.",
    );
  }
  return body as T;
}

export function dateLabel(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
