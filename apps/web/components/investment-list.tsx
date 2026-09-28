import Link from "next/link";
import { dateLabel } from "@/lib/api";
import type { InvestmentSummary } from "@/lib/investment-contracts";
import {
  formatIdr,
  PHASE_LABELS,
  phaseNextAction,
} from "@/lib/investment-view";
import { DataTable } from "./ui/data-table";
import { EmptyState, SectionHeader, StatusBadge } from "./ui/primitives";

export function InvestmentList({
  analyses,
}: {
  analyses: InvestmentSummary[];
}) {
  return (
    <section className="regulatory-list" aria-label="Investment analyses">
      <SectionHeader
        title="Analyses"
        detail="Proposals in preparation, waiting for approval, and decided."
      />
      {analyses.length === 0 ? (
        <EmptyState
          title="No investment analyses yet."
          description="Prepared analyses and their approval status appear here."
        />
      ) : (
        <DataTable
          label="Investment analyses"
          caption="Analyses you can access"
        >
          <thead>
            <tr>
              <th>Proposal</th>
              <th>Status / next action</th>
              <th>NPV</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((item) => {
              const href = `/investment?analysis=${encodeURIComponent(item.id)}`;
              return (
                <tr key={item.id}>
                  <td>
                    <Link href={href} className="document-name">
                      {item.proposal_title}
                    </Link>
                    <small className="cell-detail">
                      v{item.proposal_version}
                    </small>
                  </td>
                  <td>
                    <StatusBadge status={PHASE_LABELS[item.phase]} />
                    <Link className="cell-detail text-link" href={href}>
                      {phaseNextAction(item)}
                    </Link>
                  </td>
                  <td>{item.npv === null ? "—" : formatIdr(item.npv)}</td>
                  <td>{dateLabel(item.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </section>
  );
}
