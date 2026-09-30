# Status Implementasi SuperFlow

**Diperbarui:** 30 September 2026

**Sumber produk aktif:** [SuperFlow_PRD_v2.md](SuperFlow_PRD_v2.md). PRD v1 sudah digantikan dan tidak digunakan untuk keputusan produk/UX saat ini.

**Ruang lingkup:** Fase 0–7 dan rekonsiliasi Product Experience sudah diimplementasikan untuk scope prototype sintetis. Fase 7 adalah proof point AML/FIU di atas fondasi bersama. Fase 8 belum dimulai.

**Status:** UI mockup Investigation Review dari commit `4c88fb0` dipertahankan dan dihubungkan ke investigasi persisten, adapter sintetis, Guard, workflow checker, serta audit. Tidak ada koneksi Transaction Monitoring, watchlist, berita, Getcontact, atau nasabah nyata.

# Fase 7 — AML/FIU Investigation Review

## Selesai untuk prototype sintetis

- Route `/investigations` dan navigasi **Investigation Review** khusus role Compliance memakai shell, token warna, tipografi, spacing, button, serta pola responsive SuperFlow existing.
- Tiga alert sintetis menampilkan profil subjek, source of funds, transaksi, indikator triage, status evidence, activity, dan rekomendasi analis.
- Evidence collection kini dieksekusi API melalui empat adapter sintetis allowlist; `ToolRun`, provenance, CaseEvidence, GuardResult, dan AuditEvent tersimpan di PostgreSQL. Lima syarat bukti berasal dari template demo, bukan aturan AML universal.
- UI menggunakan label prioritas triage HIGH dengan indikator eksplisit; angka 82/100 mockup dihapus.
- Analis menyimpan rekomendasi, kemudian mengirim ke workflow `aml-investigation-v1`. Compliance Checker sintetis yang berbeda menerima Approval existing di Reviews / Approvals. My Work membuka investigasi dan menampilkan progres.
- Skenario lengkap, alat gagal/retry, dan konflik dapat di-reset secara deterministik. Agent dibatasi delapan langkah dan dua upaya per alat, dengan planner deterministik serta planner Ollama opsional yang hanya boleh mengusulkan tindakan yang diizinkan backend.

## Batasan saat ini

- Seluruh identitas, transaksi, hasil screening, adverse news, rating, dan activity bersifat sintetis.
- Tidak ada integrasi eksternal, screenshot dari sistem nyata, pembuatan berkas regulator, atau keputusan STR/SAR. Tool result hanya fixture sintetis dengan fingerprint SHA-256 dari payload JSON tersimpan.
- Triage HIGH adalah kategori deterministik dari empat indikator fixture, bukan probabilitas pencucian uang. Guard VERIFIED hanya berarti persyaratan bukti yang dikonfigurasi lulus.
- Alur FIU memakai mock role switcher; bukan autentikasi atau entitlement produksi. Checker hanya bisa membaca investigasi yang ditugaskan.

# Inference AI Lokal — Ollama Docker

## Selesai

- Profile Compose `ai` menjalankan Ollama `0.34.1` dengan volume model persisten, API yang hanya bind ke loopback host, healthcheck, dan reservasi satu GPU NVIDIA. Profile `model` menarik model default `qwen3.5:9b` tanpa memasukkan model ke repository.
- `AnswerProvider` tetap vendor-neutral: default deterministik masih dapat dipakai tanpa model; `LLM_PROVIDER=ollama` mengaktifkan sintesis Ask nyata. Runtime menerima hanya excerpt yang sudah lolos permission dan retrieval backend.
- Output memakai schema Pydantic terkontrol, thinking dinonaktifkan, output dibatasi 512 token, dan citation ID divalidasi terhadap context authorized. Output invalid/unavailable gagal aman dengan 503 dan tidak menyimpan jawaban setengah jadi. Tanpa evidence, model tidak dipanggil.
- Guard memberi policy `guard-local-ai-grounding-v1`: citation coverage tetap diperiksa, tetapi seluruh sintesis AI diberi `REVIEW_REQUIRED` karena semantic entailment belum dibuktikan otomatis.
- Verifikasi aktual Windows/Docker Desktop: container healthy di `127.0.0.1:11435`, CUDA mendeteksi RTX 4070 Laptop GPU, dan `ollama ps` melaporkan model berjalan 100% GPU pada direct smoke 4096 context. Port `11434` milik runtime WSL yang sudah ada tidak diubah.
- Smoke end-to-end `POST /api/ask` menghasilkan jawaban baru dari `ollama-grounded-v1` dalam 7,55 detik dengan tiga chunk Annual Leave Policy nyata, status `REVIEW_REQUIRED`, serta citation/source dapat dibuka di AnswerCard. Request ke sumber yang tidak dapat diakses menghasilkan nol source dan tidak menambah panggilan Ollama.
- Browser verification pada aplikasi berjalan membuktikan Home/Ask termuat tanpa error overlay, AnswerCard AI tampil, lima citation action ter-render, dan tiga Evidence source tersedia.

## Batasan

- Inference nyata dipakai untuk sintesis Ask dan opsional untuk usulan satu tindakan investigasi yang divalidasi allowlist backend. Retrieval, ImpactComposer, Regulatory Review, dan Investment Analysis tetap deterministik.
- Cold start model pertama lebih lambat. Qwen `9b` dengan context 8192 memakai sebagian CPU/GPU pada perangkat 8 GB VRAM; batas output mencegah generasi panjang yang tidak terukur.
- Konfigurasi aktif workstation memakai port `11435` untuk menghindari konflik dengan Ollama WSL di `11434`; default repository tetap `11434` dan dapat dioverride lewat environment.

# Fase 6 — Impact Analytics

## Selesai

- Pengalaman **Impact** untuk Manager, SME, Compliance, Finance, dan Governance. Employee tidak melihat menu dan mendapat 403 dari API. Governance melihat agregat data sintetis platform; role lain hanya melihat QuestionRun miliknya dan Case yang lolos pemeriksaan akses backend.
- Quality observed: citation coverage, verified rate, konflik terdeteksi, information requested/rework, dan historical-source result. Nilai berasal dari GuardEvaluation/AuditEvent persisted; QuestionRun internal untuk konteks Case tidak dihitung sebagai pertanyaan pengguna.
- Delivery observed: answer time dari audit `question_submitted` → `result_returned`, work cycle time, active backlog, completed throughput, completion rate, approval review time, dan escalation. Metrik tanpa observasi tampil **Not yet measured**, bukan nol rekaan.
- Cost / Capacity memisahkan volume observed dari simulasi. Asumsi prototype ditampilkan: lookup 15 → 3 menit, controlled work 90 → 45 menit, loaded capacity cost IDR 150.000/jam. Hours released, capacity value/item, dan cost avoidance selalu bertanda **Illustrative simulation** dan tidak disebut realized profit.
- Controlled generative UI: `ImpactComposer` mengklasifikasikan intent overview/quality/capacity/delivery dan hanya dapat mengomposisikan `ImpactBrief`, `MetricGroup`, `DistributionChart`, `CapacitySimulation`, serta `NextActions`. Provider deterministik tidak memerlukan kredensial AI. Tidak ada HTML, JavaScript, permission, rumus, atau angka yang dihasilkan model.
- Pydantic menjadi kontrak utama dan menghasilkan TypeScript melalui `scripts/generate-analytics.py`. Frontend memvalidasi payload, action href, kind metrik, dan disclosure simulasi; unknown component gagal secara aman.
- API: `GET /api/impact` untuk overview sesuai scope role dan `POST /api/impact` untuk komposisi berdasarkan pertanyaan. Tidak ada migrasi baru karena analytics membaca state operasional Fase 0–5.
- Frontend: route `/impact`, navigasi role-aware, composer tanpa chat bubble, visual QCD, distribution, asumsi capacity, next action, loading/error/empty state, dan responsive layout.

## Batasan Fase 6

- Belum ada filter periode, baseline organisasi yang dapat dikonfigurasi, business calendar, snapshot warehouse, trend historis, drill-down BI, export, atau alert.
- Simulasi capacity memakai asumsi prototype statis dan transparan. Process owner perlu memvalidasi baseline sebelum penggunaan selain demo.
- Composer masih deterministik. Integrasi LLM structured-output dapat ditambahkan di balik Protocol existing, tetapi tetap harus tunduk pada registry dan validasi yang sama.
- Audit visualization mengelompokkan event yang diizinkan ke bahasa pengguna; ini belum merupakan observability/BI platform penuh.

# Fase 5 — Investment Intelligence

## Selesai

- **Investment Analysis** untuk Finance. Alurnya: pilih proposal dengan sumber pendukung yang dapat diakses (default dari relasi dokumen), lalu asumsi diekstrak dengan citation chunk nyata dan kalimat sumbernya.
- Konflik seed ditampilkan: initial investment IDR 180.000.000 (Proposal A, proyeksi) vs IDR 195.000.000 (Vendor A Quotation). Kalkulasi ditahan sampai Finance memilih nilai sumber dengan alasan wajib. SuperFlow tidak pernah memilih nilai sendiri, dan angka bebas tidak diterima.
- Kalkulasi deterministik (`finance_calc.py`): NPV, IRR, ROI, payback, break-even inflow, dan sensitivity satu-variabel ±10/20%. Setiap hasil menampilkan rumus, unit, dan periode. Nilai referensi: NPV A @10% dengan quotation = IDR 11.041.254, IRR 12,59%, payback 3 tahun.
- Guard `calculation_validity` menjadi pemeriksaan nyata untuk analisis. Input missing → BLOCKED (misalnya tanpa approval policy), conflict → REVIEW_REQUIRED, dengan citation di Evidence checklist. Proposal ber-authority 2 membuat approval wajib beralasan.
- Draft memo deterministik yang dapat diedit. Submit membekukan hasil, memo, route, dan input. Routing approval mengikuti threshold di sumber approval policy: ≤ limit ke Manager, di atasnya ke komite (Governance). Finance tidak dapat self-approve. Request More Information mengembalikan analisis ke Finance.
- Frontend: navigasi Finance, `/investment`, `FinancialAnalysis` (registry _available_), `AssumptionTable`/`InputDecision` (evidence sebelum kontrol), memo editor, Home Finance, konteks analisis di layar review approver, My Work, dan Ask (**Prepare Analysis**). Kontrak TS di-generate dari Pydantic.
- Migrasi `0006` (satu tabel). Seed memasang template approval, dan reset mencakup data Fase 5. Endpoint generic start workflow menolak Case analisis. Database demo lokal sudah dimigrasi ke 0006 dan di-seed.

## Perubahan kecil pada kode Fase 0–4

- `GuardInput.calculation` opsional, `evaluate_run(..., calculation)`, dan registry `cases.CALCULATION_INPUTS`. Konteks tanpa kalkulasi tidak berubah perilakunya. Teks check diganti dari "…performed in Phase 2" menjadi "Not applicable: this context involves no calculation." (label fase tidak boleh tampil ke user). Test Guard/E2E disesuaikan.
- Routing tipe Case (manager→finance/compliance/sme) kini hanya berlaku untuk definisi generic review. Definisi domain menyebut role-nya sendiri. Perilaku generic review tidak berubah.
- `managed_by_domain` menjadi `domain_kind`: start workflow generic ditolak untuk review regulatory dan analisis investment, sedangkan attach evidence hanya ditolak untuk regulatory.

## Batasan Fase 5

- Ekstraksi berbasis pola kalimat seed; belum ada OCR, spreadsheet, atau pemahaman semantik. Model cash flow memakai inflow tetap tanpa pajak, inflasi, nilai sisa, atau pembiayaan. Semua angka sintetis dan ilustratif.
- Memo yang sudah diedit tidak ikut diperbarui saat input berubah (ditandai "edited"). Komite investasi disimulasikan oleh Governance.
- Setelah submit, analisis dibekukan. Informasi tambahan diberikan lewat evidence existing, tanpa resubmit kalkulasi.

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

- Fondasi Next.js/FastAPI/PostgreSQL, migrasi Alembic, seed/reset, tujuh identitas demo, upload/parsing, metadata, versi immutable, publikasi, re-index dan download tetap tersedia.
- Ask, retrieval authorized, citation document/version/chunk nyata, SourcePanel, saved questions, lima status SuperFlow Guard, EvidenceItem dan AuditEvent dipertahankan.
- Case, WorkflowDefinition/Run/Step, Task, Approval, retry/fallback/escalation, authority, row locks, expected_revision dan idempotency receipts tetap menggunakan implementasi Fase 3. Tidak ada migrasi atau engine baru dalam pass ini.
- Navigasi berbasis role: Employee mendapat Home/Ask SuperFlow/Knowledge/My Work; Manager, SME, Compliance, Finance, dan Governance mendapat Impact sesuai scope datanya, di samping Reviews / Approvals dan pengalaman domain yang relevan.
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

- Workflow tetap code-defined dengan satu run per Case. Tool runtime Fase 7 hanya empat adapter sintetis allowlist; belum scheduler, notification, atau konektor produksi.
- Evidence attachment berupa source chunk yang authorized dan current. Kesesuaian makna evidence tetap memerlukan penilaian reviewer.
- Guard memakai provider extractive dan aturan konflik eksplisit; belum pemeriksaan semantik menyeluruh, OCR atau vector retrieval.
- Identitas demo belum SSO/entitlement produksi. Role switcher dipertahankan untuk demo.
- Audit append-only pada ORM/PostgreSQL belum WORM eksternal; database owner dapat mengubah trigger. Reset adalah maintenance exception eksplisit.
- Keyboard, dialog dan responsive diperiksa; audit screen reader lengkap belum dilakukan.

# Belum Diimplementasikan

- Demo polish (Fase 8), integrasi FIU nyata, dan full Governance.
- Autentikasi produksi, notifikasi/integrasi eksternal, dan visual workflow builder.

# Masalah yang Diketahui

- Pembuatan request dan start review memakai dua transaksi API existing. Jika start gagal, request tetap tersimpan; form menyimpan referensinya untuk retry start tanpa membuat Case kedua pada lifecycle form yang sama.
- Create Case belum memiliki receipt idempotency untuk respons yang hilang atau refresh di tengah submit. Busy state mengurangi submit ganda; mutasi execution existing tetap memakai revision/idempotency backend.
- Route internal `/cases`, `/workflows` dan `/decisions` dipertahankan untuk stabilitas URL. Label produk mengikuti PRD v2; legacy `/workflows` membuka My Work.
- Daftar My Work/Reviews masih memakai endpoint agregasi existing tanpa pagination. Waktu pemuatan meningkat ketika jumlah pekerjaan/histori bertambah; detail pekerjaan sudah tidak bergantung pada pemuatan daftar tersebut.
- Data operasional/test lama tidak dihapus. Adapter menerjemahkan judul demo lama yang dikenal; judul pengguna tetap dipertahankan.
- Higher-authority escalation tidak tersedia setelah Governance atau bila reviewer independen authorized tidak tersedia; API mengembalikan konflik yang jelas.
- Reset mengganti ID sumber dan menghapus execution/audit sintetis; URL lama dapat tidak tersedia.
- PostgreSQL aplikasi Fase 7 dijalankan pada port 5432, dimigrasikan ke revisi `0007`, lalu diisi ulang dengan seed sintetis. Suite E2E memakai database test terpisah. Profile Docker Ollama diverifikasi pada pass sebelumnya.
- MCP 21st.dev membatasi retrieval source harian. Komponen yang source/dependencies-nya tidak dapat diinspeksi tidak dipasang.
- Sandbox Windows menghalangi beberapa proses worker/temp; pemeriksaan yang memerlukan subprocess dijalankan dengan izin yang sesuai. Warning HTTPX/Starlette dan NO_COLOR/FORCE_COLOR tidak menggagalkan tes.
- `npm run format:check` repository penuh melaporkan 81 file lama dengan drift Prettier/line-ending Windows. Semua file yang diubah/ditambah pada Fase 6 lulus pemeriksaan Prettier terarah; file lama tidak diformat massal untuk menghindari diff yang tidak terkait.

# Rekonsiliasi Product Experience

- Mental model produk: Knowledge → Evidence → Decision → Action. Pengguna membuka My Work dan Reviews, bukan memilih entitas Case/WorkflowRun/Approval.
- Adapter bertipe `product-view.ts` membentuk WorkItemView, WorkProgressView dan ReviewItemView dari state API. Adapter tidak menyimpan state bisnis atau membuat permission/reliability engine kedua.
- Case tetap workspace domain-neutral. Guard, evidence, source authorization, workflow transitions, retry limit, fallback dan human authority tidak diganti.
- Backend Fase 6 menambah service/route analytics baca-saja dan kontrak komponen, tanpa mengubah models, migrations, permission execution, concurrency, atau audit service existing.
- Request dari Ask menggunakan referensi run/sumber authorized. Informasi terbatas tidak disalin. Reliability tetap terlihat dan dievaluasi backend sebelum progression/decision.
- Human approval tetap independen; reason wajib pada override, keputusan REVIEW_REQUIRED dan permintaan informasi. Override tidak melewati BLOCKED/OUTDATED/ACCESS_RESTRICTED.
- Activity menampilkan histori nyata; histori audit, upaya gagal, permintaan informasi lama dan keputusan tidak dihapus untuk menyederhanakan layar.

# Catatan UI/UX

- Shell navy, accent lime/green, tokens, kepadatan tabel dan responsive behavior existing dipertahankan.
- Komponen yang dipakai ulang: Origin UI DataTable existing, AskComposer, AnswerCard, SourcePanel, EvidenceChecklist, Dialog, primitive header/status/loading/error dan typed ApprovalPanel/WorkflowTimeline.
- Detail pekerjaan memakai judul bisnis; source/evidence mendahului tindakan review. Task yang telah selesai tetap berada di Progress dan tidak tampil sebagai tindakan berikutnya.
- Home memakai area kerja dan daftar review ringkas; empty state tanpa pekerjaan ditampilkan sebagai pesan pendek. Tidak ada placeholder modul masa depan dalam navigasi utama.
- Impact memakai komposisi typed di server dan renderer registry eksplisit di client. Composer, hook fetch, dan renderer dipisah; Employee tidak memicu fetch analytics. Evidence metode dan asumsi tampil bersama angka, bukan tersembunyi di tooltip.
- Label Phase 0–3, Create Case, Start Workflow, Case Workspace, Decision Center, node type, revision counter dan ID runtime dihapus dari tampilan utama.
- MCP 21st.dev mencari pola task inbox/review queue/work-item list dan activity/progress timeline. Activity Timeline, Process Timeline, Agent Todo List, Task Board Kanban, Notification Panel, Agent Activity dan Agent Progress ditinjau melalui metadata.
- Retrieval source Activity Timeline ditolak karena kuota harian; tidak ada source vendor baru diadopsi atau dependency/design system baru ditambahkan. Rincian: [UI_REFERENCES.md](docs/UI_REFERENCES.md).

# Hasil Pengujian

Hasil aktual pass Fase 7 pada Windows, dengan PostgreSQL aplikasi dan database test terpisah:

| Pemeriksaan          | Hasil aktual                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend API          | **135 lulus**, termasuk tool registry, provenance, retry, planner, Guard, checker independen, audit, idempotency, dan non-leakage lintas role                           |
| Frontend unit        | **34 lulus**, termasuk adapter My Work dan akses checker, serta regresi Fase 0–6                                                                                       |
| E2E Chromium         | **38 lulus** pada PostgreSQL nyata: perjalanan investigasi lengkap, gagal/retry, konflik, akses role, refresh, dan regresi Fase 0–6                                    |
| Formatter/lint/types | Ruff format/check, ESLint, TypeScript, dan Prettier terarah untuk file Fase 7 lulus; catatan baseline repository ada di known issues                                    |
| Production build     | Lulus, termasuk route `/investigations`, `/impact`, `/investment`, dan `/regulatory`                                                                                   |
| Responsive           | Chromium produksi pada 1440 px dan 390 px: tidak ada horizontal overflow atau page error pada Investigation Review                                                     |

Migrasi `0007` serta seed/reset lokal dijalankan pada PostgreSQL port 5432; API produksi kembali memberi health `ok` dengan tujuh pengguna sintetis dan tiga investigasi. Suite E2E memakai database `superflow_test`. Skenario desktop/mobile juga diperiksa langsung pada build produksi.

# Langkah Berikutnya yang Direkomendasikan

1. Validasi asumsi baseline capacity, loaded capacity cost, dan definisi cycle time bersama process owner sebelum penggunaan selain demo.
2. Tambahkan filter periode dan snapshot/trend hanya setelah definisi business calendar serta retention analytics disepakati.
3. Tinjau bahasa memo/approval bersama Finance dan bahasa gap/remediation bersama Compliance.
4. Lanjutkan audit screen reader dan normalisasi baseline Prettier di pass terpisah.
5. Setelah Fase 7 stabil, rencanakan Fase 8 secara terpisah; jangan hubungkan FIU ke data nyata tanpa desain keamanan dan otorisasi produksi.
