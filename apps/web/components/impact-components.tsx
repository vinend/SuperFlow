import Link from "next/link";
import { ArrowRight, Info, Sparkles } from "lucide-react";
import type {
  CapacitySimulationData,
  DistributionData,
  ImpactBriefData,
  MetricGroupData,
  NextActionsData,
} from "@/lib/analytics-contracts";
import { formatImpactMetric } from "@/lib/analytics-view";

export function ImpactBrief({ data }: { data: ImpactBriefData }) {
  return (
    <section className="impact-brief">
      <div className="impact-brief-copy">
        <span className="eyebrow">
          <Sparkles size={14} aria-hidden="true" /> {data.eyebrow}
        </span>
        <h2>{data.title}</h2>
        <p>{data.summary}</p>
      </div>
      <ul aria-label="Impact highlights">
        {data.highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function MetricGroup({ data }: { data: MetricGroupData }) {
  return (
    <section className={`impact-section impact-${data.category}`}>
      <div className="section-header">
        <div>
          <span className="impact-category">{data.category}</span>
          <h2>{data.title}</h2>
          <p>{data.description}</p>
        </div>
      </div>
      <dl className="impact-metrics">
        {data.metrics.map((metric) => (
          <div key={metric.key}>
            <dt>{metric.label}</dt>
            <dd>{formatImpactMetric(metric)}</dd>
            <p>{metric.detail}</p>
            <details>
              <summary>How this is measured</summary>
              <span>{metric.method}</span>
              {metric.denominator !== null &&
              metric.denominator !== undefined ? (
                <small>
                  {metric.numerator ?? 0} of {metric.denominator} records
                </small>
              ) : null}
            </details>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function DistributionChart({ data }: { data: DistributionData }) {
  return (
    <section className="impact-section impact-distribution">
      <div className="section-header">
        <div>
          <h2>{data.title}</h2>
          <p>{data.description}</p>
        </div>
      </div>
      {data.items.length ? (
        <ul>
          {data.items.map((item) => (
            <li key={item.key}>
              <div>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
              <span className="impact-bar" aria-hidden="true">
                <i
                  className={item.tone}
                  style={{ width: `${item.percent}%` }}
                />
              </span>
              <small>{item.percent}%</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="attention-empty">
          No recorded activity in this permitted scope.
        </p>
      )}
    </section>
  );
}

export function CapacitySimulation({ data }: { data: CapacitySimulationData }) {
  return (
    <section className="impact-section capacity-simulation">
      <div className="simulation-disclosure">
        <Info size={16} aria-hidden="true" />
        <strong>{data.disclosure}</strong>
        <span>{data.description}</span>
      </div>
      <h2>{data.title}</h2>
      <dl className="impact-metrics compact">
        {data.metrics.map((metric) => (
          <div key={metric.key}>
            <dt>{metric.label}</dt>
            <dd>{formatImpactMetric(metric)}</dd>
            <p>{metric.detail}</p>
          </div>
        ))}
      </dl>
      <details className="simulation-assumptions">
        <summary>Assumptions used</summary>
        <ul>
          {data.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function NextActions({ data }: { data: NextActionsData }) {
  return (
    <section className="impact-section impact-actions">
      <h2>{data.title}</h2>
      <ul>
        {data.actions.map((action) => (
          <li key={`${action.href}:${action.label}`}>
            <Link href={action.href}>
              <span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
