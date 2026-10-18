"use client";
import { ChevronRight, FileText } from "lucide-react";
import { KnowledgeDocument, dateLabel } from "@/lib/api";
import { displayVersion } from "@/lib/knowledge-view";
import { EmptyState, LoadingState, StatusBadge } from "./ui/primitives";
import { DataTable } from "./ui/data-table";

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
        description="Try another search or ask a knowledge owner for help."
      />
    );
  return (
    <DataTable
      label="Knowledge Library"
      caption="Sources available to your role"
      compact={compact}
    >
      <thead>
        <tr>
          <th scope="col">Document</th>
          {!compact && <th scope="col">Category</th>}
          <th scope="col">Current version</th>
          {!compact && <th scope="col">Last updated</th>}
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
                  <span className="document-icon" aria-hidden="true">
                    <FileText size={16} />
                  </span>
                  <span>
                    {document.title}
                    {compact && <small>{document.domain}</small>}
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
                <td>{version ? dateLabel(version.created_at) : "—"}</td>
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
    </DataTable>
  );
}
