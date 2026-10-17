# Cross-division public knowledge

SuperFlow retains the OJK compliance collection and adds six real PDFs across three other domains. The curated manifest is `data/public/manifest.json`; downloaded PDFs and models stay in ignored `.runtime/` storage. Original PDF bytes are also stored in the database for exact version citations.

Verified import: **6 PDFs, 186 pages, 6,903,410 original bytes and 311 new chunks**. The shared KB contains **27 documents and 1,437 current-model vectors**, with six completed full-rebuild audit events. Real multilingual-model retrieval found the expected public sources in Finance, Operations and People; an Employee query restricted to Proposal A returned zero sources. Reports: `data/public/import-report.json` and `data/public/verification.json`.

| Domain | Public references | Purpose |
| --- | --- | --- |
| Finance | FDIC Managing Cash Flow; CFPB Creating a Cash Flow Budget | Cash-flow actuals, projections, budgeting and training |
| Operations | NIST Cybersecurity Framework 2.0; SP 800-61r3 (2025) | IT risk management, incident response and recovery |
| People | ILO Employers' Guide on Working from Home; ILO Teleworking Practical Guide (both 2020) | Remote work planning, communication, well-being and productivity |

These are external learning references, not Superbank policies or a determination of current Indonesian law. The People guides explicitly retain their 2020 pandemic-era context. Publisher, URL, retrieval time, jurisdiction, usage scope, checksum and page-level extraction provenance accompany each version. `active` means eligible for retrieval, not approved applicability. Source context supplied to the AI includes publisher/jurisdiction/usage scope. Existing permission and human review controls apply.

## Import without resetting existing data

`npm run demo:public` downloads and imports the manifest using the existing local OCR, LlamaIndex splitter and multilingual embedding model. `-- --download-only` fetches and validates PDFs without touching the database. The operator must be an active knowledge maintainer; Governance is the default. Downloads allow only explicit official publisher HTTPS hosts and validate redirects, PDF signature and the 10 MB size limit. Each PDF commits separately; rerunning unchanged sources is idempotent.

## Every inserted PDF rebuilds the full shared index

Both new uploads and new PDF versions, including official/public PDF imports, go through `knowledge.add_version`. Once parsing succeeds, the application regenerates vectors for **all stored shared-KB chunks**, including historical/draft versions and restricted documents. Retrieval still applies permissions and lifecycle filters before using any vector. Private per-question WebSearch snapshots are excluded from the shared index.

The rebuild uses the currently configured local embedding model and forces regeneration even when a vector's hash already matches. It preserves original bytes, text, chunk IDs, version IDs, metadata, other model namespaces and saved citation references. No corpus re-chunking or deletion is performed. Existing identical official imports do not insert a new version and therefore do not trigger another rebuild.

PDF insertion, lifecycle changes and all regenerated vectors share one transaction. An extraction/embedding failure rolls them back together; readers keep the previously committed index. PostgreSQL transaction advisory locking serializes PDF rebuilds across API processes. A system audit event records model and refreshed chunk count. Restricted source text or IDs are not returned to the uploader. Rebuilding all vectors increases upload time and CPU use as the corpus grows; the upload dialog explains this before submission. This maintenance path runs even when retrieval is configured for keyword mode, so PDF uploads require the local RAG dependencies/model.

## Ask activity and motion

The same-origin Next.js proxy allows up to ten minutes (`experimental.proxyTimeout: 600000`) for local work. Its default 30-second timeout cut off a real 59-second model run despite the API saving the answer successfully; the production proxy budget now accommodates inference and full-library PDF rebuilds. Failed questions also stop showing a retrieval spinner after the request has ended.

The activity card displays search scope, elapsed seconds, and actual server-reported retrieval, browser/vision, generation and reliability stages. It does not show fabricated percentages or model chain-of-thought. Normal Ask requests use an optional UUID correlation header and owner-scoped `/api/ask-progress/{id}` polling. The bounded in-memory registry expires records after one hour; losing a progress record does not change the answer request. WebSearch uses its persisted job and returns live stages alongside polling; reloading resumes the job.

Workspace selection and saved-answer loading are described explicitly. Local inference can take minutes, so longer waits show an honest explanation. Entrance/stagger animations, page transitions, hover states and active-step motion preserve the existing tabs and layout. OS reduced-motion settings disable nonessential movement; live status text remains available to assistive technology.

Production verification also received an actual Ollama answer in Bahasa Indonesia with six FDIC excerpts and a valid citation to PDF page 5, including OCR provenance. The answer remained `REVIEW_REQUIRED`. The real request continued beyond the old proxy deadline and reached the browser after the timeout fix; this is separate from deterministic browser fixtures. All temporary services were stopped after verification.

Example questions:

- Finance: “What is the difference between cash flow actuals and projections according to the FDIC guide?”
- Operations: “According to NIST SP 800-61r3, how should incident response connect to cybersecurity risk management?”
- People: “According to the ILO teleworking guide, how can managers support communication and worker well-being?”

Select the corresponding domain to focus retrieval. Questions can also be asked in Bahasa Indonesia with the multilingual model. Public PDFs are labelled **From Knowledge Base** because they were imported into the library; this is distinct from temporary **Internet** captures used by WebSearch.
