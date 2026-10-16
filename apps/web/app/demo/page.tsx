"use client";

import Link from "next/link";
import { ApplicationShell } from "@/components/application-shell";
import { useSession } from "@/components/session";
import { PageHeader } from "@/components/ui/primitives";
import styles from "./walkthrough.module.css";

const JOURNEY = [
  {
    title: "Find a trusted answer",
    user: "employee",
    role: "Employee",
    href: "/ask",
    description:
      "Ask: How many annual leave days do I get? Open a citation, check the current version, and inspect reliability.",
    proof: "A grounded answer with an inspectable source.",
  },
  {
    title: "Continue into controlled work",
    user: "employee",
    role: "Employee",
    href: "/cases",
    description:
      "Open Annual Leave Review and complete its evidence task to request manager review. Compare it with Supporting Evidence Request and Access Review Clarification; complete their tasks to see missing and conflicting information stop or route progress.",
    proof: "Useful next actions and persistent progress.",
  },
  {
    title: "Turn regulation into remediation",
    user: "compliance",
    role: "Compliance",
    href: "/regulatory",
    description:
      "Open the digital operations review. Compare the historical and current regulation, inspect SOP gaps, then confirm a finding with an owner and due date.",
    proof: "A human decision creates traceable remediation work.",
  },
  {
    title: "Resolve an investment assumption",
    user: "finance",
    role: "Finance",
    href: "/investment",
    description:
      "Open Proposal A. Inspect the conflicting implementation costs, choose a source with a reason, review the formulas and sensitivity, then submit the memo for approval.",
    proof: "Source-backed assumptions and deterministic calculations.",
  },
  {
    title: "Review evidence before deciding",
    user: "manager",
    role: "Manager",
    href: "/decisions",
    description:
      "Inspect the request, sources, and reliability before approving, rejecting, or requesting more information. Open My Work afterward to inspect the recorded activity.",
    proof: "Independent human authority and an auditable outcome.",
  },
  {
    title: "Measure the shared platform",
    user: "governance",
    role: "Governance Admin",
    href: "/impact",
    description:
      "Inspect Quality, Cost / Capacity, and Delivery after the preceding actions. Observed activity comes from persisted records; capacity values are an Illustrative simulation. Unmeasured metrics stay explicit.",
    proof: "Measured activity with transparent simulation assumptions.",
  },
] as const;

export default function DemoWalkthrough() {
  const { users, selectUser } = useSession();
  return (
    <ApplicationShell view="demo">
      <main id="workspace-main" className="main-content" tabIndex={-1}>
        <PageHeader
          eyebrow="From trusted knowledge to measurable action"
          title="Demo walkthrough"
          description="One shared platform, from an employee question to evidence, human review, and business impact. Each link switches to the indicated demo identity."
        />
        <p className={styles.notice}>
          Synthetic demonstration only. Start with the prepared demo dataset.
          Decisions and changes persist; returning here does not reset your
          work.
        </p>
        <ol className={styles.journey} aria-label="Platform walkthrough">
          {JOURNEY.map((step) => (
            <li key={step.title}>
              <div>
                <p className={styles.role}>{step.role}</p>
                <h2>{step.title}</h2>
                <p>{step.description}</p>
                <p className={styles.proof}>{step.proof}</p>
              </div>
              {users.some((person) => person.id === step.user) ? (
                <Link
                  className="button secondary"
                  href={step.href}
                  onClick={() => selectUser(step.user)}
                  aria-label={`Open ${step.title} as ${step.role}`}
                >
                  Open as {step.role}
                </Link>
              ) : (
                <p role="status">This demo identity is unavailable.</p>
              )}
            </li>
          ))}
        </ol>
        <section
          className={styles.optional}
          aria-labelledby="investigation-story"
        >
          <h2 id="investigation-story">Optional: Investigation Review</h2>
          <p>
            As Compliance, open a synthetic alert, collect evidence, inspect
            tool provenance and reliability, then save an analyst recommendation
            and submit it. Switch to Compliance Checker in the role selector to
            make the independent review in Reviews / Approvals. Failed evidence
            and conflicting evidence examples use the same controls.
          </p>
          {users.some((person) => person.id === "compliance") ? (
            <Link
              className="button secondary"
              href="/investigations"
              onClick={() => selectUser("compliance")}
            >
              Open investigations as Compliance
            </Link>
          ) : null}
        </section>
      </main>
    </ApplicationShell>
  );
}
