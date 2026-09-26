"use client";

import { ChevronRight, FileText } from "lucide-react";
import { KnowledgeDocument, dateLabel } from "@/lib/api";
import { displayVersion, fileType } from "@/lib/knowledge-view";
import { EmptyState, LoadingState, StatusBadge } from "./ui/primitives";

// Semantic table + local scroll container informed by shadcn Table on 21st.dev.
export function DocumentTable({
  documents,
  open,
  loading,
  compact = false,
}: {
  documents: KnowledgeDocument[];
  open: (id: string) => void;
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) return <LoadingState />;
  if (!documents.length)
    return (
      <EmptyState
        title="No matching sources"
        description="Try another filter or ask a knowledge owner to add a document."
      />
    );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Document repository table"
    >
      <table className={`document-table ${compact ? "compact" : ""}`}>
        <caption className="sr-only">
          Sources available to your selected role
        </caption>
        <thead>
          <tr>
            <th scope="col">Document</th>
            {!compact && <th scope="col">Domain</th>}
            <th scope="col">Version / state</th>
            {!compact && (
              <>
                <th scope="col">Owner / authority</th>
                <th scope="col">Effective date</th>
                <th scope="col">Access</th>
              </>
            )}
            <th scope="col">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => {
            const version = displayVersion(document);
            return (
              <tr key={document.id}>
                <td>
                  <button
                    className="document-title"
                    onClick={() => open(document.id)}
                  >
                    <span className="document-icon">
                      <FileText size={18} />
                    </span>
                    <span>
                      {document.title}
                      <small>
                        {compact
                          ? document.domain
                          : `${fileType(version?.filename)} · ${document.versions.length} versions · ${version?.chunk_count || 0} sections`}
                      </small>
                    </span>
                  </button>
                </td>
                {!compact && (
                  <td>
                    <span className="domain-label">{document.domain}</span>
                  </td>
                )}
                <td>
                  <div className="version-cell">
                    <span>{version ? `v${version.version}` : "—"}</span>
                    <StatusBadge status={version?.status || "No version"} />
                  </div>
                </td>
                {!compact && (
                  <>
                    <td className="owner-cell">
                      {document.owner_name}
                      <small>Authority {document.authority_level} / 5</small>
                    </td>
                    <td>{version ? dateLabel(version.effective_date) : "—"}</td>
                    <td className="access-cell">
                      <details>
                        <summary>{document.access_roles.length} roles</summary>
                        <small>{document.access_roles.join(", ")}</small>
                      </details>
                    </td>
                  </>
                )}
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Inspect ${document.title}`}
                    onClick={() => open(document.id)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
