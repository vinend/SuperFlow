# AGENTS.md — SuperFlow

## 1. Project Identity

SuperFlow is an **Enterprise Knowledge-to-Action Platform** for Superbank.

It is NOT:
- an AML/FIU-only product,
- a generic document chatbot,
- a ChatGPT wrapper,
- a pure RAG demo,
- a BPM/workflow-engine console,
- a CRM,
- or a collection of disconnected AI features.

SuperFlow turns governed enterprise knowledge into controlled, auditable, measurable action.

Core platform chain:

**Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact**

Core interaction loop:

**Ask → Retrieve → Verify → Decide → Act → Measure**

User-facing experience:

**Ask → Understand → Review → Act**

AML/FIU is only one optional proof point / workflow running on the shared platform foundation.

---

## 2. Product Source of Truth

Before making product, architecture, UX, or implementation decisions, read:

1. `SuperFlow_PRD_v2.md`
2. `AGENTS.md`
3. `IMPLEMENTATION_STATUS.md`
4. Existing repository code and tests

`SuperFlow_PRD_v2.md` supersedes `SuperFlow_PRD_v1.md`.

Do not use PRD v1 as the active product source of truth if PRD v2 exists.

Priority when instructions conflict:

1. Explicit task from the user
2. `SuperFlow_PRD_v2.md`
3. `AGENTS.md`
4. Existing implementation conventions
5. Reasonable engineering judgment

Do not silently change product direction.

If a requested change conflicts with PRD v2, implement the explicit user request and document the deviation in `IMPLEMENTATION_STATUS.md`.

---

## 3. Product Principles

### Source First
Material answers should be grounded in approved enterprise sources.

### Permission Aware
Permission checks happen before retrieval and before output.

Restricted information must never be retrieved and merely hidden in the frontend.

### Version Aware
Current documents are preferred.

Historical documents must be visibly identified and must not be treated as current authority.

### Evidence Before Conclusion
Material conclusions require sufficient supporting evidence.

### Human Authority
High-risk or material decisions remain under authorized human control.

### Knowledge Becomes Action
Answers should be able to become meaningful business actions.

### Impact Is Measurable
Operational and business impact should be measurable.

### Fail Safely
Missing, conflicting, outdated, or restricted evidence must not silently pass.

### User Goals First
Design UX around what the user wants to accomplish, not around database entities or backend architecture.

### Progressive Disclosure
Show technical detail only when useful.

---

## 4. Critical UX Rule — Do Not Expose Backend Architecture as the Product

This rule is mandatory.

Internal concepts such as:

- Case
- WorkflowDefinition
- WorkflowRun
- WorkflowStep
- Task
- Approval
- GuardResult
- EvidenceItem
- AuditEvent
- retry/fallback internals
- revision counters
- implementation phases

may exist in backend/domain architecture without becoming primary user-facing concepts.

Ordinary users must not be required to understand the workflow engine.

Prefer user-facing language such as:

- My Work
- Reviews
- Approvals
- Requests
- Regulatory Review
- Investment Analysis
- Progress
- Evidence
- Needs your input
- Waiting for review

Do not expose internal terms simply because they exist in code or database.

---

## 5. User-Facing Vocabulary

### Prefer

- My Work
- Reviews / Approvals
- Request
- Review
- Analysis
- Progress
- Evidence
- Source
- Reliability
- Required information
- Next action

### Avoid as primary user vocabulary

- WorkflowRun
- WorkflowDefinition
- Condition node
- Terminal node
- GuardResult
- Approval entity
- Case state machine
- backend revision
- Phase 0/1/2/3 labels

`Case` may still be used as a secondary/internal concept when contextually appropriate, but it should not be the default mental model for ordinary users.

---

## 6. User-Facing Navigation

Navigation must be role-aware.

Do not show every internal platform capability to every role.

### Employee

Preferred:

- Home
- Ask SuperFlow
- Knowledge
- My Work

### Manager / Approver

Preferred:

- Home
- Ask SuperFlow
- Knowledge
- My Work
- Reviews / Approvals

### Subject Matter Expert

Preferred:

- Home
- Ask SuperFlow
- Knowledge
- My Work
- Reviews

### Compliance

Preferred:

- Home
- Ask SuperFlow
- Knowledge
- Regulatory Review
- My Work
- Reviews / Approvals

### Finance

Preferred:

- Home
- Ask SuperFlow
- Knowledge
- Investment Analysis
- My Work
- Reviews / Approvals

### Governance Administrator

Preferred:

- Home
- Knowledge
- My Work
- Reviews / Approvals
- Governance

Do not expose standalone `Workflows` navigation to ordinary users.

Do not expose standalone `Cases` navigation to ordinary users unless there is a clear role-specific reason.

Do not expose `Decision Center` as user-facing wording if `Reviews / Approvals` communicates the job more clearly.

---

## 7. Product Experience Mapping

Internal backend concepts should map to user-facing business language.

| Internal concept | User-facing representation |
| --- | --- |
| Case | Work item / request / review / analysis |
| WorkflowRun | Progress |
| WorkflowStep | Current step / next step |
| Task | Action item |
| Approval | Review / approval |
| Decision Center | Reviews / Approvals |
| GuardResult | Reliability |
| EvidenceItem | Evidence / required information |
| AuditEvent | Activity / history |
| WorkflowDefinition | Hidden implementation configuration |

Do not rename database models only to match UI labels.

Prefer frontend adapters/view models where needed.

---

## 8. Primary Product Experiences

The product should be organized around experiences, not backend modules.

### Employee Knowledge Assistant

User asks in natural language.

SuperFlow returns:
- answer,
- source,
- version,
- reliability,
- next action.

If work is required, the user clicks a contextual business action.

Example:

`Request Exception`

not:

`Create Case → Start Workflow`

### Regulation-to-Action

User-facing experience:

`Regulatory Review`

Flow:
- regulation comparison,
- material change,
- SOP impact,
- gap,
- human review,
- remediation.

### Investment Intelligence

User-facing experience:

`Investment Analysis`

Flow:
- source-backed assumptions,
- deterministic calculations,
- sensitivity,
- memo,
- approval.

### AML/FIU

Optional proof point only.

Do not position the whole product around AML/FIU.

---

## 9. Scope Discipline

Follow the active PRD phases.

Current prototype baseline includes implemented Phases 0–7 and completed Product Experience Reconciliation. Phase 7 Investigation Review began as a frontend mockup and now uses persistent synthetic backend state, a bounded agent, SuperFlow Guard, and an independent human checker. Phase 8 adds a transactional presentation dataset and the integrated `/demo` walkthrough; see IMPLEMENTATION_STATUS.md for verification and limitations.

Phase 7 guardrails: AML/FIU is only a proof point on the shared platform. Use synthetic data and allowlisted tools only. Persist provenance for every collected result. Bound agent steps and retries; reject unknown actions. SuperFlow Guard remains the reliability authority. AI cannot make a final AML/FIU or regulatory-reporting decision. A separate human Compliance checker decides after analyst submission. Do not browse external systems or connect to real customer, transaction-monitoring, watchlist, adverse-news, or FIU services.

Default progression:

1. Foundation
2. Knowledge Core
3. Reliability / SuperFlow Guard
4. Controlled Action Core
5. Product Experience Reconciliation
6. Regulation-to-Action
7. Investment Intelligence
8. Analytics
9. Optional AML/FIU proof point
10. Demo polish

Do not start later work unless requested.

Avoid scope creep.

---

## 10. Frontend Strategy

SuperFlow uses:

**Next.js application shell + controlled generative workspace**

The application shell remains deterministic.

The generative workspace renders approved structured components based on intent and backend state.

AI may select:
- approved component type,
- structured component data,
- suggested action request.

AI must NOT generate arbitrary HTML or executable UI for workflow-critical experiences.

---

## 11. Controlled Generative UI

Maintain a controlled component registry.

Approved component types include:

- `AnswerCard`
- `SourcePanel`
- `EvidenceChecklist`
- `ComparisonTable`
- `FinancialAnalysis`
- `ApprovalPanel`
- `WorkflowTimeline` / `ProgressTimeline`
- `WorkItemCard` / `WorkItemRow`
- `ReviewPanel`

Additional components may be added when:

1. the use case requires them,
2. the component is reusable,
3. schema is explicit,
4. frontend validates it before rendering.

Unknown component types must fail safely.

Do not let model output directly become DOM, HTML, JavaScript, permission logic, or workflow transitions.

### CopilotKit V2 / AG-UI integration

- Use current CopilotKit V2 APIs for new integration code. Do not add deprecated V1 hooks such as `useCopilotAction` or `useCopilotReadable`.
- Keep the headless/custom SuperFlow UI. Reuse the existing controlled domain catalog; do not build a competing unrestricted component registry.
- Validate workspace intent, views, and identifiers with typed schemas. Prefer IDs and view intent over model-generated business facts.
- FastAPI remains authoritative for authorization, retrieval, Guard, workflow, approval, audit, finance calculations, and bounded domain agents.
- Material mutations require explicit human interaction in controlled domain UI. CopilotKit must never auto-approve or bypass expected revisions and idempotency.
- Direct domain routes and deterministic Ask must remain usable if the workspace runtime or Ollama is unavailable.
- The generative workspace integration follows completed Phase 7; Phase 8 reuses the domain workspaces and preserves the same controls.

---

## 12. Ask SuperFlow UX

Ask SuperFlow is an intent entry point, not a generic chatbot.

The result should visually separate:

- Answer
- Reliability
- Evidence
- Source
- Metadata
- Next Action

Do not default to chat bubbles.

Do not expose `Create Case` or `Start Workflow` unless those terms are genuinely useful to the target user.

Prefer contextual business-language actions.

Examples:

- Request Exception
- Submit Request
- Review Changes
- Start Regulatory Review
- Prepare Analysis
- Request Approval
- Provide Information

---

## 13. My Work UX

`My Work` is the main user-facing abstraction over execution state.

It may aggregate:

- Case
- WorkflowRun
- Task
- Approval
- Evidence requirement

A work item should show:

- business title,
- current status,
- progress,
- current/next action,
- owner/reviewer where useful,
- due date where useful,
- reliability where material,
- last update.

Avoid using technical IDs as primary titles.

Example:

`Expense reimbursement exception`

not:

`Case 4f98c / WorkflowRun 31`

---

## 14. Reviews / Approvals UX

Review screens must answer:

- What am I reviewing?
- Who requested it?
- Why does it need my decision?
- What evidence supports it?
- What does reliability indicate?
- What can I do?

Evidence/source context must appear before decision controls.

Actions:
- Approve
- Reject
- Request More Information
- Escalate
- Override where authorized

Override requires a non-empty reason.

---

## 15. Governance UX

Governance is role-gated.

Governance Administrator is an internal enterprise control role.

It is not related to government.

Governance may manage:

- roles,
- permissions,
- source authority,
- document lifecycle,
- source health,
- retention,
- audit,
- model/prompt policy metadata,
- quality controls.

Do not show Governance to ordinary users.

---

## 16. 21st.dev UI Component Strategy

21st.dev is an approved UI inspiration and reusable component source when access is available.

21st.dev is NOT a source of business logic.

### Search Order

Before creating a reusable presentation component:

1. Check existing project components.
2. Check existing design primitives.
3. Search 21st.dev if available.
4. Inspect candidate source/dependencies.
5. Reuse/adapt the best fit.
6. Build from scratch only if no suitable option exists.

Do not block development if 21st.dev is unavailable.

### Good Uses

- navigation
- command/search
- AI composer
- enterprise tables
- work-item lists
- review queues
- timelines
- progress indicators
- drawers/sheets
- dialogs
- metadata panels
- status indicators
- empty/loading/error states
- charts where appropriate

### Do Not Outsource

Never use third-party UI code as source of truth for:

- permissions,
- authorization,
- reliability,
- evidence completeness,
- source version selection,
- workflow transitions,
- approval authority,
- audit,
- financial calculations,
- backend validation,
- security.

### Review Checklist

Before adopting a component:

- inspect source,
- inspect dependencies,
- remove unnecessary packages,
- verify TypeScript,
- verify Tailwind compatibility,
- verify accessibility,
- verify keyboard behavior,
- verify responsive behavior,
- remove demo/marketing copy,
- adapt to SuperFlow tokens,
- preserve design consistency.

### Avoid UI Frankenstein

Normalize all adopted components.

Prefer a small number of coherent reusable primitives.

---

## 17. SuperFlow Design Direction

SuperFlow should feel like:

- enterprise banking software,
- modern,
- calm,
- trustworthy,
- structured,
- information-dense without clutter,
- highly legible,
- AI-native without gimmicks.

Preferred:

- dark navy / green-navy shell,
- light work surfaces,
- restrained lime/green accent,
- subtle borders,
- compact spacing,
- strong hierarchy,
- restrained animation.

Avoid:

- crypto aesthetics,
- excessive neon,
- excessive gradients,
- gaming UI,
- glassmorphism everywhere,
- huge hero sections,
- excessive cards,
- excessive pill badges,
- excessive motion,
- generic “AI dashboard” composition.

---

## 18. Design Tokens

Centralize:

- background
- surface
- elevated surface
- border
- primary text
- secondary text
- accent
- success
- warning
- danger
- info
- verified
- review-required
- blocked
- outdated
- access-restricted

Also centralize:

- spacing
- radius
- typography
- shadows
- z-index

Do not repeatedly hardcode random colors.

---

## 19. Accessibility

All user-facing UI should support:

- keyboard navigation,
- visible focus,
- semantic HTML,
- accessible labels,
- accessible dialogs/sheets,
- readable contrast,
- meaningful loading states,
- meaningful errors.

Do not sacrifice accessibility for visual effects.

---

## 20. Frontend Engineering Conventions

Preferred:

- Next.js
- App Router
- TypeScript
- React
- Tailwind CSS

Rules:

- keep components small,
- separate data and presentation,
- avoid giant page components,
- centralize API clients,
- centralize types/schemas,
- use typed responses,
- validate generative UI payloads,
- reuse primitives,
- avoid duplicate status mappings,
- do not reconstruct backend truth independently.

Use frontend view models/adapters to translate backend entities into user-facing business language.

---

## 21. Backend Engineering Conventions

Preferred:

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL

Backend owns:

- permissions,
- document/version authority,
- retrieval,
- citation resolution,
- Case state,
- workflow state,
- SuperFlow Guard,
- approvals,
- deterministic finance,
- audit,
- analytics calculations.

Do not weaken backend controls simply to simplify frontend UX.

---

## 22. AI Provider Architecture

Do not tightly couple to one LLM vendor.

Use abstractions such as:

- `LLMProvider`
- `EmbeddingProvider`
- `Retriever`

Support:

- deterministic/mock provider,
- optional real provider through environment variables.

The prototype must remain demoable without paid AI credentials.

Never commit API keys.

---

## 23. Allowed AI Responsibilities

AI may assist with:

- intent classification,
- grounded Q&A,
- summarization,
- structured extraction,
- document comparison,
- gap suggestion,
- assumption extraction,
- draft memo generation,
- suggested next action.

AI must NOT independently control:

- permissions,
- authorization,
- restricted data exposure,
- final compliance decisions,
- final investment approvals,
- financial formulas,
- final material approvals.

Critical decisions belong to deterministic rules and/or authorized humans.

---

## 24. SuperFlow Guard

SuperFlow Guard is core infrastructure.

Do not treat reliability as only a visual badge.

Applicable checks may include:

- citation coverage,
- source validity,
- source authority,
- version validity,
- permission validity,
- evidence completeness,
- material conflicts,
- calculation validity,
- workflow risk,
- human approval requirement.

Guard results should be structured and persisted where appropriate.

---

## 25. Reliability States

Use canonical values:

- VERIFIED
- REVIEW_REQUIRED
- BLOCKED
- OUTDATED
- ACCESS_RESTRICTED

Do not invent equivalent duplicate statuses.

Frontend copy may humanize explanation, but canonical backend status stays centralized.

---

## 26. Permission Model

Permission checks must happen:

1. before retrieval,
2. before source output,
3. before workflow/action where relevant.

Do not retrieve restricted content and hide it later.

Tests must prove restricted data does not leak.

---

## 27. Knowledge and Documents

Knowledge model should support:

- title,
- domain,
- owner,
- authority,
- access roles,
- version,
- effective date,
- status,
- relationships,
- file identity,
- source hierarchy.

Document processing may support:

- PDF
- DOCX
- TXT
- Markdown
- structural extraction
- structure-aware chunking

Future:
- semantic reranking

Local PDF/image OCR and optional BGE hybrid retrieval are available after Phase 8.
See `docs/RAG_OCR.md`. Preserve extraction/page provenance and require review of
OCR-derived evidence. Authorization must run before vector lookup/ranking. Never
silently skip stale or missing embeddings, or rewrite cited text during re-index.

---

## 28. Retrieval

Retrieval abstraction should support:

- keyword
- semantic/vector when implemented
- metadata filter
- permission filter
- authority weighting
- reranking
- citation generation

Citations must point to real source/chunk records.

Never create fake citations.

---

## 29. Internal Case Model

Case remains a shared backend/domain workspace.

It may contain:

- type/domain,
- title,
- status,
- owner,
- reliability,
- source relationships,
- evidence,
- tasks,
- workflow,
- approvals,
- audit.

Do not force ordinary users to navigate by the word `Case`.

Present it according to business context.

---

## 30. Workflow Engine

Use a simple persistent state machine.

Concepts:

- WorkflowDefinition
- WorkflowRun
- Step
- Task
- Condition
- Retry
- Fallback
- Escalation
- Approval

Workflow state persists across reloads.

Do not introduce heavy orchestration infrastructure without explicit need.

Do not expose engine internals to ordinary users.

---

## 31. Human Decision Layer

Material actions should be reviewable.

Supported decisions:

- Approve
- Reject
- Request More Information
- Edit where appropriate
- Escalate
- Override with reason

Evidence and source context come before action buttons.

Human decisions create audit events.

No self-approval where independent review is required.

---

## 32. Financial Logic

Financial calculations must be deterministic.

Do not use free-form LLM arithmetic for:

- NPV
- IRR
- ROI
- payback
- break-even
- sensitivity

Use tested Python functions.

AI may extract assumptions.

Expose:
- source,
- assumption,
- formula,
- unit,
- period,
- result.

Surface conflicts instead of silently resolving them.

---

## 33. Analytics

Organize impact around QCD.

Quality:
- citation coverage
- verified rate
- conflict detection
- rework
- outdated-source usage avoided

Cost / Capacity:
- manual effort
- hours released
- cost per work item
- capacity release
- illustrative cost avoidance

Delivery:
- answer time
- cycle time
- backlog
- throughput
- completion
- escalation

Simulated financial values must say:

**Illustrative simulation**

Do not present soft-dollar productivity as realized profit.

---

## 34. Audit Trail

Audit events should be append-only where practical.

Capture:

- timestamp,
- actor,
- event type,
- entity,
- source IDs,
- agent action,
- Guard result,
- workflow transition,
- human decision,
- override reason.

Ordinary users may see a readable activity timeline rather than raw event schema.

---

## 35. Demo Data

User-authorized OJK demo extension: real public OJK PDFs may populate Knowledge and the RAG index alongside synthetic fixtures. Keep official file bytes/checksum, publisher/URL, retrieval date, page/article citations, and separate FAQ from regulations. An indexed active version does not establish current legal applicability; official references remain REVIEW_REQUIRED. Use LlamaIndex with authorized persisted vectors, preserve CopilotKit V2 controlled response cards, and keep SuperFlow navigation/product concepts unchanged. See `docs/OJK_DEMO.md`. This does not authorize real customer/FIU integrations.

User-authorized source ingestion extension: public website captures may be imported through Knowledge using Puppeteer and local vision. This is separate from the synthetic FIU proof point and must never be exposed as an investigation agent tool. Preserve capture URL/time, screenshots and model observations; validate public network destinations before connections, keep source permissions, save drafts first, and require human review for website-derived guidance. See `docs/WEBSITE_CAPTURE.md`.

Use synthetic/mock data only.

Seed repeatable scenarios for:

- valid/current source,
- outdated source,
- restricted source,
- missing evidence,
- conflicting evidence,
- human approval,
- regulatory review,
- investment analysis if implemented.

The application should reset to a known demo state.

---

## 36. Error Handling

Build usable states for:

- no result,
- unavailable source,
- restricted source,
- outdated source,
- conflicting evidence,
- missing evidence,
- AI provider unavailable,
- parsing failure,
- workflow failure,
- network/backend failure.

Never expose raw stack traces to users.

---

## 37. Observability

Use:

- structured logs,
- request IDs,
- agent run IDs,
- workflow run IDs where useful.

Make demo failures diagnosable.

Do not expose observability identifiers prominently to ordinary users.

---

## 38. Security

Rules:

- never commit secrets,
- never expose secret environment variables to browser,
- backend owns permission enforcement,
- audit overrides,
- validate inputs,
- use synthetic data,
- minimize sensitive logging.

---

## 39. Repository Hygiene

Before adding a dependency:

- verify need,
- prefer existing dependency,
- avoid overlapping libraries,
- avoid heavy dependencies for tiny needs.

Remove unused code/dependencies.

Do not leave abandoned experiments in production paths.

---

## 40. Documentation

Maintain:

- `README.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_STATUS.md`

README should explain:

- product,
- architecture,
- setup,
- environment,
- database,
- migrations,
- seed/reset,
- run commands,
- tests,
- demo users,
- demo flow,
- project structure,
- limitations.

Project documentation is in Bahasa Indonesia unless source/tooling convention requires English.

`AGENTS.md` and `SuperFlow_PRD_v2.md` remain in English.

---

## 41. Working Process

Before coding:

1. Read `SuperFlow_PRD_v2.md`.
2. Read `AGENTS.md`.
3. Inspect current repository.
4. Read `IMPLEMENTATION_STATUS.md`.
5. Identify existing implementation.
6. Reuse good code.
7. Implement requested scope end-to-end.
8. Run tests.
9. Fix failures.
10. Update status/docs.

Do not stop after scaffolding unless explicitly requested.

Do not ask for approval after every small change.

Do not start later phases unless requested.

---

## 42. Product Experience Reconciliation Rules

When reconciling Phase 0–3 UI:

Preserve backend:

- Case
- WorkflowDefinition
- WorkflowRun
- Task
- Approval
- GuardResult
- Evidence
- AuditEvent
- permissions
- state machine
- concurrency protections
- tests

Refactor frontend to:

- role-aware navigation,
- My Work,
- Reviews / Approvals,
- business-language titles,
- human-readable progress,
- contextual next actions.

Do not rebuild working backend systems.

Do not rename DB entities only for UX copy.

Remove user-facing development labels such as:

- Phase 0–3
- Knowledge + Action phase indicators
- WorkflowDefinition
- revision/debug identifiers

unless in developer/admin surfaces.

---

## 43. Definition of Done for User-Facing Features

A user-facing feature is not done because backend and UI both exist.

It is done when:

- the user can understand what it is for,
- terminology matches the user's job,
- next action is clear,
- internal implementation details are hidden unless useful,
- backend data persists,
- permissions work,
- loading/empty/error states exist,
- reliability is represented appropriately,
- audit behavior exists where material,
- tests pass,
- documentation is updated.

---

## 44. Code Quality Rules

Prefer:

- explicit schemas,
- typed contracts,
- small modules,
- reusable components,
- deterministic critical logic,
- provider abstractions,
- clear naming,
- clear data ownership,
- frontend view-model translation.

Avoid:

- giant React components,
- giant service files,
- magic strings,
- duplicate statuses,
- duplicate authorization,
- frontend-owned business truth,
- fake backend behavior,
- fake citations,
- silent failure,
- unnecessary abstraction,
- exposing backend terminology as UI simply because it is convenient.

---

## 45. Final Verification Before Stopping

Run relevant:

- formatter,
- linter,
- type checker,
- backend tests,
- frontend tests,
- critical E2E tests,
- production build.

Manually verify:

- role-aware navigation,
- Ask flow,
- Knowledge,
- My Work,
- Reviews / Approvals where applicable,
- reliability,
- permissions,
- source/version,
- no restricted leakage,
- responsive behavior,
- no development-only language on user-facing screens.

---

## 46. Product Framing Reminder

Never turn SuperFlow into:

- AML AI Assistant,
- enterprise chatbot,
- workflow-engine console,
- case-management tool,
- admin dashboard.

The intended product is:

**SuperFlow — Enterprise Knowledge-to-Action Platform**

Employee knowledge access is the simple entry point.

Regulation-to-Action is the primary banking-context differentiator.

Investment Intelligence demonstrates cross-division reuse.

AML/FIU is an optional proof point.

---

## 47. North Star

Every major product decision should support:

> Trusted knowledge should not stop at an answer.  
> It should become controlled, auditable, measurable action.

And every major UX decision should support:

> Users should understand the work they need to do, not the architecture that makes it possible.
