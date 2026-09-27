"use client";

import type { Source } from "@/lib/api";
import type { ComparisonTableProps } from "@/lib/workspace-contracts";
import { BASIS_LABELS, CHANGE_LABELS } from "@/lib/regulatory-view";
import { DataTable } from "./ui/data-table";
import { StatusBadge } from "./ui/primitives";

function Excerpt({
  source,
  onSource,
}: {
  source: Source | null;
  onSource: (source: Source) => void;
}) {
  if (!source) return <span className="muted small">Not in this version</span>;
  return (
    <>
      <p className="comparison-excerpt">{source.excerpt}</p>
      <button
        className="text-button evidence-citation"
        onClick={() => onSource(source)}
      >
        Inspect [{source.citation_id}] · v{source.version}
      </button>
    </>
  );
}

// Controlled ComparisonTable: renders backend comparison rows; no client-side diffing.
export function ComparisonTable({
  changes,
  previousLabel,
  currentLabel,
  onSource,
}: ComparisonTableProps) {
  return (
    <DataTable
      label="Regulation comparison"
      caption="Previous and current requirement text, detected change and mapped procedures"
    >
      <thead>
        <tr>
          <th>Section</th>
          <th>{previousLabel}</th>
          <th>{currentLabel}</th>
          <th>What changed</th>
        </tr>
      </thead>
      <tbody className="comparison-rows">
        {changes.map((change) => (
          <tr key={change.key}>
            <td>
              <strong className="comparison-section">{change.section}</strong>
              <small className="cell-detail">
                {CHANGE_LABELS[change.change_type]}
              </small>
            </td>
            <td>
              <Excerpt source={change.previous} onSource={onSource} />
            </td>
            <td>
              <Excerpt source={change.current} onSource={onSource} />
            </td>
            <td>
              <StatusBadge
                status={change.material ? "Material change" : "Not material"}
              />
              <p className="comparison-summary">{change.summary}</p>
              {change.new_obligations.length > 0 && (
                <ul className="comparison-list" aria-label="New obligations">
                  {change.new_obligations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {change.impacts.length > 0 && (
                <ul
                  className="comparison-list impacts"
                  aria-label={`Procedures and controls mapped to ${change.section}`}
                >
                  {change.impacts.map((impact) => (
                    <li key={impact.source.chunk_id}>
                      <button
                        className="text-button"
                        onClick={() => onSource(impact.source)}
                      >
                        {impact.source.title} · {impact.source.section_path}
                      </button>
                      <span>
                        {BASIS_LABELS[impact.basis]} ·{" "}
                        {impact.aligned ? "Aligned" : "Gap proposed"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {change.material && change.impacts.length === 0 && (
                <small className="cell-detail">
                  No accessible procedure or control is mapped to this change.
                </small>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
