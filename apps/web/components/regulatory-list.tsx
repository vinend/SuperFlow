import Link from "next/link";
import { dateLabel } from "@/lib/api";
import type { RegulatoryReviewSummary } from "@/lib/regulatory-contracts";
import { PHASE_LABELS, phaseNextAction } from "@/lib/regulatory-view";
import { DataTable } from "./ui/data-table";
import { EmptyState, SectionHeader, StatusBadge } from "./ui/primitives";

export function RegulatoryList({
  reviews,
}: {
  reviews: RegulatoryReviewSummary[];
}) {
  return (
    <section className="regulatory-list" aria-label="Regulatory reviews">
      <SectionHeader
        title="Reviews"
        detail="Regulation changes, gap decisions and remediation progress."
      />
      {reviews.length === 0 ? (
        <EmptyState
          title="No regulatory reviews yet."
          description="Started reviews and their remediation progress appear here."
        />
      ) : (
        <DataTable
          label="Regulatory reviews"
          caption="Regulatory reviews you can access"
        >
          <thead>
            <tr>
              <th>Review</th>
              <th>Status / next action</th>
              <th>Gaps</th>
              <th>Remediation</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => {
              const href = `/regulatory?review=${encodeURIComponent(review.id)}`;
              return (
                <tr key={review.id}>
                  <td>
                    <Link href={href} className="document-name">
                      {review.document_title}
                    </Link>
                    <small className="cell-detail">
                      v{review.previous.version} → v{review.current.version} ·{" "}
                      {review.material_count} material change
                      {review.material_count === 1 ? "" : "s"}
                    </small>
                  </td>
                  <td>
                    <StatusBadge status={PHASE_LABELS[review.phase]} />
                    <Link className="cell-detail text-link" href={href}>
                      {phaseNextAction(review)}
                    </Link>
                  </td>
                  <td>
                    {review.confirmed_count} confirmed of {review.finding_count}
                  </td>
                  <td>
                    {review.remediation_completed} of {review.remediation_total}{" "}
                    approved
                  </td>
                  <td>{dateLabel(review.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </section>
  );
}
