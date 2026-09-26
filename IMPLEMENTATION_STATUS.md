# Status Implementasi SuperFlow

**Diperbarui:** 27 September 2026

**Sumber produk aktif:** [SuperFlow_PRD_v2.md](SuperFlow_PRD_v2.md). PRD v1 sudah digantikan dan tidak digunakan untuk keputusan produk/UX saat ini.

**Ruang lingkup:** rekonsiliasi Product Experience di atas fondasi Fase 0–3. Fase 4 belum dimulai. Backend tetap menjadi sumber kebenaran.

**Status:** selesai untuk scope prototype; quality gate dan inspeksi produksi final lulus.

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

- Fase 4: regulation comparison, SOP impact mapping, gap assessment dan remediation-specific logic.
- Investment Intelligence/rumus keuangan, analytics/QCD, AML/FIU dan full Governance.
- ComparisonTable, FinancialAnalysis, autentikasi produksi, notifikasi/integrasi eksternal dan visual workflow builder.
- Regulatory Review dan Investment Analysis tidak ditampilkan sebagai fitur aktif.

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

| Pemeriksaan          | Hasil aktual                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend PostgreSQL   | **84 lulus**: permission/non-leakage, Guard, Case/workflow/task/approval, retry/fallback/escalation, persistence, idempotency dan audit                    |
| Backend SQLite       | **84 lulus**, termasuk lifecycle migrasi/reset                                                                                                             |
| Frontend unit        | **19 lulus**: adapter role/work/review/progress/activity, source/reliability dan decision validation                                                       |
| E2E Chromium         | **28 lulus** pada run final; regresi Fase 0–3, delapan pemeriksaan product experience, refresh detail tanpa API daftar dan concurrent decision             |
| Formatter/lint/types | Ruff format/check, Prettier, ESLint, TypeScript serta kedua generated-contract checks lulus                                                                |
| Production build     | Lulus untuk seluruh route existing; frontend produksi berjalan pada port 3000                                                                              |
| Backend produksi     | FastAPI port 8000 dengan PostgreSQL nyata; schema Fase 0–3 tetap dipertahankan                                                                             |
| Inspeksi produksi    | Lulus: enam role, Ask/request/source/version, request informasi/resume, konflik SME, retry limit/fallback, escalation/override, activity dan denied source |
| Responsive/visual    | Desktop 1440 px dan narrow 375/390/768 px diperiksa; nol overflow dan nol browser page errors pada inspeksi produksi                                       |

Database test terpisah dari database aplikasi. Inspeksi produksi memakai request sintetis baru tanpa reset atau menghapus pekerjaan pengguna. Pemeriksaan retry/fallback mengubah extract pada context request khusus; sumber seed tidak diubah. Screenshot tersimpan di `.runtime/screenshots/product-experience` dan diabaikan Git.

# Langkah Berikutnya yang Direkomendasikan

1. Tinjau bahasa tindakan, independence reviewer dan kesesuaian evidence bersama process owner.
2. Verifikasi Docker Compose dan audit screen reader di lingkungan yang mendukung.
3. Evaluasi idempotency create/start, autentikasi dan audit produksi sebelum deployment nyata.
4. Mulai Fase 4 hanya setelah instruksi eksplisit; pass ini berakhir pada rekonsiliasi pengalaman pengguna Fase 0–3.
