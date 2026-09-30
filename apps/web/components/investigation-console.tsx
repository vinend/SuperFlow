"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  Globe2,
  MapPin,
  Newspaper,
  Paperclip,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ApplicationShell } from "./application-shell";
import { useSession } from "./session";
import { EmptyState, PageHeader } from "./ui/primitives";
import styles from "./investigation-review.module.css";

type Tab = "overview" | "transactions" | "screening" | "evidence";
type CollectionState = "pending" | "collecting" | "done";
type Tone = "neutral" | "good" | "review" | "high" | "info";

const transactions = [
  ["15 Sep · 08:42", "Inbound transfer", "+ IDR 98.0M", "New sender"],
  ["15 Sep · 10:06", "Outbound transfer", "− IDR 74.5M", "New beneficiary"],
  ["15 Sep · 11:18", "Merchant payment", "− IDR 41.0M", "Gaming merchant"],
  ["15 Sep · 13:29", "Outbound transfer", "− IDR 82.5M", "New beneficiary"],
  ["16 Sep · 17:04", "Outbound transfer", "− IDR 67.0M", "New beneficiary"],
];

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

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

function stateCopy(state: CollectionState) {
  if (state === "done") return { status: "Collected", tone: "good" as Tone };
  if (state === "collecting")
    return { status: "Collecting…", tone: "info" as Tone };
  return { status: "Pending", tone: "review" as Tone };
}

export function InvestigationConsole() {
  const { user } = useSession();
  return (
    <ApplicationShell view="investigation">
      {user.role_id === "compliance" ? (
        <InvestigationReview />
      ) : (
        <main
          className="main-content"
          id="workspace-main"
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
            description="Switch the demo role to Compliance to try the synthetic investigation flow."
          />
        </main>
      )}
    </ApplicationShell>
  );
}

function InvestigationReview() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [watchlist, setWatchlist] = useState<CollectionState>("pending");
  const [news, setNews] = useState<CollectionState>("pending");
  const [decision, setDecision] = useState<string | null>(null);
  const [activity, setActivity] = useState([
    ["Investigation opened", "Raka Wijaya · 15 Sep 2026, 09:16"],
    [
      "Authorized records retrieved",
      "Customer profile and 18 alert transactions added as evidence.",
    ],
    [
      "Typology analysis prepared",
      "Rapid movement and multiple-beneficiary patterns require analyst review.",
    ],
  ]);
  const collecting = watchlist === "collecting" || news === "collecting";
  const collectionComplete = watchlist === "done" && news === "done";
  const requiredComplete =
    3 + Number(watchlist === "done") + Number(news === "done");

  async function collectEvidence() {
    if (collecting || collectionComplete) return;
    setActiveTab("screening");
    setWatchlist("collecting");
    await wait(650);
    setWatchlist("done");
    setNews("collecting");
    await wait(650);
    setNews("done");
    setActivity((items) => [
      ...items,
      [
        "External context collected",
        "Watchlist result and two adverse-news candidates captured for human verification.",
      ],
    ]);
  }

  function recordDecision(label: string) {
    if (decision) return;
    setDecision(label);
    setActivity((items) => [
      ...items,
      [label, "Analyst recommendation recorded with the evidence snapshot."],
    ]);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "screening", label: "Screening & news" },
    { id: "evidence", label: "Evidence" },
  ];

  return (
    <main
      className={`main-content ${styles.workspace}`}
      id="workspace-main"
      tabIndex={-1}
      aria-labelledby="page-title"
    >
      <PageHeader
        eyebrow="Transaction monitoring alert"
        title="Unusual outbound transfer review"
        description="Review customer context, transaction patterns, screening results, and typology indicators before sending a recommendation to the checker."
        action={
          <Badge tone={decision === "Escalated to checker" ? "info" : "review"}>
            {decision === "Escalated to checker"
              ? "Waiting for checker"
              : decision || "Analyst review"}
          </Badge>
        }
      />

      <section
        className={styles.summary}
        aria-label="Alert and customer summary"
      >
        <Fact label="Alert" value="ALT-2026-1047" />
        <Fact label="Customer" value="Rizky Pratama" />
        <Fact label="Occupation" value="Logistics staff" />
        <Fact label="Declared source of funds" value="Monthly salary" />
        <Fact label="Alerted value" value="IDR 487.5M" />
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
                  title="Grounded alert summary"
                  detail="Drafted from authorized customer, alert, and transaction records."
                  badge={<Badge tone="review">Review required</Badge>}
                />
                <p className={styles.summaryText}>
                  In a 36-hour period, the customer received five inbound
                  transfers and sent funds to seven newly observed
                  beneficiaries. Aggregate outbound value is approximately 14×
                  the upper monthly baseline. Four transfers reference
                  entertainment and gaming-related merchants, while the profile
                  records monthly salary as the source of funds and no declared
                  cross-border business activity.
                </p>
                <div className={styles.findings}>
                  <Finding
                    icon={ArrowUpRight}
                    title="Rapid movement / pass-through pattern"
                    detail="82% of incoming funds were transferred onward within six hours."
                    badge="Strong match"
                    tone="high"
                  />
                  <Finding
                    icon={Users}
                    title="Multiple unrelated beneficiaries"
                    detail="Seven first-seen counterparties received similarly sized transfers."
                    badge="Supporting"
                    tone="review"
                  />
                  <Finding
                    icon={MapPin}
                    title="Geographic and merchant risk"
                    detail="Two locations match the bank's enhanced-review list; geography is a risk factor, not a conclusion."
                    badge="Supporting"
                    tone="review"
                  />
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
                        <tr key={`${row[0]}-${row[1]}`}>
                          {row.map((cell) => (
                            <td key={cell}>{cell}</td>
                          ))}
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
                  detail="External information remains unverified until an analyst inspects the original source."
                />
                <div className={styles.evidenceList} aria-live="polite">
                  <EvidenceRow
                    icon={ShieldCheck}
                    title="Internal watchlist screening"
                    detail={
                      watchlist === "done"
                        ? "No exact match · one low-confidence name similarity · screenshot captured"
                        : watchlist === "collecting"
                          ? "Opening ad hoc screening and capturing the result"
                          : "Not collected"
                    }
                    {...stateCopy(watchlist)}
                  />
                  <EvidenceRow
                    icon={Newspaper}
                    title="Adverse news search"
                    detail={
                      news === "done"
                        ? "Two possible articles captured · identity not yet confirmed"
                        : news === "collecting"
                          ? "Searching and recording candidate sources"
                          : "Not collected"
                    }
                    {...stateCopy(news)}
                  />
                  <EvidenceRow
                    icon={Globe2}
                    title="Phone intelligence"
                    detail="Manual lookup only · unverified third-party information"
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
                  title="Evidence document package"
                  detail="Structured records are primary; screenshots are timestamped secondary evidence."
                />
                <div className={styles.evidenceList}>
                  <EvidenceRow
                    icon={Database}
                    title="TM alert payload"
                    detail="Captured 15 Sep 2026 · checksum verified"
                    tone="good"
                    status="Available"
                  />
                  <EvidenceRow
                    icon={UserRound}
                    title="Customer profile snapshot"
                    detail="Profile, expected activity, and mandatory source-of-funds field"
                    tone="good"
                    status="Available"
                  />
                  <EvidenceRow
                    icon={ReceiptText}
                    title="Transaction export"
                    detail="18 records · totals independently recalculated"
                    tone="good"
                    status="Available"
                  />
                  <EvidenceRow
                    icon={FileCheck2}
                    title="Screening results"
                    detail={
                      collectionComplete
                        ? "Watchlist and adverse-news captures ready for analyst verification"
                        : "Run evidence collection to add external context"
                    }
                    tone={collectionComplete ? "good" : "review"}
                    status={collectionComplete ? "Available" : "Pending"}
                  />
                  <EvidenceRow
                    icon={Paperclip}
                    title="Supporting documents"
                    detail="Optional attachments are appended when the evidence document is generated"
                    tone="info"
                    status="Optional"
                  />
                </div>
                <p className={styles.note}>
                  Generating the final evidence document will combine all
                  required records with any optional supporting documents
                  supplied by the analyst.
                </p>
              </div>
            )}
          </section>

          <section className={styles.panel} aria-label="Activity">
            <PanelHeading
              title="Activity"
              detail="Human-readable audit history for this prototype."
            />
            <ol className={styles.timeline}>
              {activity.map(([title, detail], index) => (
                <li key={`${title}-${index}`}>
                  <span aria-hidden="true" />
                  <div>
                    <strong>{title}</strong>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel} aria-label="Investigation risk">
            <PanelHeading
              title="Investigation risk"
              detail="Triage rating, not a finding of money laundering."
            />
            <div className={styles.risk}>
              <div
                className={styles.score}
                aria-label="Risk score 82 out of 100"
              >
                82
              </div>
              <div>
                <strong>Enhanced review recommended</strong>
                <p>
                  Transaction-profile mismatch, rapid movement, new
                  counterparties, and geographic context outweigh the available
                  mitigating evidence.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-label="Evidence collection">
            <PanelHeading
              title="Evidence status"
              detail={`${requiredComplete} of 5 required checks completed. Supporting documents are optional.`}
              badge={
                <Badge tone={collectionComplete ? "good" : "review"}>
                  {requiredComplete} / 5
                </Badge>
              }
            />
            <div className={styles.checklist}>
              <CheckItem
                label="TM alert and transactions"
                detail="Available"
                done
              />
              <CheckItem
                label="Customer profile"
                detail="Source of funds included"
                done
              />
              <CheckItem
                label="Transaction aggregation"
                detail="Profile variance recalculated"
                done
              />
              <CheckItem
                label="Watchlist screening"
                detail={
                  watchlist === "done"
                    ? "Result captured"
                    : watchlist === "collecting"
                      ? "Collecting…"
                      : "Pending"
                }
                done={watchlist === "done"}
                active={watchlist === "collecting"}
              />
              <CheckItem
                label="Adverse news"
                detail={
                  news === "done"
                    ? "Sources captured"
                    : news === "collecting"
                      ? "Collecting…"
                      : "Pending"
                }
                done={news === "done"}
                active={news === "collecting"}
              />
              <CheckItem
                label="Supporting documents"
                detail="Included when available"
                optional
              />
            </div>
            <button
              className="button primary full"
              type="button"
              onClick={collectEvidence}
              disabled={collecting || collectionComplete}
            >
              {collectionComplete ? (
                <Check size={16} />
              ) : (
                <ScanLine size={16} />
              )}
              {collecting
                ? "Collecting evidence…"
                : collectionComplete
                  ? "Evidence collected"
                  : "Simulate evidence collection"}
            </button>
            <p className={styles.liveMessage} aria-live="polite">
              {collectionComplete
                ? "Required checks are complete. Optional supporting documents can still be attached before document generation."
                : collecting
                  ? "SuperFlow is collecting permitted screening and public-source context."
                  : "Run the simulation to collect screening and adverse-news evidence."}
            </p>
          </section>

          <section className={styles.panel} aria-label="Analyst recommendation">
            <PanelHeading
              title="Analyst recommendation"
              detail="Evidence remains visible before any recommendation is recorded."
            />
            <div className={styles.actions}>
              <button
                className="button secondary"
                type="button"
                disabled={Boolean(decision)}
                onClick={() => recordDecision("Information requested")}
              >
                Request information
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={Boolean(decision)}
                onClick={() => recordDecision("No further action drafted")}
              >
                Recommend no further action
              </button>
              <button
                className="button primary"
                type="button"
                disabled={!collectionComplete || Boolean(decision)}
                onClick={() => recordDecision("Escalated to checker")}
              >
                <ArrowUpRight size={16} />
                Escalate to checker
              </button>
            </div>
            {!collectionComplete && (
              <p className={styles.note}>
                Complete the required evidence checks before escalating to the
                checker.
              </p>
            )}
            {decision && (
              <p className={styles.liveMessage} aria-live="polite">
                {decision} and added to the activity history.
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
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
