export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type User = {
  id: string;
  name: string;
  role_id: string;
  role_name: string;
  department: string;
  permissions: string[];
};
export type Chunk = { id: string; section_path: string; text: string };
export type Version = {
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
  created_at: string;
  versions: Version[];
};
export type Source = {
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
};
export type Answer = {
  id: string;
  question: string;
  answer: string;
  outcome: "source_grounded" | "no_sources";
  sources: Source[];
  provider: string;
  notice: string;
  filters: {
    domain: string | null;
    document_ids: string[];
    include_outdated: boolean;
  };
  created_at: string;
};
export type HistoryItem = Pick<
  Answer,
  "id" | "question" | "outcome" | "created_at"
>;
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
  } catch {
    throw new Error(
      "Cannot reach the knowledge API. Check that the API and PostgreSQL are running.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed (${response.status}). Check the form fields and retry.`,
    );
  }
  return response.json() as Promise<T>;
}

export function dateLabel(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
