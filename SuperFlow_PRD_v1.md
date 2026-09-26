# SuperFlow — Product Requirements Document (PRD)

**Version:** 1.0 — Hackathon Prototype  
**Product:** SuperFlow  
**Category:** Enterprise Knowledge-to-Action Platform  
**Tagline:** From Trusted Knowledge to Measurable Action  
**Primary theme:** Making AI Agents Reliable: The Missing Layer between AI and Business

---

## 1. Product Summary

SuperFlow is an enterprise platform that turns governed company knowledge into verifiable answers, controlled actions, and measurable workflows.

The product is not a document chatbot and is not specific to AML/FIU. It provides one shared knowledge, reliability, workflow, human-decision, and analytics foundation that can support multiple enterprise domains such as employee self-service, compliance, finance, audit, operations, and AML/FIU.

The core product loop is:

**Ask → Retrieve → Verify → Decide → Act → Measure**

The core platform chain is:

**Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact**

SuperFlow’s key differentiator is the **Reliability Layer**. The system must not only produce an answer or take an action; it must determine whether the supporting source, version, permissions, evidence, and risk level are sufficient for the action to continue.

---

## 2. Problem Statement

Enterprise knowledge already exists across SOPs, regulations, policies, financial documents, operational documents, and internal references, but it is often fragmented across multiple systems and versions.

This creates several operational problems:

- Employees spend time searching for the correct source.
- Managers and subject matter experts repeatedly answer routine questions.
- Users may rely on outdated or conflicting documents.
- Answers may vary depending on who is asked.
- Knowledge often stops at “information” and does not directly become a task, approval, checklist, remediation, or workflow.
- Generic AI answers are difficult to trust in enterprise workflows without evidence, permission, versioning, escalation, and audit controls.
- Business impact from knowledge access and AI usage is difficult to measure.

SuperFlow addresses this gap by connecting trusted enterprise knowledge directly to controlled execution.

---

## 3. Product Goals

### 3.1 Primary Goals

1. Provide a single entry point for employees to ask questions, start cases, and work with enterprise knowledge.
2. Return answers that are traceable to approved sources.
3. Convert knowledge into controlled actions such as checklists, cases, approvals, remediation plans, analyses, and workflow steps.
4. Make AI behavior reliability-aware through source, version, permission, evidence, conflict, and risk checks.
5. Keep material decisions under human authority.
6. Record all important AI and user actions in an audit trail.
7. Measure operational and financial impact.
8. Demonstrate that the same platform foundation can support multiple business domains.

### 3.2 Hackathon Success Goal

Build a working prototype that proves:

- SuperFlow can answer from governed knowledge with citations.
- SuperFlow can detect when an answer/action is safe to continue versus when review is required.
- SuperFlow can create and progress a case/workflow.
- SuperFlow can render context-specific UI instead of only chat text.
- SuperFlow can demonstrate at least two connected enterprise workflows on one shared platform foundation.
- SuperFlow can show measurable prototype-level operational impact.

---

## 4. Non-Goals / Out of Scope for Prototype

The prototype will **not** include:

- Direct integration with production banking systems.
- Autonomous final compliance or investment decisions without human approval.
- Autonomous modification of approved SOPs or policies.
- Full visual drag-and-drop workflow builder.
- Deep implementation for every business division.
- Claims of 100% AI accuracy.
- Claims of realized financial savings using real Superbank production data unless validated data is provided.

---

## 5. Users and Roles

### 5.1 Employee

Needs quick answers, correct procedures, required documents, and next actions without repeatedly asking a manager.

### 5.2 Manager / Approver

Needs visibility into evidence, reliability status, workflow progress, exceptions, and approval requests.

### 5.3 Subject Matter Expert (SME)

Needs to maintain knowledge quality and focus on ambiguous or high-risk cases rather than routine questions.

### 5.4 Compliance User

Needs regulatory comparison, SOP impact mapping, gap assessment, remediation tracking, and human review.

### 5.5 Finance User

Needs proposal analysis, assumption extraction, deterministic financial calculations, scenarios, and decision-ready summaries.

### 5.6 Governance Administrator

Needs control over document versions, metadata, access permissions, source authority, retention, quality controls, and audit trails.

---

## 6. Product Principles

1. **Source First** — Material answers must be grounded in approved sources.
2. **Permission Aware** — Retrieval and output must respect user access.
3. **Version Aware** — Active documents must be prioritized; outdated ones must be clearly flagged.
4. **Evidence Before Conclusion** — Material conclusions require sufficient evidence.
5. **Human Authority** — High-risk decisions remain with authorized humans.
6. **Knowledge Becomes Action** — Answers should be able to become tasks, approvals, checklists, cases, or workflows.
7. **Impact Is Measurable** — Time, quality, capacity, cost, rework, backlog, and risk indicators should be measurable.
8. **Fail Safely** — When evidence is insufficient, conflicting, restricted, or outdated, the system must not silently proceed.

---

## 7. Information Architecture / Main Navigation

The application should expose the following primary modules:

### 7.1 Home

Purpose: show what requires the user’s attention.

Contents:

- Ask SuperFlow input
- Recent questions
- Open cases
- Pending approvals
- Workflow exceptions
- Deadlines / SLA alerts
- Quick actions

### 7.2 Ask SuperFlow

Purpose: source-grounded enterprise Q&A and intent entry point.

Capabilities:

- Natural language question input
- Domain / source filters
- Answer with citations
- Reliability status
- Suggested next action
- “Start workflow” / “Create case” action
- Open source panel

### 7.3 Knowledge Hub

Purpose: manage governed enterprise knowledge.

Capabilities:

- Upload PDF/DOCX
- Metadata management
- Domain classification
- Document owner
- Version number
- Effective date
- Active / outdated status
- Access role / permission
- Related-document mapping
- Re-index action
- Source health status

### 7.4 Cases

Purpose: unified workspace for regulatory review, investment analysis, AML/FIU, audit, and other processes.

Capabilities:

- Case metadata
- Case status
- Evidence checklist
- Agent activity timeline
- Tasks
- Sources
- Reliability checks
- Human review
- Approval state
- Related workflow

### 7.5 Workflows

Purpose: view reusable workflow templates and active workflow runs.

Capabilities:

- Workflow templates
- Current step
- Owner
- Status
- Retry
- Fallback
- Escalation
- Completion state

For the prototype, workflow definitions can be code-configured templates. A full visual workflow builder is not required.

### 7.6 Decision Center

Purpose: centralized review and approval queue.

Capabilities:

- Approve
- Reject
- Edit
- Request evidence
- Escalate
- Override with mandatory reason
- View source/evidence before decision

### 7.7 Analytics

Purpose: measure operational and financial impact.

Capabilities:

- Query volume
- Self-service rate
- Median answer time
- Cycle time
- Backlog
- Completion rate
- Escalation rate
- Rework
- Hours released
- Cost per case
- Avoided future hiring (illustrative)
- Annual benefit (illustrative)
- Risk indicators

### 7.8 Governance

Purpose: enterprise control plane.

Capabilities:

- Roles and permissions
- Source authority
- Document retention
- Model / prompt policy metadata
- Audit event viewer
- Knowledge health
- Quality controls

---

## 8. Generative Workspace

SuperFlow should use a **Chat Plus** interaction model:

- Chat is used to capture user intent.
- The main workspace renders structured, context-specific components.
- Sources and evidence are visible separately.
- Critical actions use controlled UI components, not arbitrary generated HTML.

### 8.1 Approved Component Catalog

The prototype should support these controlled components:

**Answer Card**  
Short answer, reliability status, key evidence, and suggested next action.

**Source Panel**  
Citation, title, version, effective date, owner, authority, and relevant excerpt.

**Comparison Table**  
Used for regulation versions, SOP versions, proposal comparisons, or other structured differences.

**Evidence Checklist**  
Shows required, available, missing, and conflicting evidence.

**Financial Analysis**  
Shows assumptions, formulas, NPV, IRR, ROI, payback, break-even, and sensitivity outputs.

**Approval Panel**  
Approve, reject, edit, request evidence, and override reason.

**Workflow Timeline**  
Shows workflow steps, owner, SLA, retry, escalation, and completion.

---

## 9. Core Platform Architecture

### 9.1 Knowledge Sources

Supported prototype sources:

- SOP
- Regulation
- Policy
- Financial statement
- Investment proposal
- Vendor quotation
- Approval policy
- Control matrix
- Operational documents

### 9.2 Knowledge Fabric

Required capabilities:

- PDF/DOCX parsing
- OCR when needed
- Structural extraction (title, section, article, table, appendix)
- Metadata extraction
- Semantic chunking
- Versioning
- Relationship mapping
- Access control metadata

### 9.3 Trusted Retrieval

Required capabilities:

- Keyword search
- Semantic/vector search
- Metadata filter
- Reranking
- Source authority weighting
- Citation generation

### 9.4 Intelligence Layer

Required capabilities:

- Question answering
- Summarization
- Extraction
- Document comparison
- Gap detection
- Assumption extraction
- Financial analysis orchestration

### 9.5 Workflow Engine

Required capabilities:

- Persistent case state
- Workflow state machine
- Task progression
- Conditional branches
- Tool execution
- Retry
- Fallback
- Escalation
- Approval
- Resumable steps

### 9.6 SuperFlow Guard — Reliability Layer

This is the central differentiating layer.

Every material answer/action should be evaluated against:

- Citation coverage
- Source validity
- Source authority
- Active/outdated version
- Permission
- Evidence completeness
- Conflicting sources
- Calculation validity
- Risk level
- Human approval requirement

### 9.7 Human Decision Layer

The system must support:

- Review
- Edit
- Approve
- Reject
- Request evidence
- Override with reason

### 9.8 Audit Layer

Append-only audit events must capture:

- User
- Timestamp
- Input
- Output
- Source IDs
- Agent action
- Tool action
- Guard result
- Workflow state change
- Human decision
- Override reason

---

## 10. Reliability Status Model

Every relevant answer or workflow step should have one of these statuses:

### Verified

Conditions:

- Active source
- Sufficient evidence
- No material conflict
- User is authorized

Behavior:

- Allow normal next action within user authority.

### Review Required

Conditions:

- Assumption exists
- Material conflict exists
- Risk requires judgment
- Confidence/evidence is insufficient for autonomous continuation

Behavior:

- Route to reviewer / SME.

### Blocked

Conditions:

- Mandatory evidence missing
- Critical prerequisite fails

Behavior:

- Stop action and request additional evidence/data.

### Outdated

Conditions:

- Source has been superseded or expired

Behavior:

- Do not treat source as current authority; surface active version.

### Access Restricted

Conditions:

- User is not authorized to access source

Behavior:

- Do not expose restricted source content; provide access-owner guidance only.

---

## 11. Primary User Flows

## 11.1 Flow A — Employee Knowledge Assistant

1. User asks a policy/SOP question.
2. System classifies intent.
3. Retrieval searches approved sources.
4. SuperFlow Guard checks permission, source authority, version, conflicts, and citation coverage.
5. System renders Answer Card + Source Panel.
6. If answer requires a process, user can create a case or start a workflow.
7. Audit event is written.

**Acceptance criteria:**

- Answer contains at least one valid citation when sources exist.
- Source version and status are visible.
- Restricted documents are not leaked.
- Missing evidence produces Review Required or Blocked instead of fabricated certainty.

---

## 11.2 Flow B — Regulation-to-Action

1. Governance/compliance user uploads a new regulation version.
2. System links it to the previous version.
3. AI generates a structured comparison.
4. Material changes are identified.
5. Related SOPs and controls are retrieved.
6. Gap assessment is created.
7. Reviewer confirms or edits findings.
8. System creates remediation tasks/case.
9. Owners and target dates are assigned.
10. Approval is requested when required.
11. Progress appears in workflow and analytics.

**Acceptance criteria:**

- Comparison clearly distinguishes previous vs new requirement.
- Every material finding links to supporting source sections.
- Gap findings can be accepted, edited, or rejected by a human reviewer.
- Approved gaps can generate remediation tasks.

---

## 11.3 Flow C — Investment Intelligence

1. User opens an investment case.
2. User uploads proposal, budget, quotations, cash-flow projection, and relevant approval policy.
3. AI extracts assumptions, values, period, unit, and risk notes.
4. System checks conflicts between documents.
5. Deterministic calculation functions compute:
   - NPV
   - IRR
   - ROI
   - Payback period
   - Break-even point
   - Sensitivity scenarios
6. SuperFlow renders Financial Analysis + Source Panel.
7. System generates a draft investment memo.
8. User reviews assumptions and formula details.
9. Decision Center routes approval to the appropriate reviewer/committee.

**Acceptance criteria:**

- Financial calculations are performed by deterministic code, not free-form LLM arithmetic.
- Every important number shows source, unit, and period.
- Conflicting figures are surfaced instead of silently resolved.
- Memo remains editable before approval.

---

## 11.4 Flow D — AML/FIU Proof Point (Demo / Stretch Use Case)

AML/FIU is an example of how the same platform foundation can support a high-stakes evidence workflow.

1. Case is opened.
2. Agent retrieves permitted internal knowledge and mock case evidence.
3. Agent collects required evidence according to workflow rules.
4. SuperFlow Guard validates completeness, permissions, source validity, and conflicts.
5. If complete, system prepares a structured case pack for analyst review.
6. If evidence is missing or conflicting, system sets Review Required / Blocked.
7. Analyst reviews and decides.
8. All actions are captured in the audit trail.

The prototype should ideally demo both:

- **Happy path:** sufficient evidence → Verified → human review.
- **Exception path:** missing/conflicting evidence → Review Required/Blocked → no unsafe continuation.

---

## 12. Prototype Seed Data

Create mock/synthetic data for repeatable demos:

- 2 versions of a mock OJK-style regulation with several material differences.
- 3 internal SOPs linked to regulation clauses.
- 1 approval authority policy.
- 2 investment proposals with different assumptions.
- 2 vendor quotations.
- 1 cash-flow projection dataset.
- Multiple user roles with different access permissions.
- Optional AML/FIU mock cases with complete and incomplete evidence scenarios.

No real customer data should be required for the hackathon prototype.

---

## 13. Recommended Technical Stack

This section converts the source architecture into an implementation-ready prototype plan.

### Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- Controlled component catalog for generative workspace
- Optional CopilotKit/OpenGenerativeUI integration for approved component rendering

### Backend

- Python FastAPI
- REST API
- Structured Pydantic schemas
- Agent orchestration service
- Workflow/state-machine service
- Reliability/Guard service
- Financial calculation service

### Storage

- PostgreSQL for users, metadata, cases, workflows, audit events, approvals, analytics snapshots
- Object storage/local S3-compatible storage for documents
- Vector store / pgvector for embeddings

### AI / Retrieval

- Provider adapter for LLM calls
- Structured outputs only for workflow-critical responses
- Prompt versioning
- Embedding model
- Hybrid keyword + semantic retrieval
- Reranking

### Document Processing

- PDF parser
- DOCX parser
- OCR fallback when required
- Structural metadata extraction
- Chunking by semantic document structure

---

## 14. Proposed Data Model

The following entities are implementation recommendations for the prototype.

### User

- id
- name
- email
- role_id
- department
- active

### Role

- id
- name
- permissions[]

### Document

- id
- title
- domain
- owner_id
- authority_level
- access_roles[]

### DocumentVersion

- id
- document_id
- version
- effective_date
- status: active | outdated | draft
- file_path
- checksum

### DocumentChunk

- id
- document_version_id
- section_path
- text
- embedding

### Case

- id
- type
- title
- status
- owner_id
- created_by
- reliability_status
- workflow_run_id

### Evidence

- id
- case_id
- type
- source_id
- required
- status
- conflict_group

### WorkflowDefinition

- id
- name
- domain
- version
- config_json

### WorkflowRun

- id
- definition_id
- case_id
- current_step
- status

### Task

- id
- workflow_run_id
- name
- owner_id
- status
- due_at

### Approval

- id
- case_id
- requested_from
- status
- decision_reason
- decided_at

### AgentRun

- id
- case_id
- intent
- prompt_version
- input_json
- output_json
- started_at
- completed_at

### GuardResult

- id
- agent_run_id
- source_valid
- version_valid
- permission_valid
- evidence_complete
- conflict_detected
- calculation_valid
- status
- reasons_json

### AuditEvent

- id
- actor_type
- actor_id
- event_type
- entity_type
- entity_id
- payload_json
- created_at

### FinancialAnalysis

- id
- case_id
- assumptions_json
- npv
- irr
- roi
- payback
- break_even
- sensitivity_json

---

## 15. Proposed API Surface

### Knowledge

- `POST /api/documents`
- `GET /api/documents`
- `GET /api/documents/{id}`
- `POST /api/documents/{id}/versions`
- `POST /api/documents/{id}/index`

### Ask SuperFlow

- `POST /api/ask`
- `GET /api/ask/{run_id}`
- `GET /api/ask/{run_id}/sources`

### Cases

- `POST /api/cases`
- `GET /api/cases`
- `GET /api/cases/{id}`
- `POST /api/cases/{id}/evidence`
- `POST /api/cases/{id}/run-agent`

### Workflow

- `POST /api/workflows/{template_id}/start`
- `POST /api/workflow-runs/{id}/advance`
- `POST /api/workflow-runs/{id}/retry`
- `POST /api/workflow-runs/{id}/escalate`

### Decisions

- `GET /api/approvals`
- `POST /api/approvals/{id}/approve`
- `POST /api/approvals/{id}/reject`
- `POST /api/approvals/{id}/request-evidence`
- `POST /api/approvals/{id}/override`

### Regulatory

- `POST /api/regulatory/compare`
- `POST /api/regulatory/gap-assessment`
- `POST /api/regulatory/create-remediation`

### Finance

- `POST /api/finance/extract-assumptions`
- `POST /api/finance/calculate`
- `POST /api/finance/generate-memo`

### Analytics

- `GET /api/analytics/overview`
- `GET /api/analytics/qcd`
- `GET /api/analytics/value`

### Governance / Audit

- `GET /api/audit`
- `GET /api/governance/source-health`
- `GET /api/governance/roles`

---

## 16. Analytics and Business Impact

### 16.1 Adoption

- Monthly active users
- Query volume
- Workflow runs

### 16.2 Knowledge Access

- Median answer time
- Successful self-service rate
- Query deflection

### 16.3 Quality

- Citation coverage
- Verified answer rate
- Conflict detection
- Rework rate
- Outdated-source usage avoided

### 16.4 Workflow / Delivery

- Cycle time
- Backlog
- Completion rate
- Escalation rate
- Cases per period

### 16.5 Cost / Capacity

- Hours released
- Manual effort per case
- Cost per case
- Avoided future hiring (illustrative)
- Annual benefit (illustrative)

### 16.6 Prototype Financial Model

`Annual Hours Released = Annual Volume × Average Time Saved per Activity`

Financial interpretation must distinguish:

- Productivity / soft-dollar value
- Capacity release
- Cost avoidance
- Hard-dollar savings

Prototype numbers must be labelled as **illustrative simulation** unless validated real data is provided.

---

## 17. Security, Governance, and Safety Requirements

1. Permission filtering must happen before retrieval and before output rendering.
2. Restricted source contents must never be exposed to unauthorized users.
3. Critical calculations must use deterministic functions.
4. Material actions must be auditable.
5. High-risk workflow steps require human approval.
6. The system must show when it cannot safely answer or continue.
7. Active document versions must be distinguishable from outdated versions.
8. Every override must require a reason.
9. Prototype data should be synthetic/mock unless approved internal data is explicitly provided.

---

## 18. UX Requirements

- UI should feel like an enterprise workspace, not a consumer chatbot.
- Reliability status must be visible but not dominate every screen.
- Citations should be directly inspectable.
- User should understand “why” a result is Verified, Review Required, or Blocked.
- The user should be able to move from answer → case → workflow without leaving the platform conceptually.
- Approvals must expose the relevant evidence before the decision buttons.
- Dynamic UI is allowed only from approved component types.
- Workflow-critical UI must not rely on arbitrary AI-generated HTML.

---

## 19. Demo Script Requirements

The final hackathon demo should prove the platform rather than one isolated feature.

Recommended sequence:

1. Ask SuperFlow a policy/regulation question.
2. Show answer + citation + active version + reliability status.
3. Start a regulation review case from the answer.
4. Compare regulation versions.
5. Show SOP impact and gap assessment.
6. Create remediation workflow.
7. Open an investment case connected to remediation.
8. Show deterministic financial analysis and source-backed assumptions.
9. Send decision to Decision Center.
10. Show audit trail and impact analytics.
11. Optionally show AML/FIU exception case as proof that the same reliability layer can stop unsafe continuation.

---

## 20. Development Phases

### Phase 0 — Skeleton

- App shell
- Navigation
- Mock authentication / roles
- PostgreSQL schema
- Seed data

### Phase 1 — Knowledge Core

- Document upload
- Metadata + versioning
- Parsing + chunking
- Retrieval
- Ask SuperFlow
- Citation + source panel

### Phase 2 — Reliability Core

- Permission checks
- Version checks
- Citation coverage
- Evidence status
- Conflict detection
- Reliability statuses
- Audit events

### Phase 3 — Workflow Core

- Case workspace
- Workflow templates
- Tasks
- Retry/escalation
- Decision Center
- Approval actions

### Phase 4 — Regulation-to-Action

- Regulation comparison
- SOP mapping
- Gap assessment
- Remediation workflow

### Phase 5 — Investment Intelligence

- Proposal/quotation ingestion
- Assumption extraction
- Deterministic calculations
- Sensitivity
- Draft memo
- Approval

### Phase 6 — Analytics

- QCD dashboard
- Hours released
- Cost/capacity model
- Audit visualization

### Phase 7 — AML/FIU Demo Extension

- Mock evidence workflow
- Complete case
- Missing/conflicting evidence case
- Human escalation

### Phase 8 — Polish

- Demo seed/reset
- Loading/error states
- Responsive UI
- Presentation-friendly data
- Stable demo route

---

## 21. Definition of Done — Hackathon Prototype

The prototype is considered demo-ready when:

1. A user can log in as at least two roles with different access.
2. A document can be uploaded with metadata and version status.
3. Ask SuperFlow returns a source-grounded response.
4. A restricted source cannot be exposed to an unauthorized role.
5. An outdated source is visibly flagged.
6. A conflicting/missing evidence scenario can produce Review Required or Blocked.
7. A user can create/open a case and progress a workflow.
8. A reviewer can approve/reject/request evidence.
9. Every material action creates an audit event.
10. Regulation comparison and gap assessment work on seeded demo data.
11. Investment analysis uses deterministic calculations.
12. Analytics dashboard displays at least one metric each for Quality, Cost/Capacity, and Delivery.
13. The demo can be reset to a known state.
14. AML/FIU, if included, is presented as one reusable proof point rather than the identity of the platform.

---

## 22. Final Product Positioning

**SuperFlow is not another enterprise chatbot.**

It is a shared enterprise layer that connects governed knowledge, AI reasoning, reliability controls, human authority, and workflow execution.

The product promise is:

> **Trusted knowledge should not stop at an answer. It should become controlled, auditable, measurable action.**
