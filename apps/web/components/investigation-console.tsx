"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { InvestigationView } from "@/lib/investigation";
import { businessStatus, activityLabel } from "@/lib/product-view";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Globe2,
  Newspaper,
  Paperclip,
  ScanLine,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { ApplicationShell } from "./application-shell";
import { useSession } from "./session";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "./ui/primitives";
import styles from "./investigation-review.module.css";

type Tab = "overview" | "transactions" | "screening" | "evidence";
type Tone = "neutral" | "good" | "review" | "high" | "info";

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}

function EvidenceRow({
  icon: Icon,
  title,
  detail,
  tone,
  status,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: Tone;
  status: string;
}) {
  return (
    <div className={styles.evidenceRow}>
      <Icon size={17} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}

export function InvestigationConsole({
  embedded = false,
  selectedId,
  initialTab = "overview",
}: {
  embedded?: boolean;
  selectedId?: string | null;
  initialTab?: "overview" | "evidence";
} = {}) {
  const { user } = useSession();
  const content =
    user.role_id === "compliance" ? (
      <InvestigationReview
        embedded={embedded}
        selectedId={selectedId}
        initialTab={initialTab}
      />
    ) : (
      <div
        className="main-content"
        id={embedded ? undefined : "workspace-main"}
        tabIndex={-1}
        aria-labelledby="page-title"
      >
        <PageHeader
          eyebrow="Compliance workspace"
          title="Investigation Review"
          description="Review transaction-monitoring alerts with controlled evidence collection and independent checker review."
        />
        <EmptyState
          title="Investigation Review is available to Compliance."
          description="Choose Compliance in the role menu to open this synthetic investigation."
        />
      </div>
    );
  return embedded ? (
    content
  ) : (
    <ApplicationShell view="investigation">{content}</ApplicationShell>
  );
}

function InvestigationReview({
  embedded,
  selectedId,
  initialTab,
}: {
  embedded: boolean;
  selectedId?: string | null;
  initialTab: "overview" | "evidence";
}) {
  const { user } = useSession();
  const params = useSearchParams();
  const selected =
    selectedId === undefined ? params.get("investigation") : selectedId;
  return (
    <InvestigationReviewState
      key={`${user.id}:${selected || "default"}`}
      selected={selected}
      embedded={embedded}
      initialTab={initialTab}
    />
  );
}

function InvestigationReviewState({
  selected,
  embedded,
  initialTab,
}: {
  selected: string | null;
  embedded: boolean;
  initialTab: "overview" | "evidence";
}) {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [items, setItems] = useState<InvestigationView[]>([]);
  const [current, setCurrent] = useState<InvestigationView | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [showAllActivity, setShowAllActivity] = useState(false);
  useEffect(() => {
    let live = true;
    api<InvestigationView[]>("/api/investigations", user)
      .then((result) => {
        if (!live) return;
        setItems(result);
        const item =
          result.find((entry) => entry.id === selected) ||
          (selected ? null : result[0]) ||
          null;
        setCurrent(item);
        setNotes(item?.analyst_notes || "");
        setRecommendation(item?.analyst_recommendation || "");
        setError("");
      })
      .catch((reason: Error) => live && setError(reason.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user, selected]);
  async function refresh() {
    if (!current) return;
    const updated = await api<InvestigationView>(
      `/api/investigations/${current.id}`,
      user,
    );
    setCurrent(updated);
    setItems((previous) =>
      previous.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
    setNotes(updated.analyst_notes);
    setRecommendation(updated.analyst_recommendation);
  }
  async function mutate(path: string, body: Record<string, unknown> = {}) {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<InvestigationView>(
        `/api/investigations/${current.id}${path}`,
        user,
        {
          method: "POST",
          body: JSON.stringify({
            expected_revision: current.revision,
            ...body,
          }),
        },
      );
      setCurrent(updated);
      setItems((previous) =>
        previous.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (reason) {
      setError((reason as Error).message);
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div
        className="main-content"
        id={embedded ? undefined : "workspace-main"}
      >
        <LoadingState label="Loading investigation…" />
      </div>
    );
  if (!current)
    return (
      <div
        className="main-content"
        id={embedded ? undefined : "workspace-main"}
      >
        <PageHeader
          eyebrow="Compliance workspace"
          title="Investigation Review"
          description="Synthetic Compliance investigation workspace."
        />
        {error ? (
          <ErrorState message={error} retry={() => window.location.reload()} />
        ) : (
          <EmptyState
            title="No investigation available"
            description="Only assigned Compliance staff can inspect these records."
          />
        )}
      </div>
    );
  const evidence = Object.fromEntries(
    current.evidence.map((item) => [item.key, item]),
  );
  const requiredComplete = current.evidence.filter(
    (item) => item.required && item.status === "available",
  ).length;
  const requiredTotal = current.evidence.filter((item) => item.required).length;
  const collectionComplete = requiredComplete === requiredTotal;
  const watchlist =
    evidence.watchlist_screening?.status === "available" ? "done" : "pending";
  const news =
    evidence.adverse_news?.status === "available" ? "done" : "pending";
  const analyst = user.id === current.owner_id && !current.submitted_at;
  const transactionRun = current.tool_runs.find(
    (run) =>
      run.tool_name === "summarize_transactions" && run.status === "completed",
  );
  const watchlistRun = current.tool_runs.find(
    (run) =>
      run.tool_name === "run_watchlist_screening" && run.status === "completed",
  );
  const newsRun = current.tool_runs.find(
    (run) =>
      run.tool_name === "search_adverse_news" && run.status === "completed",
  );
  const transactions = Array.isArray(transactionRun?.result.sample)
    ? (transactionRun.result.sample as {
        time: string;
        type: string;
        amount: number;
        context: string;
      }[])
    : [];
  const stateCopy = (state: string) =>
    state === "done"
      ? { status: "Collected", tone: "good" as Tone }
      : { status: "Pending", tone: "review" as Tone };
  const activityEvents = current.activity.filter(
    (event) => event.event_type !== "case_created",
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "screening", label: "Screening & news" },
    { id: "evidence", label: "Evidence" },
  ];

  return (
    <div
      className={`main-content ${styles.workspace}`}
      id={embedded ? undefined : "workspace-main"}
      tabIndex={-1}
      aria-labelledby="page-title"
    >
      <PageHeader
        eyebrow="Synthetic investigation alert"
        title={`Investigation Review — Alert ${current.alert_reference}`}
        description="Review collected evidence and record an analyst recommendation before independent checker review."
        action={
          <Badge tone={current.submitted_at ? "info" : "review"}>
            {current.completed_at
              ? "Completed"
              : current.submitted_at
                ? "Waiting for checker"
                : "Analyst review"}
          </Badge>
        }
      />
      {error && <ErrorState message={error} retry={refresh} />}
      <nav aria-label="Synthetic investigations" className={styles.scenarioNav}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/investigations?investigation=${encodeURIComponent(item.id)}`}
            aria-current={item.id === current.id ? "page" : undefined}
          >
            {item.alert_reference}
          </Link>
        ))}
      </nav>

      <section
        className={styles.summary}
        aria-label="Alert and customer summary"
      >
        <Fact label="Alert" value={current.alert_reference} />
        <Fact label="Customer" value={current.context.customer_name} />
        <Fact label="Subject reference" value={current.subject_reference} />
        <Fact
          label="Declared source of funds"
          value={String(
            current.tool_runs.find(
              (run) => run.tool_name === "get_customer_profile",
            )?.result.declared_source_of_funds || "Not collected",
          )}
        />
        <Fact label="Alerted value" value="IDR 487.5M · synthetic" />
        <Fact label="Transactions" value="18 in 36 hours" />
        <Fact label="New beneficiaries" value="7 counterparties" />
        <Fact label="Profile baseline" value="IDR 18–35M / month" />
      </section>

      <div className={styles.layout}>
        <div className={styles.primaryColumn}>
          <section className={styles.panel} aria-label="Investigation analysis">
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Investigation sections"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`investigation-${tab.id}`}
                  id={`investigation-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div
                className={styles.tabPanel}
                role="tabpanel"
                id="investigation-overview"
                aria-labelledby="investigation-tab-overview"
              >
                <PanelHeading
                  title="Investigation draft summary"
                  detail="Generated deterministically from persisted synthetic transaction evidence."
                  badge={
                    <Badge
                      tone={
                        current.reliability.status === "VERIFIED"
                          ? "good"
                          : "review"
                      }
                    >
                      {businessStatus(current.reliability.status)}
                    </Badge>
                  }
                />
                <p className={styles.summaryText}>{current.draft_summary}</p>
                <div className={styles.findings}>
                  {current.context.indicators.map((reason) => (
                    <Finding
                      key={reason}
                      icon={ArrowUpRight}
                      title={reason}
                      detail="Deterministic synthetic triage indicator."
                      badge="Indicator"
                      tone="review"
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "transactions" && (
              <div
                className={styles.tabPanel}
                role="tabpanel"
                id="investigation-transactions"
                aria-labelledby="investigation-tab-transactions"
              >
                <PanelHeading
                  title="Alerted transactions"
                  detail="Five representative records from the 18-transaction alert window."
                />
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((row) => (
                        <tr key={`${row.time}-${row.type}`}>
                          <td>{row.time}</td>
                          <td>{row.type}</td>
                          <td>
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            }).format(row.amount)}
                          </td>
                          <td>{row.context}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "screening" && (
              <div
                className={styles.tabPanel}
                role="tabpanel"
                id="investigation-screening"
                aria-labelledby="investigation-tab-screening"
              >
                <PanelHeading
                  title="Screening and external context"
                  detail="Synthetic adapter results remain unverified until a human inspects the recorded result."
                />
                <div className={styles.evidenceList} aria-live="polite">
                  <EvidenceRow
                    icon={ShieldCheck}
                    title="Internal watchlist screening"
                    detail={
                      watchlistRun
                        ? `${watchlistRun.result.exact_match ? "Exact match recorded" : "No exact match"} · ${watchlistRun.result.possible_name_similarity ? "possible name similarity" : "no name similarity"} · synthetic result`
                        : "Not collected"
                    }
                    {...stateCopy(watchlist)}
                  />
                  <EvidenceRow
                    icon={Newspaper}
                    title="Adverse news search"
                    detail={
                      newsRun
                        ? `${String(newsRun.result.candidate_articles)} synthetic candidate articles · identity ${newsRun.result.identity_confirmed ? "confirmed" : "not confirmed"}`
                        : "Not collected"
                    }
                    {...stateCopy(news)}
                  />
                  <EvidenceRow
                    icon={Globe2}
                    title="Phone intelligence"
                    detail="No external phone-intelligence integration"
                    tone="neutral"
                    status="Optional"
                  />
                </div>
              </div>
            )}

            {activeTab === "evidence" && (
              <div
                className={styles.tabPanel}
                role="tabpanel"
                id="investigation-evidence"
                aria-labelledby="investigation-tab-evidence"
              >
                <PanelHeading
                  title="Evidence and provenance"
                  detail="Every collected item refers to a persisted synthetic tool attempt."
                />
                <div className={styles.evidenceList}>
                  {current.reliability.evidence.map((item) => (
                    <EvidenceRow
                      key={item.key}
                      icon={
                        item.status === "available" ? FileCheck2 : Paperclip
                      }
                      title={item.label}
                      detail={
                        item.status === "available"
                          ? `Synthetic ${current.provenance[item.key]?.tool_name || "authorized source"} · ${current.provenance[item.key]?.collected_at || "recorded"} · fingerprint ${current.provenance[item.key]?.fingerprint.slice(0, 12) || "unavailable"}`
                          : item.details
                      }
                      tone={
                        item.status === "available"
                          ? "good"
                          : item.status === "conflicting" || item.required
                            ? "review"
                            : "neutral"
                      }
                      status={
                        item.status === "available"
                          ? "Available"
                          : item.status === "conflicting"
                            ? "Conflicting"
                            : item.required
                              ? "Missing"
                              : "Optional"
                      }
                    />
                  ))}
                </div>
                <p className={styles.note}>
                  Tool results and fingerprints are synthetic and remain
                  available in the investigation history.
                </p>
                <h3>Tool attempts</h3>
                <ol className={styles.timeline}>
                  {current.tool_runs.map((run) => (
                    <li key={run.id}>
                      <span aria-hidden="true" />
                      <div>
                        <strong>
                          {run.tool_name.replaceAll("_", " ")} · attempt{" "}
                          {run.attempt_number} · {run.status}
                        </strong>
                        <p>
                          {run.error_summary ||
                            `Synthetic result recorded ${new Date(run.completed_at || run.started_at).toLocaleString("en-GB")}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <section className={styles.panel} aria-label="Activity">
            <PanelHeading
              title="Activity"
              detail="Persisted events from evidence collection and human review."
            />
            <ol className={styles.timeline}>
              {[
                ...(showAllActivity
                  ? activityEvents
                  : activityEvents.slice(-8)),
              ]
                .reverse()
                .map((event) => (
                  <li key={event.id}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>
                        {activityLabel(event)}
                        {typeof event.payload.tool_name === "string"
                          ? `: ${event.payload.tool_name.replaceAll("_", " ")}`
                          : typeof event.payload.key === "string"
                            ? `: ${event.payload.key.replaceAll("_", " ")}`
                            : ""}
                      </strong>
                      <p>
                        {new Date(event.created_at).toLocaleString("en-GB")} ·{" "}
                        {event.actor_id === "compliance"
                          ? "Raka Wijaya"
                          : event.actor_id === "compliance_checker"
                            ? "Sinta Mahardika"
                            : "SuperFlow"}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
            {activityEvents.length > 8 && (
              <button
                className="button secondary"
                type="button"
                onClick={() => setShowAllActivity((value) => !value)}
              >
                {showAllActivity
                  ? "Show recent activity"
                  : `View full history (${activityEvents.length})`}
              </button>
            )}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel} aria-label="Investigation risk">
            <PanelHeading
              title="Triage priority"
              detail="Derived from explicit synthetic indicators; not an AML finding."
              badge={
                <Badge
                  tone={
                    current.reliability.status === "VERIFIED"
                      ? "good"
                      : "review"
                  }
                >
                  {businessStatus(current.reliability.status)}
                </Badge>
              }
            />
            <div className={styles.risk}>
              <Badge tone="high">{current.context.triage_level} PRIORITY</Badge>
              <div>
                <strong>Human investigation required</strong>
                <p>{current.context.indicators.join("; ")}.</p>
              </div>
            </div>
            <p className={styles.note}>{current.reliability.summary}</p>
            {current.reliability.reasons.map((reason) => (
              <p className={styles.note} key={reason}>
                {reason}
              </p>
            ))}
          </section>

          <section className={styles.panel} aria-label="Evidence collection">
            <PanelHeading
              title="Evidence status"
              detail={`${requiredComplete} of ${requiredTotal} configured checks completed. Supporting documents are optional.`}
              badge={
                <Badge tone={collectionComplete ? "good" : "review"}>
                  {requiredComplete} / {requiredTotal}
                </Badge>
              }
            />
            <div className={styles.checklist}>
              {current.reliability.evidence.map((item) => (
                <CheckItem
                  key={item.key}
                  label={item.label}
                  detail={
                    item.status === "available"
                      ? "Collected from synthetic source"
                      : item.status === "conflicting"
                        ? "Conflicting evidence"
                        : item.required
                          ? "Missing"
                          : "Optional"
                  }
                  done={item.status === "available"}
                  optional={!item.required && item.status !== "conflicting"}
                />
              ))}
            </div>
            <button
              className="button primary full"
              type="button"
              onClick={() => {
                setActiveTab("screening");
                void mutate("/agent/run");
              }}
              disabled={
                busy ||
                collectionComplete ||
                !analyst ||
                Boolean(current.next_action?.stop)
              }
            >
              {collectionComplete ? (
                <Check size={16} />
              ) : (
                <ScanLine size={16} />
              )}
              {busy
                ? "Collecting evidence…"
                : collectionComplete
                  ? "Evidence collected"
                  : "Collect permitted evidence"}
            </button>
            <p className={styles.liveMessage} aria-live="polite">
              {current.next_action?.reason ||
                "Required evidence collection is complete."}
            </p>
            {current.tool_runs
              .filter((run) => run.status === "failed")
              .map((run) => (
                <div key={run.id}>
                  <p className={styles.note}>
                    {run.tool_name}: {run.error_summary}
                  </p>
                  {analyst &&
                    current.tool_runs.filter(
                      (item) => item.tool_name === run.tool_name,
                    ).length < 2 && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          void mutate(`/tools/${run.tool_name}/retry`)
                        }
                      >
                        Retry {run.tool_name.replaceAll("_", " ")}
                      </button>
                    )}
                </div>
              ))}
          </section>

          <section className={styles.panel} aria-label="Analyst recommendation">
            <PanelHeading
              title="Analyst recommendation"
              detail="AI assistance is a draft. The analyst records the recommendation; the checker decides independently."
            />
            <label htmlFor="investigation-notes">Analyst notes</label>
            <textarea
              id="investigation-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!analyst || busy}
              rows={3}
            />
            <label htmlFor="investigation-recommendation">
              Recommendation for checker
            </label>
            <textarea
              id="investigation-recommendation"
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
              disabled={!analyst || busy}
              rows={4}
            />
            <div className={styles.actions}>
              <button
                className="button secondary"
                type="button"
                disabled={!analyst || busy || recommendation.trim().length < 10}
                onClick={() =>
                  void mutate("/recommendation", { notes, recommendation })
                }
              >
                Save recommendation
              </button>
              <button
                className="button primary"
                type="button"
                disabled={
                  !collectionComplete ||
                  !analyst ||
                  busy ||
                  !current.analyst_recommendation
                }
                onClick={() => void mutate("/submit")}
              >
                <ArrowUpRight size={16} />
                Submit to independent checker
              </button>
            </div>
            {!collectionComplete && (
              <p className={styles.note}>
                Complete the required evidence checks before escalating to the
                checker.
              </p>
            )}
            {current.approval_id && (
              <Link
                className="button secondary"
                href={`/decisions?case=${encodeURIComponent(current.id)}`}
              >
                Open checker review
              </Link>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelHeading({
  title,
  detail,
  badge,
}: {
  title: string;
  detail?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className={styles.panelHeading}>
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {badge}
    </div>
  );
}

function Finding({
  icon: Icon,
  title,
  detail,
  badge,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  badge: string;
  tone: Tone;
}) {
  return (
    <div className={styles.finding}>
      <Icon size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <Badge tone={tone}>{badge}</Badge>
    </div>
  );
}

function CheckItem({
  label,
  detail,
  done = false,
  active = false,
  optional = false,
}: {
  label: string;
  detail: string;
  done?: boolean;
  active?: boolean;
  optional?: boolean;
}) {
  const Icon = done
    ? CheckCircle2
    : optional
      ? Paperclip
      : active
        ? Clock3
        : AlertTriangle;
  return (
    <div
      className={styles.checkItem}
      data-state={
        done ? "done" : optional ? "optional" : active ? "active" : "pending"
      }
    >
      <Icon size={17} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}
