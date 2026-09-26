# Status Implementasi SuperFlow

**Diperbarui:** 26 September 2026

**Ruang lingkup:** Fase 0–3. Fase 4 belum dimulai.

**Status:** Workflow Core selesai untuk scope prototype; quality gate final dan inspeksi produksi lulus.

# Selesai

- Fase 0–2 dipertahankan: Next.js/FastAPI/PostgreSQL, Alembic, role demo, upload/parsing/version/index/download, Knowledge Hub, retrieval/citation/SourcePanel, saved questions, lima status Guard/evidence dan audit.
- Migrasi 0004: cases, case_evidence, workflow_definitions/runs/steps, step_attempts, tasks, approvals, action_receipts. PostgreSQL schema match dan SQLite migration lifecycle lulus.
- Case domain-neutral manual atau dari Ask authorized. Context memakai QuestionRun tersendiri/GuardEvaluation existing, tanpa mengubah original saved answer. BLOCKED memerlukan consent recovery; ACCESS_RESTRICTED ditolak.
- Internal Case context dikecualikan dari Ask history/saved-Ask API agar Case requirements tidak dilewati.
- Case Workspace dengan identity/owner/status/reliability, actual sources/evidence, workflow, tasks, approvals dan audit. Revoked source context tidak muncul di list dan direct read memberi 404 aman.
- Generic review definition versi 1.0, config snapshot, persistent TASK/GUARD/CONDITION/APPROVAL/TERMINAL, state lintas refresh.
- Task owner/due/status/start/complete; completion menjalankan Guard dan human review. Retry maksimum dua, attempt history, manual SME fallback, escalation Governance dengan reason/actor/time.
- Decision Center: approve, reject, request evidence, escalate, override. Reviewer independen, no self-approval, mandatory override reason.
- Request Evidence menyimpan required/missing EvidenceItem, waiting state, actual source attachment, Guard re-evaluation, resume dan request baru.
- Backend role authority, Case/source metadata locks, expected_revision, unique relationships, optional idempotency receipts, 409 untuk stale/duplicate actions.
- AuditEvent existing untuk material Case/workflow/task/decision/retry/fallback/escalation/override. Tidak ada audit/reliability/evidence system kedua.
- Navigasi Cases/Workflows/Decision Center aktif. Typed ApprovalPanel/WorkflowTimeline fungsional bersama AnswerCard/SourcePanel/EvidenceChecklist; types workflow generated dari Pydantic.
- Definition seed idempotent; demo:workflow opsional membuat A verified, B missing source, C conflict. Reset mencakup Fase 0–3.
- Dokumentasi Bahasa Indonesia diperbarui; [WORKFLOW_CORE.md](docs/WORKFLOW_CORE.md) baru. AGENTS/PRD tetap English.

# Sebagian Selesai

- Satu generic review definition, satu run per Case; belum tool runtime, scheduler, notification atau graph editor.
- Evidence attachment berupa approved source chunks; semantic kesesuaian label tetap tugas reviewer, belum arbitrary operational attachments.
- Guard tetap extractive/explicit conflict rules; belum semantic checks menyeluruh, OCR/vector retrieval.
- Mock header/roles belum SSO/entitlement produksi.
- Audit ORM/PostgreSQL bukan WORM eksternal; database owner dapat mengubah trigger. Reset adalah maintenance exception eksplisit.
- Docker tidak tersedia untuk verifikasi Compose; PostgreSQL lokal nyata digunakan.
- Keyboard/dialog/responsive diperiksa; audit screen reader lengkap belum dilakukan.

# Belum Diimplementasikan

- Fase 4: regulation comparison, SOP impact/gap mapping, remediation logic.
- Fase 5: investment extraction/orchestration, financial formulas, sensitivity, memo.
- Fase 6: QCD/impact analytics dan savings/capacity measurement.
- Fase 7: AML/FIU workflow.
- ComparisonTable, FinancialAnalysis, full Governance, production authentication, external integrations, visual workflow builder.

# Masalah yang Diketahui

- Sandbox Windows memblokir worker/temp pytest; pemeriksaan memakai izin proses yang sesuai dan runtime Python lokal.
- Warning Starlette TestClient HTTPX dan NO_COLOR/FORCE_COLOR tetap ada tanpa mengubah hasil tests.
- Idempotency hanya pada mutasi Case existing; create Case belum mempunyai receipt. UI menahan submit saat busy.
- Tidak ada higher-authority escalation setelah Governance atau bila reviewer independen authorized tidak tersedia; 409 eksplisit.
- Reset menghapus execution/audit sintetis dan mengganti ID source; URL lama dapat unavailable.
- Source MCP 21st.dev dibatasi dua retrieval per hari; komponen tanpa inspeksi tidak dipasang.

# Catatan Workflow

- Guard existing adalah sumber reliability tunggal. VERIFIED tetap meminta manusia; REVIEW_REQUIRED ke reviewer; BLOCKED/OUTDATED menunggu evidence; restricted tidak dibawa atau dibaca.
- Guard diperiksa ulang sebelum keputusan/progression, tidak mempercayai cache/badge frontend.
- Retry/fallback menjaga failure history; manual review tidak melewati Guard prerequisites.
- Evidence baru membentuk extract context; saved answer asal tetap. Case requirements memakai EvidenceItem yang sama.
- Row locks PostgreSQL dan expected_revision melindungi execution. Key/payload identik tidak menambah task/approval/audit transition.
- Arsitektur, lifecycle, API dan batasan: [WORKFLOW_CORE.md](docs/WORKFLOW_CORE.md).

# Catatan Decision Center

- Sources/evidence mendahului form; backend menentukan allowed actions dan menegakkan authority.
- Creator/owner tidak dapat self-approve. Manager generic, SME conflict/audit, Compliance regulatory type, Finance investment type, Governance broad independent authority. Type tidak menambahkan domain analysis.
- REVIEW_REQUIRED approval membutuhkan reason dan tetap REVIEW_REQUIRED setelah keputusan.
- Override hanya Governance independen dengan reason; tidak melewati BLOCKED/OUTDATED/ACCESS_RESTRICTED.
- Request evidence/escalation menutup request lama dan menjaga histori.
- Concurrent HTTP approve/reject PostgreSQL: satu 200, satu 409; satu material decision event.

# Catatan UI/UX

- Home/Ask/Knowledge retained; Ask mempunyai explicit Create case/recovery entry, tanpa fake KPI.
- Tabel Origin UI existing, Dialog/SourcePanel, metadata/badge/disclosure dan navy/lime tokens dipakai ulang; tidak ada dependency/design system baru.
- UI dipisah menjadi controller data, action lists, Case Workspace, ApprovalPanel dan WorkflowTimeline.
- Create/navigation race diperbaiki: workspace action tersedia setelah URL Case memiliki lifecycle request.
- Workspace padding/max-width konsisten. Mobile mendahulukan evidence/decision; tanpa overflow pada 375/390/768/1024/1440 px.
- MCP meninjau Activity Timeline, Cubby UI Timeline, experience timeline dan task checklist. Source Cubby UI terkunci kuota; tidak ada vendor baru diadopsi. [UI_REFERENCES.md](docs/UI_REFERENCES.md).

# Hasil Pengujian

| Pemeriksaan          | Hasil aktual                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend PostgreSQL   | **84 lulus**: Fase 0–3, permission/non-leakage, Guard, transition/task/approval, retry/fallback/escalation, evidence, persistence, idempotency, audit         |
| Backend SQLite       | **84 lulus**, termasuk lifecycle migrasi dan reset                                                                                                            |
| Frontend unit        | **11 lulus**, source/reliability/typed controls/decision validation                                                                                           |
| E2E Chromium         | **20 lulus** pada run final, termasuk regresi Fase 0–2 dan concurrent decision                                                                                |
| Formatter/lint/types | Ruff format/check, Prettier, ESLint, TypeScript, kedua generated-contract checks lulus                                                                        |
| Production build     | Lulus: Home/Ask/Knowledge/Cases/Workflows/Decision Center                                                                                                     |
| PostgreSQL schema    | Head 0004, Alembic check tidak menemukan upgrade tertinggal, seed idempotent                                                                                  |
| Produksi             | Port 3000/8000 dengan PostgreSQL nyata; A/B/C, source/version, refresh, retry x2/fallback, blocked approval, roles/denied read dan existing screens diperiksa |
| Responsive/visual    | Screenshot desktop/mobile diperiksa; nol browser runtime errors/overflow pada 375/390/768/1024/1440 px                                                        |

Retry/fallback produksi memakai Case sintetis khusus dengan stale extract; sumber seed dan Case pengguna tidak diubah. Tidak ada tombol pemalsu failure/reliability. Screenshot di .runtime/screenshots/phase3 diabaikan Git. PostgreSQL tests dan E2E dijalankan berurutan pada database test; database aplikasi terpisah.

# Langkah Berikutnya yang Direkomendasikan

Inspeksi tambahan produksi juga memastikan escalation ke Governance, mandatory override reason, override event, Decision Center queue, dan workflow list; nol browser runtime errors.

1. Tinjau independence/reviewer rules dan evidence semantics dengan process owner sebelum deployment nyata.
2. Verifikasi Compose pada Docker dan audit screen reader.
3. Evaluasi authentication, scheduler/notification, operational evidence dan audit production bila dibutuhkan.
4. Mulai Fase 4 hanya setelah instruksi eksplisit. Pekerjaan ini berhenti pada Workflow Core.
