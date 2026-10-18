# Staging readiness review — 18 October 2026

**Verdict: staging candidate; not yet a verified deployment on a destination host.**
The required Phase 0–8 feature areas are implemented within the PRD's bounded
prototype scope. Password authentication and real browser research now replace
mock identity selection and synthetic screening when the staging profile is used.
This does not establish production banking readiness or exhaustive screening.

## Phase coverage

| Required phase | Implementation evidence | Remaining scope boundary |
| --- | --- | --- |
| 0 — Foundation | Next.js shell, FastAPI, PostgreSQL, Alembic migrations through 0013 | Staging needs host service supervision, HTTPS and non-default database credentials |
| 1 — Knowledge | `knowledge.py`, parsing/OCR, persistent embeddings, hybrid retrieval, citations, source versions, conversation retrieval | Public guidance is not automatically bank policy; OCR and synthesis need review |
| 2 — Reliability | `guard.py`, canonical statuses, evidence/provenance/conflict/access checks, persisted audit | Guard is bounded validation, not a guarantee of legal or factual correctness |
| 3 — Controlled action | `cases.py`, `workflows.py`, tasks, retries, escalation, revisions, approvals and audit | No general visual workflow designer; decisions remain human |
| Product experience reconciliation | Role-aware navigation, My Work, Reviews / Approvals and domain workspaces | Internal models remain internal; chat redesign is the authorized UX extension |
| 4 — Regulation-to-action | Version comparison, mapped procedures, proposed findings, human confirmation, owned remediation | Deterministic comparisons and configured mappings, not automatic legal interpretation of every PDF |
| 5 — Investment intelligence | Source-linked assumptions, conflict resolution, NPV/IRR/ROI/payback/break-even, sensitivity, memo and frozen approval submission | Bounded input extraction; no autonomous investment decision |
| 6 — Analytics | Observed Quality/Delivery metrics and explicitly labeled Cost/Capacity simulations | Estimated capacity is not measured profit or payroll savings |
| 7 — Optional investigation proof point | Submitted JSON records, bounded tools, browser/vision sources, provenance, Guard and independent reviewer | No core-banking feed; public-web research is not an exhaustive sanctions provider |
| 8 — Walkthrough/polish | Walkthrough route, repeatable local fixture reset, role navigation, responsive motion and chat persistence | Synthetic UAT inputs remain labeled; staging reset is disabled |

## New staging controls

- PostgreSQL account credentials use Argon2id. Random opaque session tokens are
  hashed in the database; staging cookies are Secure/HttpOnly/SameSite=Lax.
- Login attempt limits, account lockout, session expiry, logout and password-reset
  revocation are enforced server-side. Unsafe cookie-authenticated requests require
  the configured Origin. No public registration or role-assignment endpoint exists.
- Browser-selected identity headers cannot change a password-authenticated user.
  The role picker is absent in password mode; CopilotKit forwards the user's session
  rather than retaining cookies in a shared handler cache.
- Staging configuration rejects local identity selection, synthetic screening and
  non-HTTPS public origins. Approvers without password-backed accounts are excluded.
- Browser investigation intake accepts explicitly sourced profile/transaction
  records. Google/Puppeteer and vision collect public evidence with authorized
  source inspection. Candidate sources never imply an identity match or clearance.
- Google blocking skips vision inference and leaves the screening evidence missing.
  Incomplete collection prevents submission; no synthetic fallback is used.
- Twelve additional named-account UAT records were added locally: six investment
  submissions and six imported investigation records. The latter wait for real web
  evidence. Earlier documents, conversations and sample decisions were preserved.

## Verification

- Final full backend suite: **225 passed, 2 skipped**. An additional targeted
  regression pass completed with **24 passed**. All five generated contract checks,
  migration/schema checks and code formatting checks passed.
- Frontend unit suite: **42 passed**. TypeScript, ESLint and the production build
  passed. The build retains a transitive CopilotKit/provider dynamic-import warning.
- Two password-mode browser journeys passed: wrong-password handling, login,
  reload, identity spoof rejection and logout; analyst JSON import with actual
  persisted transaction values. Screenshots are in `artifacts/screenshots/`.
- Password/session, CSRF, lockout, migration/schema, sample repeatability, case
  access, browser provenance and blocked-provider paths have automated coverage.
- Live Puppeteer on the workstation using installed Edge reached Google and
  received **HTTP 429**. This is a failed search, not successful screening.
- Live combined vision verification was interrupted after substantial workstation
  resource pressure. Later collection with Ollama stopped failed closed as expected.
  Successful live vision screening is **not** claimed for this release check.

## Gates still required before accepting deployed STG

1. Provision the destination host, domain/TLS, restricted network access, service
   accounts, private database credentials, model caches and a single API process.
2. Complete the deployed flows in `STAGING.md`, including real model inference,
   PDF/OCR/re-embedding, source capture/vision and an independent review decision.
3. Establish whether Google discovery works from that host. If it is blocked,
   selected public URLs are an explicit alternative; the search feature remains
   unavailable and must not be presented as passing acceptance.
4. Verify backup restoration, restart recovery, logs/monitoring, password operations,
   retention of captures and the expected concurrent tester load.

There is no deployment target configured or deployment approval recorded here.
Use this review as evidence for a controlled staging rollout, not a production
readiness certificate. Setup and acceptance steps: [STAGING.md](STAGING.md).
