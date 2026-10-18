# Ask conversations and Superbank identity

At the user's explicit request, Ask now uses a conversation interface: a wide,
multiline composer, separate saved sessions, follow-ups, search and rename.
This is a deliberate exception to the PRD's default non-chat layout guidance;
SuperFlow's tabs, evidence cards, Guard, domain workspaces and controlled actions remain.

## Storage and execution

Migration `0012` adds owner-scoped `chat_sessions` and ordered `chat_turns` without
rewriting existing answers or the knowledge index. `/api/chats` lists/creates sessions;
`/{id}` reads/renames; `/{id}/turns` queues a message; `/{id}/turns/{turn}` polls it.
`/from-answer/{run}` continues a legacy knowledge answer in a new chat. Case context
answers cannot be imported through this endpoint. Every endpoint rechecks ownership.

Turns persist before dispatch to the existing single local worker shared with WebSearch.
One pending chat reply per user preserves ordering and bounds local resource usage.
Server-reported stages, messages and timestamps persist separately from the generation
transaction, so reload can resume polling and completed replies retain process history.
These are operational steps, not hidden model reasoning or estimated percentages.
Interrupted turns explicitly fail after an API restart rather than replaying model/browser calls.

Follow-ups use up to four preceding completed knowledge replies. Their citations and
permissions are rechecked before any dialogue enters AI context. Fresh retrieval uses
the selected scope, prior question/source titles and current question; the model must cite
only newly retrieved, authorized evidence. Revoked evidence blocks reuse and is redacted
when reopening history. Earlier dialogue is untrusted context, not new source authority.
Sources and web snapshots retain their existing provenance and isolation rules.

Numeric citation markers are stripped from earlier dialogue and generated prose; the
validated structured `citation_id` supplies the single clickable reference per paragraph.
Saved Ollama replies receive the same presentation cleanup without changing the stored
original answer or deterministic source extracts. Source selection still requires review;
format validation is not a semantic accuracy guarantee.

The backend resolves approved domain workspaces and reauthorizes on reopen. Ollama may
classify a first unscoped request; explicit protected-domain intents remain authoritative.
CopilotKit's approved display tool handles validated results, with the same read-only cards
available during runtime reconnection. Historical domain entries open current authorized
domain data, clearly labelled as live; they do not pretend to snapshot business state.
No chat message automatically approves or executes a material action.

Sessions are paginated in groups of 100; each session permits 100 messages. Older
sessions remain stored. The client stores only the selected session ID in the role-scoped
URL hash; chat content stays in the database. Identity changes unmount the old workspace
and cancel polling. Existing mock identity authentication is unchanged.

## Reading position

Opening a chat or completing a reply positions the message pane at the beginning of
the latest assistant response, rather than its evidence/process footer. Processing
updates preserve the reading position. If the user scrolls to an earlier message,
finishing the pending reply does not pull them away. Scrolling is confined to the
message pane and respects reduced motion; native scroll anchoring is disabled there
so replacing the activity card cannot override the intended response position.

## Branding

The neon lime/deep teal theme, navigation wordmark, loading symbol, conversation symbol
and browser tab icon use the images supplied by the user on 18 October 2026.
Original PNGs are retained in `apps/web/public/branding/`; the square supplied symbol is
also `apps/web/app/icon.png`, using Next.js file-based icon metadata. The wordmark is
framed using CSS without altering the original supplied pixels. Semantic warning/error
colors and reduced-motion behavior remain distinct.

## Back-to-back demo

Select Finance under **Sources & search**, then send these in one chat:

1. According to the FDIC guide, how do cash flow actuals differ from projections?
2. Summarize that in three bullet points.
3. Which figures should I track every month?
4. Turn that into a monthly review checklist.
5. Which cited pages support that checklist?

Use **New chat** to change topics. Expand **Process history** below any response to
inspect its saved steps, and click a citation to inspect its exact source/version/page.
Local model quality and available source coverage still determine answer quality.

## Verification

The final production build passed. A real browser submitted two consecutive Finance
questions to the persistent chat API and Ollama Qwen3.5 0.8B; both replies used six FDIC
PDF excerpts, with a saved context event on the follow-up. Refresh during generation,
reopening after the API restart, restored Finance scope and citation cleanup were checked.
Metadata and timings are recorded in `artifacts/verification/chat-sessions.json`.
The model repeated some points; this verifies the conversation pipeline, not a broad
answer-quality benchmark. WebSearch was off for this real-model smoke.

Final checks: 217 backend tests passed (two opt-in skips), seven targeted PostgreSQL
conversation/migration checks, 42 frontend unit tests, 22 unique browser scenarios through
the main pass and targeted retests, Ruff, ESLint, TypeScript and production build.
