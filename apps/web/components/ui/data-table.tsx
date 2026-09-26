import type { ReactNode } from "react";

// Adapted from Origin UI Table (21st.dev demo 98); styled with SuperFlow tokens.
// Filtering, sorting, and permissions remain with the existing workspace/API.
export function DataTable({
  children,
  caption,
  label,
  compact = false,
}: {
  children: ReactNode;
  caption: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className={`document-table ${compact ? "compact" : ""}`}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
