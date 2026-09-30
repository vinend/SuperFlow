# Rencana Implementasi SuperFlow

## Tujuan dan ruang lingkup

SuperFlow adalah **Enterprise Knowledge-to-Action Platform** untuk workspace internal Superbank. Rantai produknya: Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact.

Sumber produk aktif adalah **SuperFlow_PRD_v2.md**, menggantikan PRD v1. Fase 0–7 dan rekonsiliasi Product Experience sudah menjadi baseline prototype sintetis. Fase 7 memakai fondasi Case, workflow, Guard, evidence, permission, audit, concurrency, dan idempotency untuk Investigation Review. Fase 8 belum dimulai.

## Pass integrasi Generative Workspace

Tujuan: satu permintaan bahasa alami di Ask memilih workspace yang sudah ada tanpa menyalin logika domain. CopilotKit V2 dan AG-UI mengirim intent ke adapter Next.js/FastAPI; kontrak bertipe membatasi tujuh workspace, view, dan identifier. FastAPI melakukan klasifikasi deterministik atau memakai Ollama opsional, lalu memeriksa role dan akses investigation. Komponen domain existing mengambil ulang data dari API. Keputusan material tetap memerlukan interaksi manusia.

Deliverable: runtime `/api/copilotkit`, endpoint `/api/workspace-intent`, AskComposer terintegrasi, GenerativeWorkspace, fallback deterministik, invalidasi saat role berubah, uji unit/API/E2E, PNG di `artifacts/screenshots/generative-workspace/`, serta [dokumentasi teknis](docs/GENERATIVE_WORKSPACE.md). Dependency: Fase 0–7 selesai, database/seed tersedia, paket CopilotKit V2. Status: selesai untuk scope prototype sintetis; Fase 8 belum dimulai.

## Rekonsiliasi Product Experience

1. Baca PRD v2 dan audit shell, Home, Ask, Knowledge, workspace, serta kontrak/API existing.
2. Inspeksi MCP 21st.dev untuk inbox dan timeline; gunakan primitive existing bila source tidak tersedia atau kandidat tidak cocok.
3. Adapter frontend bertipe menerjemahkan Case/WorkflowRun/Task/Approval menjadi work item dan progress tanpa state machine kedua.
4. Employee mendapat Home/Ask/Knowledge/My Work; reviewer mendapat Reviews; role berwenang mendapat Impact; Governance Admin mendapat Home/Knowledge/My Work/Reviews/Impact. Modul yang belum diimplementasikan tidak ditampilkan.
5. Tindakan Ask membawa konteks authorized ke request dan review existing; evidence recovery tetap eksplisit.
6. Humanisasi status, activity, nama orang, dan progress; hilangkan label fase, revision, definisi dan node types dari layar produk.
7. Jalankan seluruh quality gate, regresi dan inspeksi produksi enam role/desktop/mobile; dokumentasikan hasil aktual.

Dependency: fondasi Fase 0–3 dan PRD v2. Status: selesai untuk scope prototype; quality gate, regresi dan inspeksi produksi enam role lulus.

## Tahapan PRD

| Fase                        | Tujuan                                     | Deliverable                                                                                        | Dependency                           | Status                                                                             |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| 0 — Skeleton                | Fondasi aplikasi yang dapat dijalankan     | Monorepo Next.js/FastAPI, PostgreSQL, Alembic, seed sintetis, shell dan identitas demo             | Node.js, Python, PostgreSQL          | Selesai; PostgreSQL lokal serta Compose/Ollama Docker terverifikasi                |
| 1 — Knowledge Core          | Pertanyaan yang dapat ditelusuri ke sumber | Upload/parsing/chunking, metadata/versi/relasi, retrieval abstraction, Ask, citation, Source Panel | Fase 0, dokumen seed                 | Selesai untuk scope prototype Fase 0/1; rekonsiliasi dan verifikasi lulus          |
| 2 — Reliability Core        | Pemeriksaan reliability yang persisten     | SuperFlow Guard, citation coverage, evidence/conflict, audit                                       | Knowledge Core, kontrak reliability  | Selesai untuk scope prototype; seluruh quality gate dan lima demo status lulus     |
| 3 — Workflow Core           | Aksi dan keputusan manusia                 | Cases, state machine, tasks, retry/escalation, Decision Center, approval                           | Guard dan audit                      | Selesai untuk scope prototype; quality gate final lulus                            |
| 4 — Regulation-to-Action    | Perubahan regulasi menuju remediation      | Comparison, SOP mapping, gap, remediation                                                          | Fase 1–3                             | Selesai untuk scope prototype; seluruh quality gate lulus                          |
| 5 — Investment Intelligence | Analisis investasi deterministik           | Extraction, formula keuangan, sensitivity, memo, approval                                          | Fase 1–3                             | Selesai untuk scope prototype; seluruh quality gate lulus                          |
| 6 — Analytics               | Pengukuran QCD dan dampak                  | Quality, Cost/Capacity, Delivery, audit visualization, controlled generative UI                    | Data eksekusi dan definisi metrik    | Selesai; functional gate dan format file Fase 6 lulus, baseline format dicatat     |
| 7 — AML/FIU Proof Point     | Investigation Review sintetis terkendali  | UI existing, Investigation/ToolRun persisten, template, alat allowlist, agent terbatas, Guard, analyst/checker, audit | Fase 0–6 | Selesai untuk prototype sintetis; verifikasi dicatat di status |
| 8 — Polish                  | Stabilitas demo seluruh platform           | Journey lengkap, reset lintas modul, presentasi                                                    | Modul yang diotorisasi telah selesai | Ditunda; reset lokal dan aksesibilitas Fase 0/1 tersedia sebagai kebutuhan fondasi |

## Deliverable Fase 0

- npm workspace `apps/web`; FastAPI/Pydantic/SQLAlchemy di `apps/api`.
- PostgreSQL sebagai sumber data aplikasi. Docker Compose disediakan; runner lokal PostgreSQL tersedia jika Docker tidak ada. SQLite hanya untuk pengujian terisolasi.
- Migrasi roles, users, documents, versions, chunks, dan saved questions. Original bytes/checksum disimpan bersama versi dokumen.
- Tujuh identitas sintetis (termasuk Compliance Checker); 13 dokumen dengan 15 versi. Seed berulang tidak menimpa data pengguna.
- Role switcher mock yang tersimpan sebagai ID di browser; role sebenarnya dipahami API melalui `X-User-Id`.
- Home, Ask SuperFlow, Knowledge tersedia. Navigasi execution sekarang memakai My Work/Reviews sesuai role; tidak ada placeholder modul masa depan sebagai navigasi utama.
- Reset CLI lokal yang eksplisit, dibatasi database PostgreSQL `superflow`/`superflow_test`, mengembalikan seluruh data sintetis termasuk tiga investigasi Fase 7 secara atomik. Tidak ada endpoint reset produksi.

## Deliverable Fase 1

- Upload TXT/Markdown UTF-8, PDF berbasis teks, DOCX; heading/page/table diubah menjadi chunk terbatas.
- Metadata owner/domain/authority/access/relasi; versi file immutable; status active/outdated/draft; re-index dengan ID citation stabil.
- Constraint satu versi active, lock dokumen saat publikasi, supersede atomik, dan penolakan publikasi tanggal efektif di masa depan.
- Pemeriksaan akses dasar sebelum retrieval dan sebelum mengembalikan sumber/download/saved answer. Ini prasyarat keamanan Knowledge Core, bukan arsitektur Guard lengkap.
- `Retriever` dan `AnswerProvider` dapat diganti. Adapter awal deterministik berbasis keyword/concept, filter metadata, bobot authority, dan active-version selection. Historical retrieval harus dipilih; draft dikecualikan.
- Jawaban berupa kutipan extractive nyata; citation merujuk ID document/version/chunk sebenarnya.
- AnswerCard dan SourcePanel bertipe dibangun pada Fase 1; EvidenceChecklist, ApprovalPanel, dan Progress ditambahkan pada fondasi Fase 2–3 tanpa output palsu.
- Refresh membuka kembali saved answer/filter dan detail versi melalui referensi URL; API memeriksa izin lagi. Sumber yang tidak tersedia menghasilkan error, bukan konten cache browser.

## Deliverable Fase 2

1. Reuse permission/version/citation existing; dedicated SuperFlowGuard dengan GuardInput, GuardCheckResult, GuardResult, dan EvidenceItem.
2. Canonical statuses backend dan TypeScript yang dihasilkan; sembilan check eksplisit, calculation tidak applicable.
3. GuardResult terkait QuestionRun, snapshot/fingerprint/re-evaluation persisten; saved run Fase 1 mendapatkan Guard saat dibaca.
4. AuditEvent append-only: event pipeline, proteksi ORM/PostgreSQL, API baca identitas sendiri, reset demo atomik.
5. Seed konflik access review tambahan; missing receipt exception requirement; lima skenario repeatable.
6. AnswerCard/SourcePanel diperluas dan EvidenceChecklist fungsional, tanpa perubahan layout besar atau fase aksi.
7. Tests state, coverage, evidence, permission non-leakage, versi, saved answer, audit, migrasi/reset, dan E2E lima status; regresi Fase 0/1 tetap dijalankan.

Dependency: Knowledge Core, PostgreSQL/Alembic, provider extractive, dan aturan knowledge yang eksplisit. Detail arsitektur/kontrak ada di [SUPERFLOW_GUARD.md](docs/SUPERFLOW_GUARD.md).

## Penyempurnaan UI

1. Baca konteks proyek dan audit implementasi sebelum perubahan.
2. Periksa komponen yang ada, cari kandidat melalui MCP 21st.dev, dan inspeksi source/dependencies sebelum adaptasi. Dokumentasikan provenance dan batas kuota di [UI_REFERENCES.md](docs/UI_REFERENCES.md).
3. Gunakan shell navy, token terpusat, hierarchy jelas, dan kepadatan enterprise.
4. Home berpusat pada Ask, sumber terbaru, dan riwayat; counts hanya pendukung.
5. Knowledge Hub memakai tabel; Ask memisahkan jawaban/evidence/metadata/tindakan membaca sumber.
6. Gunakan primitive header/badge/metadata/loading/error/empty/dialog; pertahankan API/editor/detail yang sudah berfungsi.
7. Perbaiki fokus, Escape, navigasi keyboard, responsive sheet, reload, dan race saat pergantian role.

Pass frontend terfokus telah menyempurnakan tujuh masalah komposisi: header, tinggi composer, area kosong, rail riwayat, kepadatan tabel, detail sheet, dan label dekoratif. Pola Origin UI Table serta InputBar diadaptasi; API dan backend dipertahankan. Hasil dan kandidat yang tidak diadopsi dicatat di [FRONTEND_REFINEMENT.md](docs/FRONTEND_REFINEMENT.md).

## Verifikasi

- Migrasi dan seed idempotent di PostgreSQL; lifecycle migrasi terisolasi; reset dan penolakan target tidak aman.
- Backend unit/API: non-leakage, versi, citation, filter, owner/access, saved-source re-authorization, parsing/upload, rollback kegagalan.
- Frontend unit: resolusi citation nyata, presentasi status versi yang persisten, format file dari metadata.
- Browser/E2E: role/catalog, Ask/current/history, no-sources, upload/edit/version/re-index, keyboard/dialog, refresh, mobile, API error, respons terlambat saat role berganti.
- Formatter, linter, TypeScript, build produksi, dan inspeksi aplikasi berjalan. Jalankan suite yang memakai database test yang sama secara berurutan.
- Catat hasil aktual serta batasan lingkungan di [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Pekerjaan yang ditunda

Demo polish (Fase 8), autentikasi produksi, OCR, dan vector retrieval belum diimplementasikan. FIU Fase 7 memakai data dan adapter sintetis; integrasi produksi berada di luar scope.

## Deliverable Fase 7 — AML/FIU Investigation Review

**Status:** Selesai untuk prototype sintetis; integrasi sistem nyata dan Fase 8 tetap di luar ruang lingkup.

1. Pertahankan layar Investigation Review existing; ganti state browser dengan API dan PostgreSQL. Tambahkan migrasi `0007` untuk `Investigation` dan `ToolRun`, memakai Case dan CaseEvidence existing.
2. Template `synthetic-alert-review-v1` menentukan lima bukti wajib dan satu opsional. Empat alat sintetis terdaftar dengan input/output terstruktur, upaya persisten, fingerprint, izin backend, dan audit.
3. Agent memilih satu tindakan dari allowlist pada setiap langkah; maksimal delapan langkah, dua upaya per alat. Ollama opsional melalui output Pydantic ketat; fallback deterministik. Tidak ada akses internet atau sistem nasabah nyata.
4. SuperFlow Guard mengevaluasi provenance, kelengkapan, konflik, kegagalan alat, dan izin dengan status kanonik. Triage HIGH berasal dari indikator eksplisit, bukan probabilitas AML.
5. Analis menyimpan catatan/rekomendasi lalu mengirim ke workflow `aml-investigation-v1`; Compliance Checker sintetis yang berbeda memutuskan di Reviews / Approvals. My Work dan Activity memakai model platform existing.
6. Seed/reset memberi tiga skenario: lengkap, alat gagal, konflik. Tes API/frontend/E2E, migrasi, format, lint, typecheck, build, desktop/mobile memverifikasi implementasi.

Dependency: Fase 0–6, PostgreSQL/Alembic, Case/workflow/Guard/Audit existing. Batasan dan demo ada di [AML_FIU_INVESTIGATION.md](docs/AML_FIU_INVESTIGATION.md).

## Deliverable Fase 3

1. Case domain-neutral manual/dari Ask, context QuestionRun existing, source/evidence re-authorization dan explicit evidence recovery.
2. Migration 0004; case_evidence memakai EvidenceItem yang sama; WorkflowDefinition versioned, snapshot WorkflowRun, persisted steps/attempts/tasks/approvals.
3. TASK/GUARD/CONDITION/APPROVAL/TERMINAL; Guard waiting/review/current enforcement tanpa reliability engine baru.
4. Retry terkendali maksimum dua, manual fallback, escalation Governance, request evidence dan resumable workflow.
5. Decision Center: approve/reject/request evidence/escalate/override dengan independent authority, mandatory reason, dan backend controls.
6. Case lock/source metadata locks/revision, unique task/run, optional idempotency receipts, audit append-only existing.
7. Typed CaseWorkspace/ApprovalPanel/WorkflowTimeline, navigation My Work/Reviews setelah rekonsiliasi PRD v2, real evidence/source context, compact tokens existing.
8. Demo A/B/C opsional dan reset Fase 0–3; tests backend, contracts, browser/concurrency, regression, production/responsive inspection.

Dependency: seluruh Fase 0–2, PostgreSQL/Alembic, mock identities, Guard extractive rules. Arsitektur dan batasan di [WORKFLOW_CORE.md](docs/WORKFLOW_CORE.md). Tidak ada Regulation-to-Action, analytics, investment analysis, atau AML workflow.

## Deliverable Fase 4 — Regulation-to-Action

1. Baca PRD v2 §13/§33, AGENTS, status; audit Case/workflow/Guard/permission existing. Siapkan dependencies dan jalankan baseline (84 backend, 19 frontend lulus) di macOS.
2. Review = Case `regulatory_review` + tabel `regulatory_reviews` (PK = case_id) dan `regulatory_findings`; migrasi `0005`. Tidak ada perubahan model Fase 0–3; `CaseType` + `remediation`.
3. Analisis deterministik di balik Protocol (`RegulationComparator`, `ImpactMapper`, `GapAnalyzer`): alignment section, perubahan kuantitas (frequency/deadline/duration), obligation baru, mapping referensi artikel/topik setelah `can_read`, usulan gap requirement_mismatch/missing_obligation.
4. Keputusan manusia: confirm (edit pernyataan, owner, due date) / reject (alasan wajib) / reassign remediation yang ditolak; `expected_revision`, idempotency receipt, audit.
5. Remediation = Case `remediation` pada workflow `regulatory-remediation-v1` (TASK → GUARD → APPROVAL Manager → TERMINAL) memakai engine existing; due date pada task; review ditutup hanya setelah semua remediation disetujui.
6. Frontend: navigasi Compliance "Regulatory Review", `/regulatory`, `ComparisonTable` (registry available), `GapFinding` (evidence sebelum keputusan), Home Compliance, My Work/Ask integration, adapter `regulatory-view.ts`, kontrak TS yang di-generate.
7. Tests backend (alur penuh, non-leakage, validasi, konkurensi, reset, analyzer), frontend unit, E2E journey + role gating, regresi Fase 0–3, build produksi, inspeksi visual desktop/mobile.

Dependency: Fase 1–3, seed regulasi v1/v2 dan SOP terkait. Arsitektur dan batasan: [REGULATION_TO_ACTION.md](docs/REGULATION_TO_ACTION.md).

## Deliverable Fase 5 — Investment Intelligence

1. Baca PRD v2 §14/§34, AGENTS §32 (Financial Logic), dan status. Audit seed finance: Proposal A 180 juta vs Vendor A 195 juta (konflik), proyeksi cash flow, dan threshold approval 250 juta.
2. Analisis = Case `investment` + tabel `investment_analyses` (PK = case_id; assumptions, selections, memo, snapshot submit) lewat migrasi `0006`. Tidak ada perubahan model Fase 0–4.
3. Ekstraksi deterministik di balik Protocol `AssumptionExtractor` (proposal, quotation, proyeksi, approval policy). Setiap nilai disimpan bersama chunk dan kalimat sumbernya. Resolusi input: consistent/conflict/resolved/missing, tanpa pemilihan otomatis.
4. `finance_calc.py`: NPV, IRR (bisection), ROI, payback, break-even inflow, dan sensitivity ±10/20%. Dites terhadap perhitungan manual. Rumus, unit, dan periode diekspos.
5. Guard: `calculation_validity` nyata lewat `GuardInput.calculation` dan registry `CALCULATION_INPUTS`. Missing → BLOCKED, conflict → REVIEW_REQUIRED.
6. Pilihan nilai (alasan wajib), memo deterministik yang dapat diedit, dan submit yang membekukan snapshot. Routing approval dari threshold approval policy: Manager, atau komite (Governance). Workflow memakai engine existing. Semua mutasi memakai revision, idempotency, dan audit.
7. Frontend: navigasi Finance "Investment Analysis", `/investment`, `FinancialAnalysis` (registry available), `AssumptionTable`/`InputDecision` (evidence sebelum pilihan), memo, Home Finance, konteks analisis di layar review approver, aksi Ask **Prepare Analysis**, dan kontrak TS yang di-generate.
8. Test backend (rumus, ekstraksi, konflik, non-leakage, routing, freeze, self-approval, idempotency, request information), frontend unit, E2E journey + role gating, regresi, build, dan inspeksi visual.

Dependency: Fase 1–3 serta dokumen seed proposal/quotation/cash flow/approval policy. Arsitektur dan batasan: [INVESTMENT_INTELLIGENCE.md](docs/INVESTMENT_INTELLIGENCE.md).

## Deliverable Fase 6 — Impact Analytics

1. Workspace **Impact** yang role-aware untuk Manager, SME, Compliance, Finance, dan Governance; Employee tidak melihat navigasi atau agregat.
2. Quality observed: citation coverage, verified rate, konflik terdeteksi, permintaan informasi/rework, dan historical source yang ditandai.
3. Delivery observed: answer time dari audit timestamp, cycle time, backlog, throughput/completion, review time, dan escalation.
4. Cost/Capacity memisahkan volume observed dari **Illustrative simulation** untuk hours released, capacity value per item, dan illustrative cost avoidance. Asumsi selalu terlihat dan bukan realized profit.
5. Backend menghitung semua metrik dari QuestionRun, GuardEvaluation, Case, Approval, dan AuditEvent yang lolos scope permission; frontend hanya memformat.
6. `ImpactComposer` memilih intent overview/quality/capacity/delivery dan mengomposisikan `ImpactBrief`, `MetricGroup`, `DistributionChart`, `CapacitySimulation`, serta `NextActions` dari registry approved.
7. Payload Pydantic/TypeScript divalidasi dan unknown component fail closed. Tidak ada arbitrary HTML atau permission/business truth di frontend.
8. API/unit/E2E mencakup role gating, non-leakage, observed metrics, simulation disclosure, intent composition, responsive/mobile, generated contract, dan production build.

Dependency: data Fase 0–5 dan audit append-only existing. Tidak ada schema baru; analytics dibaca dari state operasional. Arsitektur dan batasan: [IMPACT_ANALYTICS.md](docs/IMPACT_ANALYTICS.md).
