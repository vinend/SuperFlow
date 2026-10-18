# Staging / UAT deployment

SuperFlow is a staging candidate with implemented business workflows. Staging
means a separate environment for testing deployed code, permissions and integrations
before production (PRD). Synthetic UAT records are test inputs, not simulated
authentication, invented tool results, or approvals. Local verification is not a
successful remote staging deployment.

## Supported topology

Use a persistent single-host Node.js + Python deployment with PostgreSQL and
Ollama. Run **one API process**, without reload or multiple workers: chat and
browser queues and recovery coordination are process-local. Stateless/serverless
deployment and horizontal scaling are not supported by this release.

Keep Next.js :3000, FastAPI :8000, PostgreSQL :5432 and Ollama :11434 on loopback
or a private network. Terminate HTTPS at an authenticated application origin;
`deploy/Caddyfile` supplies a TLS reverse-proxy template for Next.js. Only the
gateway is reachable by testers. Cookies and original Origin headers must pass
through unchanged. Do not cache authenticated API responses or log request bodies.

## Prepare a new staging host

1. Install Node 24+, npm, Python 3.12+, PostgreSQL 18, Chromium and Ollama.
   Use a non-administrator OS service account with a working Chromium sandbox.
2. Create a dedicated PostgreSQL database and non-default credentials. Copy
   `deploy/staging.env.example` into the host's untracked `.env`, replacing host,
   credentials and paths. `PUBLIC_APP_URL` must exactly match the HTTPS origin.
   `APP_ENVIRONMENT=staging` rejects local identity selection and synthetic screening.
3. Install with `npm ci`, create a Python virtual environment, then install
   `apps/api/requirements-rag-lock.txt`. Set `PYTHON` to that interpreter. Install
   Chromium with `npx playwright install chromium` or set `WEB_BROWSER_EXECUTABLE`
   to a sandbox-capable installed browser. Chromium must be usable by the service user.
4. Run `npm run db:migrate`, then `npm run db:seed`. Staging seed installs base
   roles, workflow definitions and labeled source examples; it does not invoke
   synthetic investigation adapters. There is no destructive staging reset command.
5. Provision named accounts using `npm run accounts -- --email user@example.com
   --name "Person Name" --role finance`. Passwords are entered at a terminal, never
   passed as command-line arguments. Repeat for manager, governance, Compliance
   analyst, a different Compliance reviewer, SME and employee as needed. There is
   no open registration or public role-assignment endpoint.
6. Pull `OLLAMA_MODEL` and `VISION_MODEL`, provision the configured embedding model,
   import authorized reference documents, then run `npm run rag:reindex`.
   Uploads and embeddings persist in PostgreSQL. Back up model caches separately.
7. Optionally add UAT records with `npm run stg:samples -- --finance FINANCE_USER_ID
   --analyst ANALYST_USER_ID --prefix stg`. The command is additive and repeatable;
   decisions and existing data are preserved. Browser-profile investigations wait
   for actual research. No invented screening results are inserted.
8. Run `npm run build`, then run the production Next.js server with `npm run start`
   and the API with `npm run dev:api` (despite its historical name, this command is
   Uvicorn without reload). Put both behind an OS service supervisor. Configure
   `SUPERFLOW_STAGING_HOST`, validate the Caddyfile and start the HTTPS gateway.
9. Confirm that the staging host's models, memory and firewall accommodate OCR,
   embeddings and browser/vision inference. Verify outbound DNS/HTTPS for sources,
   while blocking internal/private destination access at the network boundary too.

## Account controls

Passwords use pwdlib's Argon2id implementation. PostgreSQL stores password hashes
and SHA-256 hashes of random opaque session tokens. Staging cookies are HttpOnly,
Secure, SameSite=Lax, host-only and expire after eight hours by default. Every
request checks account activity and session expiry; unsafe requests must carry the
configured application Origin. Logout and password replacement revoke sessions.
The login endpoint has persisted attempt limits and account lockout. Deployment
ingress should also rate-limit authentication traffic before it reaches Python.

In password mode the browser-selected `X-User-Id` is ignored. Domain permissions
come from the database, and approval routing excludes accounts without credentials.
Account provisioning and password recovery are operator procedures through the
CLI; self-service registration, email reset and MFA are not implemented. Disable a
departing account by setting its `users.active=false` through the administrator's
database process; all its sessions immediately fail authorization.

## Investigation research

Compliance can import JSON through **Investigation Review → Import investigation
records**. The downloadable template documents profile, transactions, record source,
optional indicators and selected source URLs. Imported records are analyst-supplied
evidence, not a core-banking connector. Sample inputs remain labeled as samples.

The two research tools reuse the local Google/Puppeteer capture and Ollama vision
stack. Watchlist research is restricted to configured official public hosts; news
research collects bounded public results. Source URL, excerpt, capture, vision
observations, timestamp and fingerprint remain attached to the authorized case.
Google discovery is identified separately from analyst-selected URLs.

This is public-web research, not a licensed exhaustive sanctions/PEP matching
service. A source hit is not a confirmed identity match, and absence of a hit does
not establish clearance. Browser evidence always requires human review. Google
429/CAPTCHA, unavailable vision, failed source access or missing evidence blocks
submission; no synthetic fallback is permitted. There is no CAPTCHA bypass.

## Release gates on the destination host

- Verify actual HTTPS login, cookie flags, reload, logout, revocation and identity
  spoof rejection. Verify unauthorized document, chat and case access is denied.
- Verify real PDF upload/OCR, full re-embedding, permissions, citations and original
  downloads with the deployed model/cache configuration.
- Run investment preparation → submission → independent decision. Run regulatory
  comparison → confirmed finding → remediation → completion.
- Run browser research → retained sources/vision → analyst recommendation → a
  different human reviewer. Exercise Google blocking and selected-URL collection.
- Verify CopilotKit through the authenticated gateway, model errors, session expiry,
  and a restart during pending work. Verify restored data after a database backup.
- Monitor logs, latency, disk, browser/model RAM, database health and model availability.
  Store logs without passwords, session cookies, raw customer records or prompts.
- Record migration, build, test and deployment revisions. Back up before migration;
  roll back code only when compatible with the migrated schema. Test restoration
  before accepting staging; never use a synthetic reset as rollback.

The remote host, TLS, firewall, model provisioning, backup restore and real web
availability must be verified there before the release is accepted as deployed STG.
Production requires a separate review of SSO/MFA, privacy/retention, segregation of
duties, threat testing, provider coverage, audit retention and load capacity.

References: [FastAPI password hashing](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/),
[OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
