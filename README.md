# SuperFlow

**Enterprise Knowledge-to-Action Platform**  
**From Trusted Knowledge to Measurable Action**

SuperFlow menghubungkan pengetahuan perusahaan dengan jawaban yang dapat ditelusuri, reliability, tindakan terkontrol, keputusan manusia, dan dampak bisnis. Workspace ini memakai data sintetis untuk memperagakan fondasi platform bagi Superbank.

Implementasi saat ini mencakup **Fase 0 — Skeleton**, **Fase 1 — Knowledge Core**, **Fase 2 — Reliability Core / SuperFlow Guard**, dan **Fase 3 — Workflow Core**. Ask mengembalikan hasil Guard, evidence, versi, dan citation nyata; audit tersimpan pada backend. Cases, Workflows, dan Decision Center aktif dengan state database, authority, dan audit. Analytics/Governance tetap `Later`; Fase 4 belum dimulai.

Rantai produk: **Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact**.

## Arsitektur

| Lapisan   | Implementasi                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend  | Next.js 16.3.6, React, TypeScript, Tailwind, Lucide; token terpusat dan komponen workspace bertipe                    |
| API       | FastAPI, Pydantic, SQLAlchemy; REST dan pemeriksaan akses dasar server                                                |
| Database  | PostgreSQL 18; Alembic; metadata, versi, original bytes/checksum, chunk, saved questions, GuardResult, dan AuditEvent |
| Retrieval | Interface `Retriever`; adapter keyword/concept deterministik, filter akses/domain/sumber/versi, bobot authority       |
| Jawaban   | Interface `AnswerProvider`; extractive demo provider tanpa kredensial AI eksternal                                    |
| Guard     | Evaluasi extractive deterministik, evidence requirements, konflik eksplisit, lima status dan audit                    |
| Pengujian | pytest/API, Node frontend unit tests, Playwright browser/E2E pada database terpisah                                   |

Pertanyaan dikirim ke API dengan identitas demo. Retrieval hanya membaca chunk dari sumber yang diizinkan. Provider mengembalikan excerpt beserta citation sebenarnya, lalu SuperFlow Guard mengevaluasi reliability sebelum output. API memeriksa akses dan hasil Guard lagi saat saved answer atau source dibuka. Frontend merender teks dan komponen terkontrol, tanpa HTML dari model.

Lihat [PRD](SuperFlow_PRD_v1.md), [AGENTS.md](AGENTS.md), [rencana implementasi](IMPLEMENTATION_PLAN.md), [status aktual](IMPLEMENTATION_STATUS.md), dan [referensi UI/21st.dev](docs/UI_REFERENCES.md).

## Struktur proyek

```text
SuperFlow/
├── AGENTS.md
├── SuperFlow_PRD_v1.md
├── IMPLEMENTATION_PLAN.md
├── IMPLEMENTATION_STATUS.md
├── README.md
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
├── apps/
│   ├── web/
│   │   ├── app/                 Home, Ask, Knowledge; stylesheet/token
│   │   ├── components/          Shell, composer, answer, source, editor, primitive UI
│   │   └── lib/                 API client dan kontrak bertipe
│   └── api/
│       ├── superflow/           Model, route, parsing, retrieval, provider, seed
│       ├── migrations/          Alembic
│       └── tests/               Unit dan API tests
├── data/seed/                   Dokumen sintetis dan manifest versi
├── docs/UI_REFERENCES.md        Catatan desain dan provenance 21st.dev
├── scripts/                    Launcher Python/PostgreSQL dan persiapan E2E
└── tests/                      Browser journeys dan frontend unit tests
```

## Prasyarat

- Node.js 24 dan npm 11.17 atau lebih baru.
- Python 3.12 atau lebih baru.
- PostgreSQL 18 melalui Docker Compose, runner lokal, atau instance yang sudah tersedia.
- Tidak memerlukan API key AI berbayar.

Di workspace Windows ini tersedia runtime Python terisolasi `.runtime/python`, dependencies npm, Chromium, dan cluster PostgreSQL lokal. Berkas runtime diabaikan Git. Untuk checkout baru, ikuti setup berikut.

## Setup

Jalankan dari root repo. PowerShell dapat memblokir shim `npm.ps1`; gunakan `npm.cmd`.

```powershell
npm.cmd ci
Copy-Item .env.example .env
python -m venv .venv
$env:PYTHON = (Resolve-Path .venv/Scripts/python.exe).Path
& $env:PYTHON -m pip install -r apps/api/requirements-lock.txt
```

`requirements-lock.txt` berisi dependencies runtime/development yang diuji. Untuk lingkungan runtime saja, gunakan `apps/api/requirements.txt`. Pada macOS/Linux, gunakan `npm` dan interpreter `bin/python` dari virtual environment.

Launcher Python mencari `PYTHON`, lalu `.runtime/python/python.exe`, lalu `python` sistem. Tetapkan `PYTHON` di tiap terminal atau `.env` bila memakai virtual environment. Launcher dan konfigurasi Next.js membaca `.env` root.

## Environment

| Variable                   | Nilai demo/default                                                       | Fungsi                                                 |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `DATABASE_URL`             | `postgresql+psycopg://superflow:superflow_demo@127.0.0.1:5432/superflow` | Database aplikasi                                      |
| `TEST_DATABASE_URL`        | URL yang sama dengan database `superflow_test`                           | Database test terpisah; nama harus berakhiran `_test`  |
| `CORS_ORIGINS`             | `http://localhost:3000,http://127.0.0.1:3000`                            | Origin frontend yang diizinkan API                     |
| `NEXT_PUBLIC_API_URL`      | `http://127.0.0.1:8000`                                                  | URL API yang diketahui browser; tetapkan sebelum build |
| `PYTHON`                   | Opsional; path interpreter                                               | Mengganti interpreter launcher                         |
| `PLAYWRIGHT_BROWSERS_PATH` | Opsional; `.runtime/playwright`                                          | Lokasi Chromium lokal                                  |

Password di atas khusus demo sintetis lokal. Jangan memasukkan kredensial produksi. Environment berawalan `NEXT_PUBLIC_` akan tersedia di browser.

## PostgreSQL

Pilih satu cara menjalankan database; jangan menjalankan dua server pada port 5432.

### Docker Compose

```powershell
docker compose up -d --wait postgres
```

Compose membuat `superflow` dan `superflow_test`, bind `127.0.0.1:5432`, dan volume persisten. Script pembuatan database test hanya dijalankan saat volume baru diinisialisasi. Pada volume lama yang belum memilikinya:

```powershell
docker compose exec postgres psql -U superflow -d superflow -c "CREATE DATABASE superflow_test OWNER superflow;"
```

Jalankan perintah pembuatan hanya bila database test belum ada. `docker compose down` menghentikan server tanpa menghapus volume. Docker belum tersedia di mesin pemeriksaan ini; Compose belum diuji eksekusinya.

### Runner lokal tanpa Docker

```powershell
npm.cmd run db:local
```

Biarkan terminal berjalan. Dependency development `embedded-postgres` menjalankan **PostgreSQL nyata 18.4**, menyimpan cluster di `.runtime/postgres`, dan membuat kedua database. Ctrl+C menghentikan server. Jika npm memblokir install script binary di Windows x64:

```powershell
npm.cmd approve-scripts @embedded-postgres/windows-x64 unrs-resolver
```

Untuk instance yang sudah ada, buat database aplikasi/test dan sesuaikan kedua URL. Reset otomatis sengaja dibatasi untuk target demo lokal yang disebutkan di bawah.

## Migrasi dan seed

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
```

API tidak membuat schema otomatis. Migrasi harus dijalankan terlebih dahulu. Seed menyediakan enam identitas dan 13 dokumen/15 versi. Seed berulang tidak menghapus upload, perubahan metadata, atau pertanyaan yang sudah tersimpan.

Satu dokumen hanya boleh memiliki satu versi active. Publikasi versi mengambil lock dokumen dan menandai versi active sebelumnya sebagai outdated dalam transaksi yang sama. Versi bertanggal efektif di masa depan harus draft.

### Reset demo Fase 0–3

Reset menghapus upload, perubahan metadata, dan pertanyaan pada database target lalu mengembalikan seed awal. Schema/migration tetap dipertahankan. Hanya PostgreSQL lokal dengan nama `superflow` atau `superflow_test` yang diterima; diperlukan flag eksplisit:

```powershell
npm.cmd run db:reset -- --confirm-synthetic-data
```

`DATABASE_URL` menentukan target. Tanpa flag tersebut atau untuk target lain, CLI menolak reset. Setelah reset, buka Home; URL saved answer/versi sebelum reset dapat menjadi tidak tersedia. Reset mencakup Knowledge Core, GuardResult, AuditEvent, Case, evidence requirements, workflow, task, approval, attempt, dan receipt sintetis Fase 0–3. Untuk tiga demo workflow awal, jalankan `npm.cmd run demo:workflow` setelah reset. Playwright mereset database test sebelum suite agar demo browser dapat diulang.

## Menjalankan backend

```powershell
npm.cmd run dev:api
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Health: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- OpenAPI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Menjalankan frontend

Di terminal lain:

```powershell
npm.cmd run dev
```

Frontend: [http://127.0.0.1:3000](http://127.0.0.1:3000).

Untuk build produksi, hentikan frontend development lalu jalankan:

```powershell
npm.cmd run build
npm.cmd start
```

## Identitas demo

| Role / `X-User-Id`        | Nama sintetis | Akses                                                                 |
| ------------------------- | ------------- | --------------------------------------------------------------------- |
| Employee / `employee`     | Maya Putri    | Membaca sumber yang diizinkan dan bertanya                            |
| Manager / `manager`       | Arif Santoso  | Membaca, membuat Case, dan independent generic review                 |
| SME / `sme`               | Nadia Rahman  | Membaca dan memelihara sumber yang dapat diakses                      |
| Compliance / `compliance` | Raka Wijaya   | Membaca dan bertanya; belum ada regulation comparison                 |
| Finance / `finance`       | Dina Sari     | Membaca dan bertanya; belum ada financial analysis                    |
| Governance / `governance` | Alex Pratama  | Membaca/memelihara semua sumber demo; modul Governance belum tersedia |

Role switcher menyimpan ID pilihan di browser. Header `X-User-Id` diterima API dan dipakai untuk pemeriksaan akses. Pergantian role mengosongkan workspace yang sedang tampil. Ini mock identity, bukan login/SSO atau autentikasi produksi.

## API Knowledge / Guard

Endpoint knowledge/Ask memerlukan `X-User-Id`. Health dan daftar identitas sintetis bersifat publik.

| Endpoint                                                        | Fungsi                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/health`, `GET /api/users`                             | Kesiapan database dan identitas demo                                           |
| `GET /api/documents`                                            | Katalog sesuai akses; filter opsional `domain`/`search`                        |
| `GET /api/documents/{id}`                                       | Metadata, versi, dan chunk                                                     |
| `POST /api/documents`                                           | Multipart `file`, JSON `metadata`, `version`, `effective_date`, `status`       |
| `PATCH /api/documents/{id}`                                     | Memperbarui metadata lengkap                                                   |
| `POST /api/documents/{id}/versions`                             | Menambahkan file versi immutable                                               |
| `PATCH /api/documents/{id}/versions/{version_id}?status=active` | Status publikasi                                                               |
| `POST /api/documents/{id}/index`                                | Re-index original file dengan ID citation stabil                               |
| `GET /api/documents/{id}/versions/{version_id}/file`            | Download original sesuai akses                                                 |
| `POST /api/ask`                                                 | Pertanyaan, domain, `document_ids`, `include_outdated`                         |
| `GET /api/ask`                                                  | Maksimal 20 pertanyaan terakhir milik identitas aktif yang masih dapat diakses |
| `GET /api/ask/{id}`, `GET /api/ask/{id}/sources`                | Saved answer/filter/reliability dan source yang diotorisasi ulang              |

Endpoint Fase 2: `GET /api/ask/{id}/reliability` dan `GET /api/audit?run_id=...`. Audit hanya milik identitas aktif, maksimal 200 event; tidak ada modul Governance UI atau endpoint mutasi audit. Kontrak check/status dapat dilihat di OpenAPI.

## Pengujian

Dengan PostgreSQL berjalan:

```powershell
npm.cmd run lint:api
npm.cmd run format:api
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run test:api
npm.cmd run test:web
npm.cmd run build
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.runtime/playwright"
npm.cmd exec playwright -- install chromium
npm.cmd run test:e2e
```

`TEST_DATABASE_URL` dari terminal/root `.env` memilih PostgreSQL untuk backend tests. Tanpa nilai tersebut, suite memakai SQLite terisolasi; aplikasi tetap memakai PostgreSQL. Fixture test memakai transaksi yang di-rollback. Database test harus berakhiran `_test`.

Playwright menjalankan API pada port 8001 dan frontend 3001 dengan output `.next-e2e`, serta melakukan migrasi/reset **database test**. Jangan menjalankan backend tests dan E2E bersamaan pada database test yang sama. Main demo database tidak diubah oleh E2E. Upload browser test meninggalkan dokumen sintetis hingga reset suite berikutnya. Laporan/trace di `playwright-report`/`test-results` diabaikan Git.

Windows sandbox dapat memblokir worker Next.js/Chromium, download dependency, dan direktori sementara pytest; jalankan dengan izin proses yang sesuai. Lihat [hasil verifikasi](IMPLEMENTATION_STATUS.md) untuk batasan mesin ini.

## Demo flow Fase 0/1

1. Buka Home sebagai **Employee — Maya Putri**. Dari seed awal role ini melihat lima dokumen. Ask, sumber terbaru, dan pertanyaan tersimpan berada dalam satu workspace.
2. Buka Annual Leave Policy di Knowledge Hub. Periksa owner, authority, akses, active v2.0, dan outdated v1.0. Pilih **Ask about this source** untuk membuka Ask dengan filter sumber tersebut.
3. Tanyakan **How many annual leave days do I get?**. Jawaban mengambil excerpt v2.0: 15 hari. Klik citation untuk melihat chunk, tanggal efektif, versi, owner, dan authority.
4. Aktifkan **Include historical versions** dan tanyakan lagi. v1.0 memuat 12 hari serta label outdated. Dari Source Panel, **Open document** membuka versi yang tepat. Refresh mempertahankan saved answer/filter atau detail versi dengan pemeriksaan API ulang.
5. Ganti ke Governance. Knowledge Hub memuat 13 sumber seed termasuk proposal dan regulasi sintetis. Upload Markdown/TXT/PDF/DOCX, edit metadata, tambah versi, ubah status publikasi, atau re-index.
6. Tanyakan isi dokumen baru dengan source filter. Jawaban memakai chunk tersimpan, bukan hasil frontend hardcoded.
7. Tanyakan **quasar neutrino spectrum** untuk hasil tanpa evidence. Guard menghasilkan BLOCKED tanpa citation palsu. Coba pergantian role, dialog lewat keyboard, dan navigasi mobile.

## Demo Fase 2 — SuperFlow Guard

Sebagai Employee, jalankan lima skenario berikut. Gunakan All domains dan All sources kecuali disebutkan.

| Status            | Pertanyaan dan scope                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| VERIFIED          | `How many annual leave days do I get?` — Annual Leave Policy, historical off |
| OUTDATED          | `annual leave days historical v1` — Annual Leave Policy, historical on       |
| ACCESS_RESTRICTED | `What is the investment approval authority?` — All sources                   |
| BLOCKED           | `Can I reimburse an expense without a receipt?` — Expense Reimbursement SOP  |
| REVIEW_REQUIRED   | `How often are access rights reviewed?` — All sources                        |

Buka Evidence checklist/Guard checks, inspect citation, dan active replacement pada historical result. Refresh harus mempertahankan reliability. Restricted result tidak mempunyai excerpt/citation/title sumber terlarang. Reset CLI mengembalikan kelima skenario secara deterministik.

Arsitektur, kontrak, precedence status, aturan coverage, model audit, generator TypeScript, dan batasan terperinci tersedia di [SUPERFLOW_GUARD.md](docs/SUPERFLOW_GUARD.md).

## Keterbatasan prototype

- Jawaban berupa extract source deterministik, bukan reasoning/synthesis LLM. `Source-grounded` menunjukkan retrieval; VERIFIED berasal dari check Guard yang eksplisit dan tidak berarti izin melakukan tindakan bisnis.
- Belum ada OCR atau semantic/vector retrieval. Parser mendukung UTF-8 TXT/Markdown, PDF berbasis teks, DOCX hingga 10 MB. File kosong, rusak, encrypted, atau textless ditolak dengan error yang jelas.
- Guard memakai aturan extractive dan evidence/conflict terbatas pada skenario yang dikonfigurasi. Belum ada semantic conflict detection, ambiguity detection menyeluruh, atau confidence score. Calculation check ditandai tidak applicable.
- Analytics, full Governance, regulation comparison/remediation, financial analysis, AML/FIU, dan pengukuran penghematan belum diimplementasikan. Workflow memakai satu definisi generic review, satu run per Case, mock authority, dan evidence source chunk; belum scheduler/notifications/tool runtime.
- AnswerCard, SourcePanel, EvidenceChecklist, ApprovalPanel, dan WorkflowTimeline fungsional. ComparisonTable dan FinancialAnalysis tetap deferred; belum ada engine Generative UI dinamis.
- Pass frontend memakai MCP 21st.dev untuk pencarian dan inspeksi source tabel. Kuota gratis dua retrieval membatasi pemeriksaan source kandidat lain; komponen yang belum diperiksa tidak dipasang. Adopsi pola dan hasil pass dicatat di [FRONTEND_REFINEMENT.md](docs/FRONTEND_REFINEMENT.md).
- Docker tidak tersedia pada mesin pemeriksaan; PostgreSQL lokal nyata digunakan untuk verifikasi. Keyboard/browser diuji; audit screen reader lengkap belum dilakukan.
- Dokumen seed berbahasa Inggris dipertahankan sebagai fixture retrieval sintetis. Panduan proyek menggunakan Bahasa Indonesia; AGENTS/PRD dan file instruksi Next.js mengikuti bahasa sumbernya.

Audit PostgreSQL memiliki trigger append-only untuk UPDATE/DELETE/TRUNCATE, dengan pengecualian DELETE pada reset demo eksplisit. Database owner dapat mengubah trigger; audit ini bukan WORM produksi. Role masih mock identity.

## Workflow Core — Fase 3

Case menyimpan QuestionRun context dan GuardResult existing. Workflow definition versi 1.0 memakai TASK → GUARD → CONDITION → human APPROVAL → TERMINAL. Missing/outdated evidence menghentikan progression; konflik ke SME; generic verified ke Manager. Approval tetap independen dari owner/requester.

Migrasi 0004 menambah Case/evidence relationships, definition/run/steps/attempts, tasks, approvals, dan idempotency receipts. Transaksi memakai Case row lock, source metadata locks, serta expected_revision; stale/double actions mendapat 409. Retry maksimum dua, fallback manual review, escalation Governance, dan audit existing tetap persisten. Override wajib reason dan tidak dapat melewati Guard prerequisites.

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run demo:workflow
```

Seed demo workflow opsional/idempotent menyediakan A verified annual leave, B missing source, dan C access review conflict. Semua mulai pada task evidence. Buka Cases sebagai Employee, complete task, lalu ganti ke reviewer yang ditugaskan. Pada B, reviewer Request evidence, owner Attach source evidence beserta requirement, Resume, lalu independent approval. Pada C, SME membaca kedua source dan mencatat alasan keputusan. Refresh mempertahankan state. Governance dapat override dengan reason setelah prerequisites lulus.

API execution:

- POST/GET `/api/cases`, GET/PATCH `/api/cases/{id}`, POST `/api/cases/{id}/evidence`.
- GET `/api/workflow-definitions`, POST `/api/workflows/{id}/start`.
- GET `/api/workflow-runs` dan `/{id}`; POST `/{id}/advance`, `/retry`, `/escalate`.
- GET `/api/tasks`; POST `/{id}/start` dan `/complete`.
- GET `/api/approvals` dan `/{id}`; POST `/{id}/approve`, `/reject`, `/request-evidence`, `/escalate`, `/override`.

Semua mutasi Case existing memakai `expected_revision`; `idempotency_key` opsional. Mutasi/read detail execution mengembalikan CaseView agar frontend tidak menghitung status. Queue/list hanya menampilkan context yang masih authorized. Creator/owner tidak dapat self-approve. Assignment role untuk type finance/compliance/audit tidak menambahkan analysis domain.

Kontrak frontend workflow dihasilkan dari backend:

```powershell
node scripts/python.mjs scripts/generate-workflow.py
npm.cmd exec prettier -- --write apps/web/lib/workflow-contracts.ts
node scripts/python.mjs scripts/generate-workflow.py --check
```

Rincian state machine, permission/Guard, retry/fallback, audit, API, demo, dan batasan: [WORKFLOW_CORE.md](docs/WORKFLOW_CORE.md). Hasil quality gate aktual ada di IMPLEMENTATION_STATUS.md. Home/Ask/Knowledge existing dipertahankan; tidak ada fake KPI atau arbitrary AI HTML.
