import { AlertCircle, FileSearch } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 id="page-title">{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionHeader({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const known = ["active", "outdated", "draft"].includes(status)
    ? status
    : "neutral";
  return <span className={`pill ${known}`}>{status}</span>;
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <FileSearch size={24} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function LoadingState({
  label = "Loading permitted documents…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
      <div className="skeleton-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error-message">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Metadata({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="source-metadata">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
