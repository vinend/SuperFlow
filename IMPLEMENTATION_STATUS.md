# Status Implementasi SuperFlow

**Diperbarui:** 27 September 2026

**Sumber produk aktif:** [SuperFlow_PRD_v2.md](SuperFlow_PRD_v2.md). PRD v1 sudah digantikan dan tidak digunakan untuk keputusan produk/UX saat ini.

**Ruang lingkup:** Fase 4 — Regulation-to-Action (Regulatory Review) di atas fondasi Fase 0–3 dan rekonsiliasi Product Experience. Backend tetap menjadi sumber kebenaran.

**Status:** Fase 4 selesai untuk scope prototype; seluruh quality gate (backend PostgreSQL/SQLite, frontend unit, E2E, build) lulus. Fase 5 belum dimulai.

# Fase 4 — Regulation-to-Action

## Selesai

- **Regulatory Review** untuk Compliance: pilih regulasi (v1.0 → v2.0), perbandingan section-by-section, tiga perubahan material seed (Article 4 every 12 → 6 months, Article 7 within 72 → 24 hours, Article 9 3 → 5 years) beserta obligation baru. Versi lama ditandai historis dan tidak menjadi authority Guard.
- Mapping SOP/kontrol: Access Review SOP, Incident Reporting SOP, Record Retention SOP (referensi artikel) dan Access Review Control Policy (topik). Hanya sumber yang lolos `can_read` sebelum teks dibaca; tes membuktikan dokumen terbatas tidak dipetakan/bocor.
- Empat usulan gap; Compliance confirm (edit pernyataan, owner, due date) atau reject (alasan wajib). Keputusan memakai `expected_revision`, idempotency receipt dan audit. Remediation yang ditolak approver dapat di-reassign.
- Gap terkonfirmasi menjadi Case `remediation` pada workflow `regulatory-remediation-v1` (engine Fase 3 tanpa perubahan): owner menyelesaikan tugas → Guard → approval Manager independen → selesai. Owner harus dapat mengakses regulasi dan kontrol terkait; Employee ditolak.
- Review ditutup hanya setelah semua gap diputuskan dan semua remediation disetujui. Activity mencatat mulai, konfirmasi, penolakan, reassign, penugasan dan penutupan.
- Frontend: navigasi Compliance, `/regulatory`, `ComparisonTable` (registry _available_), `GapFinding` dengan evidence sebelum kontrol keputusan, error inline per keputusan, Home Compliance (versi baru belum direview, review menunggu keputusan), My Work dan Ask (**Start Regulatory Review**). Kontrak TS di-generate dari Pydantic.
- Migrasi `0005` (dua tabel). Reset dan seed mencakup data/template Fase 4. Endpoint generic start workflow/attach evidence menolak Case review.
- Dependencies macOS disiapkan dan diverifikasi: `npm ci` (termasuk binary `@embedded-postgres/darwin-arm64`), `.venv` Python 3.12 + `requirements-lock.txt`, `.env` dengan `PYTHON`, Chromium Playwright di `.runtime/playwright`, database lokal dimigrasi ke 0005 dan di-seed.

## Perubahan kecil pada kode Fase 0–3

- `new_case(..., may_assign=True)` untuk penugasan owner oleh modul domain; akses sumber owner tetap divalidasi.
- Fingerprint idempotency memakai `model_dump(mode="json")` (dibutuhkan field `date`; identik untuk field string/int sehingga receipt lama tetap valid).
- `progressFor` memakai judul langkah untuk definisi non-generic; label tugas remediation di workspace pekerjaan; kontrol form tidak lagi mewarisi font tebal label.

## Batasan Fase 4

- Deteksi berbasis aturan (frasa kuantitas, cakupan istilah ≥ 50%); bukan pemahaman semantik atau penilaian hukum. Semua usulan wajib keputusan manusia.
- Regulasi = dokumen Compliance authority 5 (belum ada field tipe dokumen). Target harus versi aktif; perbandingan draft belum didukung. Konteks maksimum 30 section.
- Guard remediation tidak memverifikasi bahwa SOP benar-benar diperbarui; approver menilai. Pada seed, remediation access review tetap REVIEW_REQUIRED karena konflik SOP 12 bulan vs policy 6 bulan hingga SOP versi baru dipublikasikan.
- Satu pengguna Compliance sintetis; approver remediation default Manager dengan fallback Governance.

# Selesai

- Fondasi Next.js/FastAPI/PostgreSQL, migrasi Alembic, seed/reset, enam identitas demo, upload/parsing, metadata, versi immutable, publikasi, re-index dan download tetap tersedia.
- Ask, retrieval authorized, citation document/version/chunk nyata, SourcePanel, saved questions, lima status SuperFlow Guard, EvidenceItem dan AuditEvent dipertahankan.
- Case, WorkflowDefinition/Run/Step, Task, Approval, retry/fallback/escalation, authority, row locks, expected_revision dan idempotency receipts tetap menggunakan implementasi Fase 3. Tidak ada migrasi atau engine baru dalam pass ini.
- Navigasi berbasis role: Employee mendapat Home/Ask SuperFlow/Knowledge/My Work; Manager, Compliance dan Finance mendapat tambahan Reviews / Approvals; SME mendapat Reviews; Governance Admin mendapat Home/Knowledge/My Work/Reviews / Approvals.
- My Work menggabungkan Case, workflow, task, requirement dan review dari API existing menjadi judul bisnis, status, langkah saat ini, tindakan berikutnya, progress, owner/reviewer, due date dan waktu pembaruan.
- Workflow tampil sebagai Progress di dalam pekerjaan. Node types, definition/version dan revision tidak menjadi bahasa utama layar produk. Histori pemeriksaan, retry dan escalation tetap dapat diinspeksi.
- Detail pekerjaan mengambil CaseView dan template yang diperlukan secara langsung; tidak menunggu seluruh daftar Case/workflow/approval. Tes refresh membuktikan detail tetap tersedia ketika API daftar tidak dapat diakses.
- Reviews hanya menampilkan permintaan pending dengan allowed_actions dari backend. Employee tidak memiliki kontrol keputusan, termasuk melalui route langsung. Authority API tetap ditegakkan backend.
- Ask mempunyai tindakan kontekstual Request Review, Request Exception, Start Review atau Provide Information. Submit Request membuat Case dan memulai review existing; BLOCKED memerlukan consent recovery eksplisit, ACCESS_RESTRICTED tidak dibawa ke request.
- Activity menerjemahkan event audit menjadi aktivitas yang dapat dibaca, dengan aktor, waktu dan alasan. Payload JSON dan ID internal tidak menjadi konten utama.
- Home mendahulukan Ask untuk Employee dan review untuk reviewer; menampilkan pekerjaan/permintaan nyata tanpa KPI atau aktivitas palsu.
- Judul seed demo diperbaiki: Annual Leave Review, Supporting Evidence Request dan Access Review Clarification. Seed mengenali judul lama agar tidak membuat duplikasi atau menimpa data lama.
- Dokumentasi README, rencana, status dan referensi UI diperbarui dalam Bahasa Indonesia; AGENTS/PRD tetap English.

# Sebagian Selesai

- Satu generic review definition, satu run per Case; belum scheduler, notification atau tool runtime.
- Evidence attachment berupa source chunk yang authorized dan current. Kesesuaian makna evidence tetap memerlukan penilaian reviewer.
- Guard memakai provider extractive dan aturan konflik eksplisit; belum pemeriksaan semantik menyeluruh, OCR atau vector retrieval.
- Identitas demo belum SSO/entitlement produksi. Role switcher dipertahankan untuk demo.
- Audit append-only pada ORM/PostgreSQL belum WORM eksternal; database owner dapat mengubah trigger. Reset adalah maintenance exception eksplisit.
- Keyboard, dialog dan responsive diperiksa; audit screen reader lengkap belum dilakukan.

# Belum Diimplementasikan

- Investment Intelligence/rumus keuangan, analytics/QCD, AML/FIU dan full Governance.
- FinancialAnalysis, autentikasi produksi, notifikasi/integrasi eksternal dan visual workflow builder.
- Investment Analysis tidak ditampilkan sebagai fitur aktif.

# Masalah yang Diketahui

- Pembuatan request dan start review memakai dua transaksi API existing. Jika start gagal, request tetap tersimpan; form menyimpan referensinya untuk retry start tanpa membuat Case kedua pada lifecycle form yang sama.
- Create Case belum memiliki receipt idempotency untuk respons yang hilang atau refresh di tengah submit. Busy state mengurangi submit ganda; mutasi execution existing tetap memakai revision/idempotency backend.
- Route internal `/cases`, `/workflows` dan `/decisions` dipertahankan untuk stabilitas URL. Label produk mengikuti PRD v2; legacy `/workflows` membuka My Work.
- Daftar My Work/Reviews masih memakai endpoint agregasi existing tanpa pagination. Waktu pemuatan meningkat ketika jumlah pekerjaan/histori bertambah; detail pekerjaan sudah tidak bergantung pada pemuatan daftar tersebut.
- Data operasional/test lama tidak dihapus. Adapter menerjemahkan judul demo lama yang dikenal; judul pengguna tetap dipertahankan.
- Higher-authority escalation tidak tersedia setelah Governance atau bila reviewer independen authorized tidak tersedia; API mengembalikan konflik yang jelas.
- Reset mengganti ID sumber dan menghapus execution/audit sintetis; URL lama dapat tidak tersedia.
- Docker tidak tersedia di lingkungan ini; eksekusi Compose belum diverifikasi. PostgreSQL lokal nyata digunakan untuk aplikasi dan pengujian.
- MCP 21st.dev membatasi retrieval source harian. Komponen yang source/dependencies-nya tidak dapat diinspeksi tidak dipasang.
- Sandbox Windows menghalangi beberapa proses worker/temp; pemeriksaan yang memerlukan subprocess dijalankan dengan izin yang sesuai. Warning HTTPX/Starlette dan NO_COLOR/FORCE_COLOR tidak menggagalkan tes.

# Rekonsiliasi Product Experience

- Mental model produk: Knowledge → Evidence → Decision → Action. Pengguna membuka My Work dan Reviews, bukan memilih entitas Case/WorkflowRun/Approval.
- Adapter bertipe `product-view.ts` membentuk WorkItemView, WorkProgressView dan ReviewItemView dari state API. Adapter tidak menyimpan state bisnis atau membuat permission/reliability engine kedua.
- Case tetap workspace domain-neutral. Guard, evidence, source authorization, workflow transitions, retry limit, fallback dan human authority tidak diganti.
- Backend dalam pass ini hanya mengalami perubahan copy seed demo dan pengenalan alias judul lama. Models, migrations, API, permission, concurrency dan audit service dipertahankan.
- Request dari Ask menggunakan referensi run/sumber authorized. Informasi terbatas tidak disalin. Reliability tetap terlihat dan dievaluasi backend sebelum progression/decision.
- Human approval tetap independen; reason wajib pada override, keputusan REVIEW_REQUIRED dan permintaan informasi. Override tidak melewati BLOCKED/OUTDATED/ACCESS_RESTRICTED.
- Activity menampilkan histori nyata; histori audit, upaya gagal, permintaan informasi lama dan keputusan tidak dihapus untuk menyederhanakan layar.

# Catatan UI/UX

- Shell navy, accent lime/green, tokens, kepadatan tabel dan responsive behavior existing dipertahankan.
- Komponen yang dipakai ulang: Origin UI DataTable existing, AskComposer, AnswerCard, SourcePanel, EvidenceChecklist, Dialog, primitive header/status/loading/error dan typed ApprovalPanel/WorkflowTimeline.
- Detail pekerjaan memakai judul bisnis; source/evidence mendahului tindakan review. Task yang telah selesai tetap berada di Progress dan tidak tampil sebagai tindakan berikutnya.
- Home memakai area kerja dan daftar review ringkas; empty state tanpa pekerjaan ditampilkan sebagai pesan pendek. Tidak ada placeholder modul masa depan dalam navigasi utama.
- Label Phase 0–3, Create Case, Start Workflow, Case Workspace, Decision Center, node type, revision counter dan ID runtime dihapus dari tampilan utama.
- MCP 21st.dev mencari pola task inbox/review queue/work-item list dan activity/progress timeline. Activity Timeline, Process Timeline, Agent Todo List, Task Board Kanban, Notification Panel, Agent Activity dan Agent Progress ditinjau melalui metadata.
- Retrieval source Activity Timeline ditolak karena kuota harian; tidak ada source vendor baru diadopsi atau dependency/design system baru ditambahkan. Rincian: [UI_REFERENCES.md](docs/UI_REFERENCES.md).

# Hasil Pengujian

Hasil aktual pass Fase 4 pada macOS arm64 (PostgreSQL embedded 18.4 lokal):

| Pemeriksaan             | Hasil aktual                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline sebelum Fase 4 | 84 backend dan 19 frontend unit lulus pada environment baru                                                                                      |
| Backend PostgreSQL      | **102 lulus** (84 regresi + 18 Fase 4: alur penuh, non-leakage, validasi owner/due date/authority, idempotency, stale, reset, analyzer)          |
| Backend SQLite          | **102 lulus**, termasuk lifecycle migrasi 0005                                                                                                   |
| Frontend unit           | **26 lulus** (19 lama + navigasi Compliance, work item review/remediation, Ask action, adapter regulatory)                                       |
| E2E Chromium            | **30 lulus**: 28 regresi Fase 0–3/product experience + journey Regulation-to-Action + role gating                                                |
| Formatter/lint/types    | Ruff format/check, Prettier, ESLint, TypeScript, `alembic check`, dan ketiga generated-contract checks lulus                                     |
| Production build        | Lulus, termasuk route `/regulatory`                                                                                                              |
| Inspeksi visual         | Desktop 1440 px dan mobile 390 px pada database test: nol horizontal overflow, nol page error; layout perbandingan diperbaiki menjadi full-width |
| Smoke database demo     | API port 8000 pada database `superflow` (migrasi 0005 + seed) melaporkan scope `phase-0-4` dan sumber regulasi                                   |

Docker tetap tidak tersedia di mesin ini; Compose belum dieksekusi. Screenshot inspeksi di `.runtime/screenshots/phase4` (diabaikan Git).

# Langkah Berikutnya yang Direkomendasikan

1. Tinjau bahasa gap, ambang cakupan obligation, dan pilihan approver remediation bersama process owner Compliance.
2. Pertimbangkan field tipe dokumen (regulation/SOP/control) dan dukungan perbandingan versi draft sebelum berlaku.
3. Verifikasi Docker Compose dan audit screen reader di lingkungan yang mendukung.
4. Mulai Fase 5 — Investment Intelligence hanya setelah instruksi eksplisit.
