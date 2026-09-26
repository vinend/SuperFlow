# SuperFlow — Product Requirements Document (PRD)

**Version:** 2.0 — Hackathon Prototype  
**Product:** SuperFlow  
**Category:** Enterprise Knowledge-to-Action Platform  
**Tagline:** From Trusted Knowledge to Measurable Action  
**Primary theme:** Making AI Agents Reliable: The Missing Layer between AI and Business  
**Supersedes:** `SuperFlow_PRD_v1.md`

---

# 1. Product Summary

SuperFlow is an enterprise workspace that helps employees find trusted company knowledge, understand why an answer can or cannot be relied on, and continue directly into the next useful action.

SuperFlow is not a generic chatbot, not an AML/FIU-only product, and not a collection of backend modules exposed as user navigation.

The platform connects:

**Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact**

The primary user loop is:

**Ask → Retrieve → Verify → Decide → Act → Measure**

The key product promise is:

> **Trusted knowledge should not stop at an answer. It should become controlled, auditable, measurable action.**

SuperFlow uses one shared foundation for employee self-service, compliance, finance, audit, operations, and future workflows. Different users see different task-oriented experiences on top of the same underlying platform.

---

# 2. Why PRD v2 Exists

PRD v1 correctly defined the platform architecture, reliability controls, cases, workflows, approvals, audit, analytics, and domain use cases.

However, it exposed too much internal architecture as primary user-facing information architecture.

Examples of internal concepts that should not automatically become primary navigation:

- Case
- WorkflowDefinition
- WorkflowRun
- WorkflowStep
- Approval
- GuardResult
- AuditEvent
- EvidenceItem
- retry/fallback mechanics
- phase labels

These concepts remain valid and important in the backend/domain model.

PRD v2 changes the **user mental model**, not the core architecture.

The new rule is:

> **User goals first. Backend entities second.**

Users should not need to understand the workflow engine in order to use SuperFlow.

---

# 3. Problem Statement

Enterprise knowledge already exists across SOPs, regulations, policies, financial documents, operational references, and internal systems.

The operational problem is that this knowledge is often:

- fragmented,
- difficult to find,
- duplicated,
- version-sensitive,
- permission-sensitive,
- dependent on managers or subject matter experts,
- disconnected from the work that follows.

This creates problems such as:

- employees spending time searching for the right source,
- managers repeatedly answering routine questions,
- subject matter experts becoming bottlenecks,
- users relying on outdated or conflicting guidance,
- inconsistent answers across teams,
- knowledge stopping at “information” rather than becoming action,
- AI outputs being difficult to trust without source, version, permission, evidence, and human-control checks,
- weak visibility into operational impact.

SuperFlow closes the gap between finding trusted knowledge and completing the work that knowledge enables.

---

# 4. Product Positioning

## 4.1 What SuperFlow Is

SuperFlow is an **Enterprise Knowledge-to-Action Platform**.

It gives employees one place to:

- ask questions,
- inspect trusted sources,
- understand reliability,
- upload or review documents,
- continue into work,
- request approval,
- review work assigned to them,
- complete guided processes.

## 4.2 What SuperFlow Is Not

SuperFlow is not:

- an AML/FIU-only application,
- a generic RAG chatbot,
- a ChatGPT wrapper,
- a document search demo,
- a CRM,
- a BPM/workflow-engine console,
- a Jira clone,
- an admin dashboard,
- a backend entity browser.

## 4.3 Platform Differentiator

The differentiator is not “AI can answer questions.”

The differentiator is:

1. answers come from governed sources,
2. reliability is explicitly checked,
3. unsafe continuation can be stopped,
4. human authority remains in control,
5. knowledge can become work,
6. the work can be audited and measured.

---

# 5. Product Principles

1. **Source First** — Material answers must be grounded in approved sources.
2. **Permission Aware** — Retrieval and output respect user access.
3. **Version Aware** — Current sources are prioritized; historical sources are clearly identified.
4. **Evidence Before Conclusion** — Material conclusions require sufficient evidence.
5. **Human Authority** — High-risk or material decisions remain with authorized humans.
6. **Knowledge Becomes Action** — Answers can become guided work, requests, reviews, approvals, remediation, or analysis.
7. **Impact Is Measurable** — Quality, time, capacity, rework, and cost effects can be measured.
8. **Fail Safely** — Missing, conflicting, outdated, or restricted evidence should not silently pass.
9. **User Goals First** — Users should see work in business language, not internal engine terminology.
10. **Progressive Disclosure** — Technical detail is available when useful, but not forced on ordinary users.

---

# 6. User Mental Model

SuperFlow should expose only a small number of concepts that ordinary users need to understand.

## 6.1 Ask

“I need to know something.”

Examples:

- What documents do I need for reimbursement?
- Which SOP applies?
- What changed in this regulation?
- What approval limit applies?
- What assumptions are in this proposal?

## 6.2 Knowledge

“I want to inspect the source.”

Examples:

- SOP,
- regulation,
- policy,
- financial document,
- proposal,
- quotation,
- control document.

## 6.3 My Work

“I have something in progress.”

Examples:

- request waiting for approval,
- review assigned to me,
- evidence I need to provide,
- remediation item,
- analysis in progress,
- request completed.

Internally, My Work may aggregate:

- Case,
- Task,
- WorkflowRun,
- Approval,
- evidence requirements.

The user should not have to understand those internal entities.

## 6.4 Reviews / Approvals

“I need to make a decision.”

This is shown only to roles that have review authority.

Internally this uses the Approval / Decision Center architecture.

The user-facing language should be:

- Reviews
- Approvals
- Needs your attention
- Request more information
- Escalate

not:

- Decision Center
- Approval entity
- Workflow approval node

## 6.5 Domain Experiences

Role-specific experiences may appear when relevant:

- Regulatory Review
- Investment Analysis
- Audit Review
- Operations Review
- future AML/FIU investigation

These are user-facing business experiences built on the shared Case/Workflow/Guard architecture.

---

# 7. Role Model

## 7.1 Employee

Primary needs:

- ask questions,
- find correct procedure,
- inspect sources,
- understand next steps,
- submit/request work,
- track own work.

Default navigation:

- Home
- Ask SuperFlow
- Knowledge
- My Work

## 7.2 Manager / Approver

Primary needs:

- understand requests,
- inspect evidence,
- see reliability,
- approve/reject/request more information,
- track team work.

Navigation:

- Home
- Ask SuperFlow
- Knowledge
- My Work
- Reviews / Approvals

## 7.3 Subject Matter Expert

Primary needs:

- resolve ambiguous knowledge,
- review conflicts,
- maintain source quality,
- review exceptions.

Navigation:

- Home
- Ask SuperFlow
- Knowledge
- My Work
- Reviews

## 7.4 Compliance User

Primary needs:

- regulatory review,
- compare requirements,
- map impacted SOP/control,
- review gaps,
- track remediation.

Navigation:

- Home
- Ask SuperFlow
- Knowledge
- Regulatory Review
- My Work
- Reviews / Approvals

## 7.5 Finance User

Primary needs:

- investment analysis,
- inspect assumptions and sources,
- run deterministic calculations,
- prepare review material,
- handle approval.

Navigation:

- Home
- Ask SuperFlow
- Knowledge
- Investment Analysis
- My Work
- Reviews / Approvals

## 7.6 Governance Administrator

Governance Administrator is an internal enterprise control role, not a government-related role.

Primary needs:

- document metadata,
- document versions,
- access permissions,
- source authority,
- retention,
- knowledge health,
- audit trail,
- quality controls.

Governance should not appear to ordinary employees.

Governance UI may be role-gated and introduced later.

---

# 8. User-Facing Information Architecture

## 8.1 Home

Purpose:

Answer:

> “What do I need to know or do right now?”

Home should prioritize:

- Ask SuperFlow,
- work requiring attention,
- recent/relevant knowledge,
- pending review where applicable,
- recently updated source context.

Home should not primarily look like a BI dashboard.

Do not make document counts or infrastructure metrics the main visual hierarchy.

## 8.2 Ask SuperFlow

Purpose:

Capture user intent in natural language and render the appropriate controlled workspace.

The Ask experience should:

- accept natural-language questions,
- support source/domain filters,
- show grounded answer,
- show citations,
- show version,
- show reliability,
- show evidence,
- show safe next action.

Ask should not behave like a generic chat application.

## 8.3 Knowledge

Purpose:

Allow users to inspect trusted enterprise sources they are authorized to access.

For ordinary users:

- browse,
- search,
- filter,
- inspect source,
- inspect version,
- inspect effective date,
- inspect owner/authority.

For authorized maintainers:

- upload,
- edit metadata,
- publish version,
- re-index,
- manage relationships.

## 8.4 My Work

Purpose:

Provide one simple place for work that belongs to the user.

My Work aggregates backend entities but presents them as business work items.

Examples:

### Expense reimbursement exception

Status:

**Waiting for manager review**

Progress:

- Request submitted
- Manager review
- Complete

### Access review clarification

Status:

**Needs your input**

Reason:

Two authoritative sources contain different review frequencies.

Action:

**Review sources**

My Work may internally read from:

- Case
- WorkflowRun
- Task
- Approval
- Evidence requirement

but those are not the primary user vocabulary.

## 8.5 Reviews / Approvals

Purpose:

Show items requiring human judgment or authority.

Each review should show before decision actions:

- what is being requested,
- requester,
- relevant evidence,
- source,
- reliability result,
- reason review is required,
- impact/context.

Actions may include:

- Approve
- Reject
- Request More Information
- Escalate
- Override with mandatory reason where authorized.

## 8.6 Domain Workspaces

Domain-specific experiences should appear as business-language entry points, not generic workflow consoles.

Examples:

- Regulatory Review
- Investment Analysis
- Audit Review
- Operations Review

---

# 9. Internal Platform Model vs User Experience

The following backend/domain concepts remain valid:

- Case
- WorkflowDefinition
- WorkflowRun
- WorkflowStep
- Task
- Approval
- GuardResult
- EvidenceItem
- AuditEvent

These concepts should not automatically become top-level navigation labels.

Mapping:

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

Internal API/database names do not need to be renamed solely for UX reasons.

Frontend adapters/view models may translate internal entities into user-facing business language.

---

# 10. Generative Workspace

SuperFlow uses a **Chat Plus** interaction model.

Natural language captures intent.

The main workspace renders structured, context-specific components.

Examples:

## SOP / Policy Question

Render:

- AnswerCard
- SourcePanel
- EvidenceChecklist
- suggested next action

## Regulation Review

Render:

- ComparisonTable
- impacted SOP list
- gap checklist
- review action
- remediation progress

## Investment Analysis

Render:

- assumptions
- source-backed values
- financial analysis
- sensitivity
- approval/review action

## Approval

Render:

- evidence context
- source context
- reliability
- ApprovalPanel

The AI must not generate arbitrary HTML for workflow-critical UI.

---

# 11. Controlled Component Catalog

Approved controlled components:

- AnswerCard
- SourcePanel
- EvidenceChecklist
- ComparisonTable
- FinancialAnalysis
- ApprovalPanel
- WorkflowTimeline / ProgressTimeline
- WorkItemCard / WorkItemRow
- ReviewPanel

Unknown component types must fail safely.

AI may select:

- component type,
- structured data,
- allowed action request.

Backend rules remain authoritative for:

- permissions,
- reliability,
- workflow transitions,
- approvals,
- financial calculations.

---

# 12. Experience A — Employee Knowledge Assistant

This is the simplest and most relatable entry point.

Flow:

1. Employee asks a question.
2. System retrieves authorized sources.
3. System generates a source-grounded answer.
4. SuperFlow Guard evaluates reliability.
5. Answer + source + version + reliability are shown.
6. If no further work is required, user is done.
7. If a process is required, show a contextual action such as:
   - Submit request
   - Request exception
   - Start review
   - Provide evidence
8. Backend may create a Case/Workflow, but UI presents the resulting work in business language.
9. Work appears in My Work.

Example:

Question:

“Can I reimburse an expense without a receipt?”

Result:

- policy answer,
- supporting source,
- reliability result,
- missing exception approval.

Action:

**Request Exception**

After action:

**Expense reimbursement exception — Waiting for manager review**

The user does not need to manually navigate to Cases or Workflows.

---

# 13. Experience B — Regulation-to-Action

This is the primary banking-context differentiator.

Flow:

1. Compliance user opens Regulatory Review.
2. User uploads/selects a new regulation.
3. System finds previous version.
4. AI creates structured comparison.
5. Material changes are identified.
6. Related SOPs/controls are retrieved.
7. System proposes gaps.
8. Human reviewer confirms, edits, or rejects findings.
9. Confirmed gaps become remediation work.
10. Owners and target dates are assigned.
11. Approvals are requested where required.
12. Progress appears in My Work / Regulatory Review.

User-facing language:

- Change
- Impact
- Gap
- Remediation
- Owner
- Due date
- Review
- Approval

Avoid exposing:

- workflow node,
- state-machine condition,
- case engine terminology.

---

# 14. Experience C — Investment Intelligence

Flow:

1. Finance user opens Investment Analysis.
2. User uploads/selects:
   - proposal,
   - budget,
   - vendor quotation,
   - cash-flow projection,
   - approval policy.
3. AI extracts assumptions and source values.
4. Conflicts are surfaced.
5. Deterministic calculation engine computes:
   - NPV,
   - IRR,
   - ROI,
   - payback,
   - break-even,
   - sensitivity.
6. SuperFlow renders analysis with source, unit, period, and formula.
7. Draft memo is created.
8. Reviewer inspects evidence.
9. Approval proceeds through Reviews / Approvals.

The user should see an analysis experience, not a generic Case/Workflow console.

---

# 15. Future Experience — AML/FIU Proof Point

AML/FIU remains a proof point, not the identity of SuperFlow.

Possible experience:

**Investigation Review**

Flow:

- alert/evidence arrives,
- permitted internal knowledge is retrieved,
- required evidence is collected,
- Guard evaluates completeness/conflicts,
- complete case proceeds to analyst,
- missing/conflicting case stops or requests review,
- human decision is recorded,
- audit trail is retained.

Do not make AML/FIU the default navigation or product framing.

---

# 16. SuperFlow Guard — Reliability Layer

SuperFlow Guard remains a central product capability.

Every relevant answer/action should evaluate applicable checks such as:

- citation coverage,
- source validity,
- source authority,
- current/outdated status,
- permission validity,
- evidence completeness,
- conflict detection,
- calculation validity where applicable,
- workflow risk,
- human approval requirement.

Canonical states:

- VERIFIED
- REVIEW_REQUIRED
- BLOCKED
- OUTDATED
- ACCESS_RESTRICTED

These statuses are user-visible only where useful.

Reliability should be understandable, not visually overwhelming.

Do not add fake confidence percentages.

---

# 17. Reliability Semantics

## VERIFIED

Means:

- current source,
- evidence sufficient,
- permission valid,
- no material conflict.

Does not mean:

- 100% AI accuracy,
- automatic business approval,
- authority to execute material actions.

## REVIEW_REQUIRED

Means:

- conflict,
- ambiguity,
- exception,
- assumption,
- or risk needs human judgment.

## BLOCKED

Means:

- mandatory evidence/prerequisite missing.

## OUTDATED

Means:

- source is historical/superseded.

## ACCESS_RESTRICTED

Means:

- user is not authorized.

Restricted content must not be exposed.

---

# 18. Knowledge Architecture

Supported source types include:

- SOP,
- regulation,
- policy,
- approval authority,
- financial statement,
- investment proposal,
- vendor quotation,
- control matrix,
- operational documents.

Knowledge capabilities:

- PDF/DOCX/TXT/Markdown parsing,
- structure extraction,
- metadata,
- versioning,
- effective dates,
- relationships,
- access controls,
- chunking,
- retrieval,
- citation.

Future enhancements may include:

- OCR,
- embeddings,
- hybrid semantic retrieval,
- reranking.

---

# 19. Retrieval Architecture

Retrieval should support:

- keyword search,
- semantic/vector search when implemented,
- metadata filtering,
- permission filtering,
- source authority weighting,
- reranking,
- citation generation.

Citations must correspond to actual retrieved source/chunk records.

Never create fake citations.

---

# 20. Controlled Action Architecture

The existing Phase 3 backend remains valid.

Internal Case/Workflow architecture supports controlled action.

Required internal concepts:

- Case
- WorkflowDefinition
- WorkflowRun
- WorkflowStep
- Task
- Approval
- Transition
- Retry
- Fallback
- Escalation

These are implementation concepts.

The user-facing experience should present:

- work item,
- progress,
- current step,
- required action,
- review,
- approval,
- evidence needed.

---

# 21. Human Decision Layer

Material actions remain under human authority.

Supported decisions:

- Approve
- Reject
- Request More Information
- Escalate
- Edit where appropriate
- Override with mandatory reason where authorized

Evidence and source context must appear before decision controls.

No self-approval for material review where independence is required.

All material decisions create audit events.

---

# 22. Audit

Append-only audit events should capture material actions such as:

- question,
- retrieval,
- answer,
- Guard result,
- work creation,
- workflow transition,
- evidence addition,
- task completion,
- approval,
- rejection,
- request for information,
- escalation,
- override,
- completion.

Audit is primarily a governance/control capability.

Ordinary users may see a human-readable activity timeline rather than raw event records.

---

# 23. Analytics and Business Impact

Business impact should be structured around QCD.

## Quality

- citation coverage,
- verified result rate,
- detected conflicts,
- rework,
- outdated-source usage avoided.

## Cost / Capacity

- manual effort,
- hours released,
- cost per work item,
- capacity released,
- illustrative cost avoidance.

## Delivery

- answer time,
- process cycle time,
- backlog,
- throughput,
- completion,
- escalation.

Prototype financial values must be labelled:

**Illustrative simulation**

Do not present productivity/soft-dollar value as realized profit.

---

# 24. UX Requirements

1. UI must feel like an enterprise workspace, not a generic chatbot.
2. User-facing navigation must be task-oriented.
3. Internal backend nouns must not dominate ordinary user navigation.
4. Reliability must be visible where relevant.
5. Citations must be inspectable.
6. Users should understand why something is Verified, Review Required, or Blocked.
7. A user should move from answer to action without deciding which backend module to open.
8. My Work should aggregate relevant backend execution state.
9. Reviews/Approvals should be role-aware.
10. Domain experiences should use domain language.
11. Technical detail should use progressive disclosure.
12. No development labels such as:
    - Phase 0–3
    - WorkflowDefinition
    - GuardResult ID
    - internal revision counters
    unless in developer/admin tooling.
13. Dynamic UI must come from approved component types.
14. Workflow-critical UI must not rely on arbitrary AI-generated HTML.

---

# 25. Role-Aware Navigation Rules

Navigation is not globally identical for every role.

## Employee

- Home
- Ask SuperFlow
- Knowledge
- My Work

## Manager

- Home
- Ask SuperFlow
- Knowledge
- My Work
- Reviews / Approvals

## SME

- Home
- Ask SuperFlow
- Knowledge
- My Work
- Reviews

## Compliance

- Home
- Ask SuperFlow
- Knowledge
- Regulatory Review
- My Work
- Reviews / Approvals

## Finance

- Home
- Ask SuperFlow
- Knowledge
- Investment Analysis
- My Work
- Reviews / Approvals

## Governance Administrator

- Home
- Knowledge
- My Work
- Reviews / Approvals
- Governance

Routes may still use internal path names during prototype implementation.

Visible labels must follow the user mental model.

---

# 26. Home Experience

Home should be contextual.

Employee:

- Ask SuperFlow
- work requiring input
- recent questions
- recently relevant/updated knowledge

Manager:

- Ask SuperFlow
- reviews requiring attention
- team work needing decision
- relevant knowledge updates

Compliance:

- regulatory reviews requiring attention
- new regulation changes
- remediation items
- Ask SuperFlow

Finance:

- analyses requiring attention
- pending reviews
- Ask SuperFlow

Do not show fake KPI cards.

Show counts only when backed by real state.

---

# 27. My Work Experience

My Work is the primary user-facing abstraction over Case/Workflow/Task.

A work item should show:

- title,
- business type,
- current status,
- current/next action,
- owner/reviewer if useful,
- due date if useful,
- reliability indicator if material,
- progress,
- last update.

Example:

**Expense reimbursement exception**

Waiting for manager review

Progress:

- Submitted
- Manager review
- Complete

Avoid displaying:

- Case ID as primary title,
- WorkflowRun ID,
- node type,
- transition key,
- database status codes.

Technical IDs may exist in secondary metadata.

---

# 28. Reviews / Approvals Experience

Review queue should be designed around decisions, not the Approval entity.

Each item should answer:

- What am I reviewing?
- Who requested it?
- Why does it need review?
- What evidence supports it?
- What does SuperFlow think about reliability?
- What actions am I allowed to take?

Actions:

- Approve
- Reject
- Request More Information
- Escalate
- Override where authorized

---

# 29. Governance Experience

Governance is role-gated.

It may include:

- roles/access,
- source authority,
- document lifecycle,
- source health,
- audit viewer,
- model/prompt policy metadata,
- retention,
- quality controls.

Do not expose Governance to ordinary users.

Governance Administrator is not a government role.

---

# 30. Technical Stack

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- controlled component registry

Backend:

- FastAPI
- Python
- Pydantic
- SQLAlchemy
- Alembic

Storage:

- PostgreSQL
- document storage
- pgvector when useful

AI:

- provider abstraction
- structured output
- mock/deterministic provider support
- optional real LLM provider

Critical calculations remain deterministic.

---

# 31. Existing Implementation Baseline

PRD v2 assumes the current prototype already contains Phase 0–3 foundations.

## Phase 0 — Skeleton

Implemented foundation:

- frontend/backend structure,
- PostgreSQL,
- migrations,
- synthetic users,
- app shell,
- mock role switching.

## Phase 1 — Knowledge Core

Implemented:

- Knowledge Hub,
- upload/parsing,
- metadata,
- versioning,
- retrieval,
- Ask SuperFlow,
- citations,
- SourcePanel.

## Phase 2 — Reliability Core

Implemented:

- SuperFlow Guard,
- evidence checks,
- five canonical statuses,
- conflict handling,
- reliability persistence,
- audit foundation.

## Phase 3 — Controlled Action Core

Implemented internally:

- Case,
- WorkflowDefinition / WorkflowRun,
- Task,
- retry/fallback/escalation,
- Approval,
- Decision Center backend,
- audit integration.

PRD v2 does NOT ask to discard these systems.

It asks to reconcile the user experience so that internal architecture is not exposed as the primary mental model.

---

# 32. Product Experience Reconciliation Phase

Before Phase 4, perform a dedicated reconciliation pass.

Goals:

1. Replace architecture-oriented navigation with task-oriented navigation.
2. Introduce My Work.
3. Rename Decision Center user-facing experience to Reviews / Approvals.
4. Remove standalone Workflows navigation for ordinary users.
5. Remove standalone Cases navigation for ordinary users.
6. Keep internal routes/models where practical.
7. Translate workflow state into human-readable progress.
8. Remove development labels such as “Phase 0–3.”
9. Add role-aware navigation.
10. Preserve all Phase 0–3 backend behavior and tests.

Do not rename database models merely for UI wording.

---

# 33. Phase 4 — Regulation-to-Action

After reconciliation:

Build Regulatory Review as the first flagship domain experience.

Deliver:

- new vs old regulation comparison,
- material change identification,
- related SOP/control mapping,
- proposed gap assessment,
- human review,
- remediation work,
- owner and due date,
- approval when needed.

User-facing experience should be Regulatory Review.

Internally it may use Case + Workflow + Task + Approval.

---

# 34. Phase 5 — Investment Intelligence

Deliver:

- proposal/quotation ingestion,
- assumption extraction,
- source-backed values,
- deterministic NPV,
- IRR,
- ROI,
- payback,
- break-even,
- sensitivity,
- draft memo,
- approval.

User-facing experience should be Investment Analysis.

Internally it may use the same shared platform foundation.

---

# 35. Phase 6 — Analytics

Deliver QCD impact:

- Quality
- Cost / Capacity
- Delivery

Do not expose fake savings.

All prototype financial values must be clearly illustrative.

---

# 36. Phase 7 — AML/FIU Proof Point

Optional extension.

Use the shared foundation.

Do not reposition product around AML/FIU.

---

# 37. Phase 8 — Demo Polish

Deliver:

- deterministic reset,
- stable demo route,
- realistic synthetic content,
- presentation-ready data,
- responsive cleanup,
- final accessibility pass,
- integrated story.

---

# 38. Demo Story

The demo should prove one coherent platform.

Recommended story:

1. Employee asks a policy/regulation question.
2. Answer shows source, version, and reliability.
3. Contextual action starts work without forcing the user to choose “Case” or “Workflow.”
4. Compliance opens Regulatory Review.
5. New regulation is compared with old.
6. SOP impact and gaps are shown.
7. Confirmed gaps become remediation work.
8. Finance uses the same platform for investment analysis if included.
9. Reviewer sees evidence before approval.
10. Audit and business impact show control and measurable value.

---

# 39. Non-Goals

The prototype does not require:

- production banking integrations,
- production SSO,
- autonomous final compliance decisions,
- autonomous final investment decisions,
- autonomous policy modification,
- full visual workflow builder,
- deep coverage of every division,
- 100% AI accuracy claims,
- production-grade WORM audit,
- full scheduler/notification platform.

---

# 40. Definition of Done

The hackathon prototype is demo-ready when:

1. At least two user roles see different relevant experiences.
2. Ask SuperFlow returns source-grounded results.
3. Reliability state is explicit and understandable.
4. Restricted source content is not leaked.
5. Outdated source is identified.
6. Missing/conflicting evidence can stop or route work safely.
7. User can move from answer to a meaningful next action.
8. Resulting work appears in My Work.
9. Reviewer can approve/reject/request more information.
10. Material actions create audit events.
11. Regulatory Review works end-to-end on seeded data.
12. Investment Analysis, if included, uses deterministic calculations.
13. Analytics shows at least one meaningful metric for Quality, Cost/Capacity, and Delivery.
14. Internal concepts such as Case/WorkflowRun are not required knowledge for ordinary users.
15. AML/FIU, if included, remains a proof point rather than the product identity.

---

# 41. Final Product Positioning

**SuperFlow is not another enterprise chatbot.**

It is a shared enterprise workspace that connects governed knowledge, AI reasoning, reliability controls, human authority, and execution.

The user should experience:

**Ask → Understand → Review → Act**

The platform internally supports:

**Retrieve → Guard → Case → Workflow → Approval → Audit**

Those internal mechanics should make the experience reliable, not make the experience harder to understand.
