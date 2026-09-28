import type { FinancialAnalysisProps } from "@/lib/workspace-contracts";
import { formatIdr, metricValue, stepLabel } from "@/lib/investment-view";
import { DataTable } from "./ui/data-table";

// Controlled FinancialAnalysis: renders backend results only; no client-side arithmetic.
export function FinancialAnalysis({ calculation }: FinancialAnalysisProps) {
  return (
    <div className="financial-analysis">
      <dl className="metric-tiles" aria-label="Deterministic results">
        {calculation.metrics.map((metric) => (
          <div key={metric.key}>
            <dt>{metric.label}</dt>
            <dd>
              <strong>{metricValue(metric)}</strong>
              <small>{metric.period}</small>
              <details>
                <summary>How it is calculated</summary>
                <p>
                  <code>{metric.formula}</code>
                </p>
                <p>{metric.note}</p>
              </details>
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="financial-subheading">Cash flows</h3>
      <DataTable
        label="Cash flows"
        caption="Annual cash flows used by every formula"
        compact
      >
        <thead>
          <tr>
            {calculation.cash_flows.map((_, year) => (
              <th key={year}>Year {year}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {calculation.cash_flows.map((flow, year) => (
              <td key={year}>{formatIdr(flow)}</td>
            ))}
          </tr>
        </tbody>
      </DataTable>
      <h3 className="financial-subheading">Sensitivity — NPV</h3>
      <p className="muted small">
        Each row changes one input by the stated amount; the others stay at
        base.
      </p>
      <DataTable
        label="Sensitivity"
        caption="Net present value when one input changes"
        compact
      >
        <thead>
          <tr>
            <th>Input changed</th>
            {calculation.steps.map((step) => (
              <th key={step}>{stepLabel(step)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calculation.sensitivity.map((row) => (
            <tr key={row.variable}>
              <th scope="row">{row.label}</th>
              {row.npv.map((value, index) => (
                <td
                  key={index}
                  className={value < 0 ? "negative-value" : undefined}
                >
                  {formatIdr(value)}
                  {value < 0 && <span className="sr-only"> (negative)</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
