# AGENTS.md — SuperFlow

## 1. Project Identity

SuperFlow is an **Enterprise Knowledge-to-Action Platform** for Superbank.

It is NOT:
- an AML/FIU-only product,
- a generic document chatbot,
- a ChatGPT wrapper,
- a pure RAG demo,
- or a collection of disconnected AI features.

SuperFlow turns governed enterprise knowledge into controlled, auditable, measurable action.

Core value chain:

**Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact**

Core interaction loop:

**Ask → Retrieve → Verify → Decide → Act → Measure**

AML/FIU is only one optional proof point / workflow running on the shared platform foundation.

---

## 2. Source of Truth

Before making product, architecture, UX, or implementation decisions, read:

1. `SuperFlow_PRD_v1.md`
2. `AGENTS.md`
3. `IMPLEMENTATION_STATUS.md`
4. Existing repository code and tests

Priority when instructions conflict:

1. Explicit task from the user
2. `SuperFlow_PRD_v1.md`
3. `AGENTS.md`
4. Existing implementation conventions
5. Reasonable engineering judgment

Do not silently change the product direction.

If a requested change conflicts with the PRD, implement the user-requested change but document the deviation in `IMPLEMENTATION_STATUS.md`.

---

## 3. Product Principles

All implementation decisions should preserve these principles:

### Source First
Material answers should be grounded in approved enterprise sources.

### Permission Aware
Permission checks happen before retrieval and before output.

Restricted information must never be retrieved and merely hidden in the frontend.

### Version Aware
Active/current documents must be preferred.

Outdated sources must be visibly identified and must not be treated as current authority.

### Evidence Before Conclusion
Material conclusions require sufficient supporting evidence.

### Human Authority
High-risk or material decisions remain under authorized human control.

### Knowledge Becomes Action
Knowledge should be convertible into:
- tasks,
- cases,
- approvals,
- checklists,
- remediation,
- workflows,
- structured analysis.

### Impact Is Measurable
The system should expose operational and business impact metrics.

---

## 4. Scope Discipline

Do not try to build every future SuperFlow feature at once.

Current implementation should follow the phases defined in `SuperFlow_PRD_v1.md`.

Default priority:

1. Foundation
2. Knowledge Core
3. Reliability / SuperFlow Guard
4. Cases + Workflow + Decision Center
5. Regulation-to-Action
6. Investment Intelligence
7. Analytics
8. Optional AML/FIU proof point
9. Demo polish

Do not start later phases unless the current task explicitly requests them.

Avoid scope creep.

---

## 5. Primary Product Modules

The application shell should support these main modules:

- Home
- Ask SuperFlow
- Knowledge Hub
- Cases
- Workflows
- Decision Center
- Analytics
- Governance

Supporting surfaces may be added when they clearly support the PRD.

---

## 6. Frontend Strategy

SuperFlow uses a **standard application frontend with Controlled Generative UI inside it**.

Do NOT choose between “frontend” and “generative UI”.

Use:

**Next.js application shell + controlled generative workspace**

The application shell remains deterministic.

Examples:
- sidebar,
- navigation,
- tables,
- filters,
- document pages,
- case pages,
- workflow pages,
- approval pages,
- governance settings.

The generative workspace may dynamically select approved UI components based on structured AI output.

AI should select:
- component type,
- structured data,
- allowed actions.

AI should NOT generate arbitrary HTML or arbitrary executable UI for workflow-critical surfaces.

---

## 7. Controlled Generative UI

Create and maintain a controlled component registry.

Initial approved component types:

- `AnswerCard`
- `SourcePanel`
- `ComparisonTable`
- `EvidenceChecklist`
- `FinancialAnalysis`
- `ApprovalPanel`
- `WorkflowTimeline`

Additional components may be added when:
1. the use case requires them,
2. the component is reusable,
3. the schema is explicit,
4. the frontend validates it before rendering.

Example structured payload:

```json
{
  "components": [
    {
      "type": "answer_card",
      "data": {}
    },
    {
      "type": "source_panel",
      "data": {}
    }
  ]
}
```

Unknown component types must fail safely.

Do not let arbitrary model output directly become DOM, HTML, JavaScript, or workflow actions.

---

## 8. 21st.dev UI Component Strategy

21st.dev is an approved **UI inspiration and reusable component source** for this project when access is available through the user's configured tool, MCP, CLI, skill, or connector.

21st.dev is NOT a source of business logic.

### Required Search Order

Before creating a new reusable presentation component:

1. Check existing project components.
2. Check existing design primitives.
3. Search 21st.dev for a relevant component if 21st.dev access is available.
4. Inspect candidate code and dependencies.
5. Reuse or adapt the best candidate.
6. Build from scratch only when no suitable existing component exists.

Do not block development if 21st.dev is unavailable.

### Good Uses of 21st.dev

Prefer 21st.dev for reusable presentation patterns such as:

- sidebars,
- command/search interfaces,
- AI composer/chat input,
- cards,
- KPI cards,
- tables,
- tabs,
- status badges,
- dialogs,
- drawers,
- file upload interfaces,
- timelines,
- step indicators,
- activity feeds,
- charts,
- document cards,
- dashboard layouts,
- empty states,
- loading states,
- error states.

### Do Not Outsource These to 21st.dev

Never use third-party UI code as the source of truth for:

- permissions,
- authorization,
- reliability decisions,
- SuperFlow Guard logic,
- evidence completeness,
- document version selection,
- workflow state transitions,
- approval authority,
- audit logic,
- financial calculations,
- backend validation,
- security logic.

### Component Review Checklist

Before adopting a 21st.dev component:

- inspect its source,
- inspect dependencies,
- remove unnecessary packages,
- verify TypeScript compatibility,
- verify Tailwind compatibility,
- verify accessibility,
- verify keyboard behavior,
- verify responsive behavior,
- verify dark/light behavior if relevant,
- remove unrelated marketing/demo content,
- replace placeholder text,
- adapt styles to SuperFlow tokens,
- ensure it does not introduce conflicting design systems.

### Avoid UI Frankenstein

Do not install many visually unrelated components from different authors without normalization.

Every imported component must be restyled to the SuperFlow visual system.

Prefer a small number of reusable primitives over dozens of one-off components.

---

## 9. SuperFlow Design Direction

SuperFlow should feel like a modern enterprise banking operating workspace.

Desired qualities:

- professional,
- calm,
- trustworthy,
- modern,
- structured,
- information-dense without being cluttered,
- highly legible,
- enterprise-oriented,
- AI-native without looking gimmicky.

Preferred visual direction:

- dark navy / deep neutral foundation,
- white / light surfaces where useful,
- restrained lime/green accents,
- muted borders,
- clear hierarchy,
- subtle shadows,
- consistent radius,
- restrained animation.

Avoid:

- crypto aesthetics,
- excessive neon,
- excessive gradients,
- gaming UI,
- overly playful consumer UI,
- glassmorphism everywhere,
- huge marketing hero sections inside the product,
- excessive motion,
- arbitrary 3D effects,
- visual noise.

---

## 10. Design Tokens

Keep central design tokens rather than styling every component independently.

At minimum define:

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

- spacing scale,
- radius scale,
- typography scale,
- shadow scale,
- z-index conventions.

Do not hardcode random colors repeatedly.

---

## 11. Accessibility

All user-facing UI should support:

- keyboard navigation,
- visible focus states,
- semantic HTML,
- labels for interactive controls,
- accessible dialogs,
- readable contrast,
- meaningful loading states,
- meaningful error messages.

Do not sacrifice accessibility for visual effects.

---

## 12. Frontend Engineering Conventions

Preferred stack:

- Next.js
- App Router
- TypeScript
- React
- Tailwind CSS

Use the existing project conventions where they are sound.

Rules:

- keep components small,
- separate data fetching from presentation where practical,
- avoid giant page components,
- do not place important business logic inside React components,
- centralize API clients,
- centralize schemas/types,
- use typed server responses,
- validate generative UI payloads,
- prefer reusable primitives,
- avoid duplicated permission logic,
- avoid duplicated status mappings.

If a state belongs to the backend, do not reconstruct it independently in the frontend.

---

## 13. Backend Engineering Conventions

Preferred stack:

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic

Database:

- PostgreSQL
- pgvector if useful and practical

Backend responsibilities include:

- permission enforcement,
- document/version authority,
- retrieval,
- citation source resolution,
- case state,
- workflow state,
- SuperFlow Guard,
- approvals,
- deterministic finance,
- audit events,
- analytics calculations.

Do not rely on frontend-only enforcement for critical rules.

---

## 14. AI Provider Architecture

Do not tightly couple the application to one LLM vendor.

Use abstractions such as:

- `LLMProvider`
- `EmbeddingProvider`
- `Retriever`

Support:
- deterministic/mock demo provider,
- optional real provider configured using environment variables.

The product must remain demoable when no paid external AI credential exists.

Never commit API keys.

---

## 15. Allowed AI Responsibilities

AI may assist with:

- intent classification,
- grounded question answering,
- summarization,
- structured extraction,
- regulation comparison,
- gap suggestion,
- document comparison,
- assumption extraction,
- draft memo generation,
- suggested next action.

AI must NOT independently control:

- permission rules,
- final compliance decisions,
- final investment approvals,
- financial formulas,
- authorization decisions,
- restricted data exposure,
- final material approvals.

Critical decisions belong to deterministic rules and/or authorized humans.

---

## 16. SuperFlow Guard

SuperFlow Guard is a core product capability.

Do not treat reliability as a visual badge only.

Guard logic should evaluate explicit checks such as:

- citation coverage,
- source validity,
- source authority,
- active/outdated source state,
- permission validity,
- evidence completeness,
- material conflict detection,
- calculation validity,
- workflow risk,
- human approval requirement.

Guard results should be structured and persisted where appropriate.

---

## 17. Reliability States

Use these user-visible reliability states consistently:

### VERIFIED
Meaning:
- source is valid,
- source is current,
- evidence is sufficient,
- permission is valid,
- no material conflict exists.

### REVIEW REQUIRED
Meaning:
- ambiguity,
- conflict,
- assumption,
- exception,
- or material risk requires human judgment.

### BLOCKED
Meaning:
- mandatory evidence,
- prerequisite,
- or required data is missing.

### OUTDATED
Meaning:
- source has been superseded or is no longer current.

### ACCESS RESTRICTED
Meaning:
- current user is not authorized to access the source/content.

Do not invent additional equivalent labels without a clear reason.

Centralize status mapping.

---

## 18. Permission Model

Seeded roles may include:

- Employee
- Manager
- SME
- Compliance
- Finance
- Governance Admin

Permission checks must occur:

1. before retrieval,
2. before returning source content,
3. before workflow actions where relevant.

Do not retrieve restricted documents and rely on the frontend to hide them.

Write tests proving restricted data does not leak.

---

## 19. Knowledge and Documents

The knowledge model should support:

- title,
- domain,
- owner,
- authority level,
- allowed roles,
- version,
- effective date,
- status,
- active/outdated relationship,
- file identity/checksum,
- source hierarchy,
- related documents.

Document processing should support:

- PDF,
- DOCX,
- metadata,
- semantic section extraction where practical,
- structured chunking.

Prefer structure-aware chunking over arbitrary fixed-size character splits when possible.

---

## 20. Retrieval

Retrieval should support an abstraction for:

- keyword search,
- vector/semantic retrieval,
- metadata filtering,
- permission filtering,
- source authority weighting,
- reranking,
- citation generation.

A citation must correspond to an actual retrieved source/chunk.

Never create fake citations.

---

## 21. Case Model

Cases provide a shared workspace across domains.

A case may include:

- metadata,
- type/domain,
- owner,
- status,
- reliability status,
- sources,
- evidence,
- agent activity,
- tasks,
- workflow run,
- approvals,
- audit timeline.

Supported future domains include:

- regulatory review,
- investment analysis,
- audit,
- operations,
- AML/FIU.

Do not hardcode the entire case architecture specifically around AML.

---

## 22. Workflow Engine

Use a simple persistent state machine.

Required concepts:

- WorkflowDefinition
- WorkflowRun
- Step
- Task
- Condition
- Retry
- Fallback
- Escalation
- Approval

Workflow state must persist across page reloads.

Do not overengineer with large orchestration platforms unless explicitly required.

---

## 23. Human Decision Center

Material actions should be reviewable.

Supported actions:

- Approve
- Reject
- Request Evidence
- Edit where appropriate
- Escalate
- Override

Override must require a reason.

Evidence and source context must be visible before approval.

Human decisions must create audit events.

---

## 24. Financial Logic

Financial calculations must be deterministic.

Do NOT use free-form LLM arithmetic for:

- NPV
- IRR
- ROI
- payback period
- break-even
- sensitivity calculations

Use tested Python functions.

AI may extract candidate assumptions, but calculations use deterministic functions.

Expose:

- assumption,
- source,
- formula,
- unit,
- period,
- result.

Conflicting source values must be surfaced, not silently resolved.

---

## 25. Analytics

Organize business impact around QCD.

### Quality
Examples:
- citation coverage,
- verified answer rate,
- conflict detection,
- rework,
- outdated-source usage avoided.

### Cost / Capacity
Examples:
- manual effort,
- hours released,
- cost per case,
- capacity release,
- illustrative cost avoidance,
- illustrative annual benefit.

### Delivery
Examples:
- answer time,
- cycle time,
- backlog,
- throughput,
- completion rate,
- escalation rate.

Simulated financial values must be visibly labeled:

**Illustrative simulation**

Do not present productivity/soft-dollar value as realized profit.

---

## 26. Audit Trail

Audit events should be append-only where practical.

Capture:

- timestamp,
- actor,
- actor type,
- event type,
- entity type,
- entity ID,
- source IDs,
- agent action,
- tool action,
- guard result,
- workflow transition,
- human decision,
- override reason.

A reviewer should be able to reconstruct:

- what happened,
- who did it,
- what source was used,
- what the AI did,
- what the human decided.

---

## 27. Demo Data

Use synthetic/mock data only.

Do not use real customer data.

Seed deterministic scenarios that demonstrate:

- valid/current source,
- outdated source,
- restricted source,
- missing evidence,
- conflicting evidence,
- human approval requirement.

The application must be resettable to a known demo state.

---

## 28. Testing Requirements

Tests should cover meaningful behavior.

Backend unit tests should cover at least:

- permission enforcement,
- source version selection,
- reliability state selection,
- evidence completeness,
- conflict detection,
- financial calculations,
- audit event creation.

Integration/API tests should cover core flows.

Critical browser/E2E tests should include:

- Ask SuperFlow happy path,
- Access Restricted path,
- Regulation → Gap → Remediation,
- Finance → Analysis → Approval.

Do not add meaningless tests just to increase coverage numbers.

---

## 29. Error Handling

Build product-quality states for:

- no results,
- unavailable source,
- restricted source,
- outdated source,
- conflicting evidence,
- missing evidence,
- AI provider unavailable,
- document parsing failure,
- workflow failure,
- backend/network failure.

Never expose raw stack traces to end users.

---

## 30. Observability

For development and demo:

- use structured logs,
- use request IDs,
- use agent run IDs,
- use workflow run IDs where appropriate.

Make demo failures diagnosable.

---

## 31. Security

Rules:

- never commit secrets,
- never expose secret environment variables to browser code,
- backend owns permission enforcement,
- audit human overrides,
- validate inputs,
- use synthetic data,
- do not log sensitive content unnecessarily.

---

## 32. Repository Hygiene

Before introducing a dependency:

- verify it is needed,
- prefer existing dependency if suitable,
- avoid overlapping libraries solving the same problem,
- avoid large dependencies for tiny functionality.

Remove unused code and dead dependencies.

Do not leave abandoned experiment files in production paths.

---

## 33. Documentation

Maintain:

- `README.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_STATUS.md`

README should explain:

- what SuperFlow is,
- architecture,
- prerequisites,
- environment variables,
- installation,
- migrations,
- seeding,
- run commands,
- tests,
- demo users,
- demo flow,
- project structure,
- known prototype limitations.

---

## 34. Working Process

Before coding a requested phase:

1. Read `SuperFlow_PRD_v1.md`.
2. Read this `AGENTS.md`.
3. Inspect current repository state.
4. Read `IMPLEMENTATION_STATUS.md`.
5. Identify what already exists.
6. Reuse good implementation.
7. Implement the requested scope end-to-end.
8. Run relevant tests.
9. Fix failures.
10. Update `IMPLEMENTATION_STATUS.md`.

Do not stop after scaffolding unless the task explicitly asks only for scaffolding.

Do not ask for approval after every small change.

Do not start later product phases unless requested.

---

## 35. Implementation Status Rules

`IMPLEMENTATION_STATUS.md` should explicitly identify:

- Completed
- Partially Implemented
- Not Implemented
- Known Issues
- Blockers
- Recommended Next Step

Do not describe unfinished work as completed.

---

## 36. Definition of Done for a Feature

A feature is not done just because UI exists.

A feature is done when applicable items are satisfied:

- UI exists,
- backend exists,
- data persists,
- permissions work,
- loading state exists,
- empty state exists,
- error state exists,
- relevant reliability behavior exists,
- audit behavior exists,
- tests pass,
- documentation is updated.

---

## 37. Code Quality Rules

Prefer:

- explicit schemas,
- typed contracts,
- small modules,
- reusable components,
- deterministic critical logic,
- provider abstractions,
- clear naming,
- clear data ownership.

Avoid:

- giant React components,
- giant service files,
- magic strings,
- duplicated status values,
- duplicated authorization logic,
- hidden frontend business rules,
- fake backend behavior,
- fake citations,
- silent failure,
- unnecessary abstraction.

---

## 38. Final Verification Before Stopping

Before declaring a phase complete:

Run the relevant:

- formatter,
- linter,
- type checker,
- backend tests,
- frontend tests,
- critical E2E tests.

Then manually verify the requested flow.

For Knowledge Core / Reliability work, verify at minimum:

- role switching works,
- documents persist,
- current version selection works,
- citations point to real chunks,
- restricted source does not leak,
- outdated source is identified,
- reliability status behaves correctly,
- errors are handled,
- application still boots cleanly.

---

## 39. Product Framing Reminder

Never accidentally turn the project into:

“AML AI Assistant”

or:

“Enterprise Chatbot”

The intended product is:

**SuperFlow — Enterprise Knowledge-to-Action Platform**

The shared foundation should support multiple enterprise workflows.

AML/FIU is only an example proof point.

---

## 40. North Star

Every major product decision should support this statement:

> Trusted knowledge should not stop at an answer.  
> It should become controlled, auditable, measurable action.
