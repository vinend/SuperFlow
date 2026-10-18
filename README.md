# SuperFlow

**Knowledge lintas divisi:** tambah enam PDF publik Finance, Operations/IT dan People di samping corpus OJK. Upload PDF baru atau versi PDF memaksa re-embedding seluruh shared knowledge base secara atomik, tanpa mengganti citation IDs. Ask menampilkan tahapan server, waktu berjalan, dan scope selama menunggu, dengan motion/reduced-motion pada workspace existing. Importer dan batas penggunaan referensi: [PUBLIC_KNOWLEDGE.md](docs/PUBLIC_KNOWLEDGE.md).

**Enable WebSearch** pada Ask menjalankan Puppeteer/Chromium dan Ollama vision di perangkat lokal untuk menambahkan konteks Internet/PDF ke jawaban. Job background/polling mendukung scan yang lama. Google pada jaringan pengujian mengembalikan 429/reCAPTCHA; statusnya ditampilkan, tanpa hasil buatan. Detail: [WEBSEARCH.md](docs/WEBSEARCH.md).

Update UI: referensi jawaban kini berlabel **From Knowledge Base** atau **Internet**, dengan badge PDF/OCR/Puppeteer/Vision scan sesuai provenance. Animasi ringan menghormati reduced motion. Verifikasi website OJK dengan Puppeteer dan vision lokal tersedia di [WEBSITE_CAPTURE.md](docs/WEBSITE_CAPTURE.md).

**Enterprise Knowledge-to-Action Platform**  
**From Trusted Knowledge to Measurable Action**

SuperFlow menghubungkan pengetahuan perusahaan dengan jawaban yang dapat ditelusuri, reliability, tindakan terkontrol, keputusan manusia, dan dampak bisnis. Workspace ini memakai data sintetis untuk memperagakan fondasi platform bagi Superbank.

Ask SuperFlow kini memakai **CopilotKit V2 + AG-UI** sebagai lapisan intent: permintaan bahasa alami membuka workspace Knowledge, Regulatory Review, Investment Analysis, Investigation Review, Impact, Work, atau review sesuai role. Komponen dan API domain yang sudah ada tetap menjadi sumber data dan kontrol. Mode deterministik tidak memerlukan Ollama.

Sumber produk aktif adalah **[SuperFlow_PRD_v2.md](SuperFlow_PRD_v2.md)**. Pengguna memahami empat pekerjaan: Ask SuperFlow untuk bertanya, Knowledge Library untuk membaca sumber, Work untuk tugas dan keputusan, serta Regulatory Review atau Investment Analysis sesuai peran. Home hanya menampilkan perhatian utama dan pintu masuk. Role demo utama: Employee, Manager, Compliance, Finance, Governance Admin. SME dan Compliance Checker tetap tersedia untuk pengujian internal dan proof point AML/FIU. Backend, izin, dan route langsung lama tetap dipertahankan.

**Demo terintegrasi:** panduan presenter tersedia hanya di [DEMO_PLAYBOOK.md](docs/DEMO_PLAYBOOK.md), dengan [alur video 4:03 menit](docs/FINAL_DEMO_FLOW.md) dan [peta fitur](docs/FEATURE_MAP.md); tidak ada halaman walkthrough di produk. Navigasi utama kini datar dan berpusat pada pekerjaan pengguna. Impact tidak tampil di menu utama; route `/impact` tetap tersedia langsung untuk analitik internal/manajemen dan demo. Route lama `/workflows` mengarah ke Work. Jalankan migrasi lalu `npm run demo:reset` bila ingin mengembalikan seluruh dataset presentasi sintetis secara atomik. Perintah ini menghapus data aplikasi pada database demo lokal yang dikonfigurasi. Presentasi membuka halaman pengguna sebenarnya: Ask, Work, Regulatory Review, dan Investment Analysis; proof point investigasi tetap opsional.

Rekaman aplikasi produksi dengan Qwen, RAG/OJK, OCR, Puppeteer/vision, WebSearch URL terpilih, CopilotKit, provenance, activity dan alur pekerjaan: [video WebM](artifacts/demo/superflow-demo.webm), [naskah singkat](artifacts/demo/DEMO_SCRIPT.md), dan [hasil verifikasi](artifacts/verification/FEATURE_VERIFICATION.md). Rekaman dibuat sebelum penyederhanaan UX terbaru; gunakan sebagai bukti kapabilitas, bukan contoh navigasi terbaru. Route analitik `/impact` tetap tersedia langsung. Google discovery yang terkena HTTP 429 ditampilkan sebagai keterbatasan nyata.

Rantai produk: **Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact**.

## RAG dan OCR dokumen

**Demo OJK nyata:** delapan PDF resmi (397 halaman, 1.101 chunk) tersedia melalui importer `npm run demo:ojk`, dengan LlamaIndex 0.14.25, embedding multilingual, BM25, persistent vectors, original bytes dan citation halaman/Pasal. Profil Ollama menghasilkan sintesis asli di kartu dinamis CopilotKit V2; tab dan konsep SuperFlow dipertahankan. Google search via Puppeteer tersedia di dialog Import website, dengan error eksplisit bila Google menolak akses (pemeriksaan aktual HTTP 429). Setup, matriks implementasi RPL, corpus, dan batasannya ada di [OJK_DEMO.md](docs/OJK_DEMO.md).

Ingestion kini mendukung OCR lokal untuk halaman PDF bergambar dan upload PNG/JPEG, metadata halaman/extraction, serta pencarian hybrid keyword + vektor BGE. Migrasi `0008` menyimpan vektor bersama chunk di PostgreSQL; permission dan versi diperiksa sebelum retrieval. Evidence OCR selalu memerlukan human review. Setup dependency, backfill `npm run rag:reindex`, konfigurasi `RETRIEVAL_PROVIDER=hybrid`, referensi repository RPL, dan batasannya ada di [RAG_OCR.md](docs/RAG_OCR.md). Pekerjaan sakelar demo/AI tetap dipause sesuai permintaan pengguna; modul ini tidak mengaktifkan generator AI secara otomatis.

## Arsitektur

**Import website:** Knowledge sekarang menyediakan Puppeteer headless + vision Ollama lokal, preview screenshot/DOM/observasi, dan penyimpanan draft dengan readers terkontrol. Bukti tersimpan mengikuti permission dokumen; jawaban dari website selalu membutuhkan human review. Setup model dan browser, batas coverage, serta pengujian ada di [WEBSITE_CAPTURE.md](docs/WEBSITE_CAPTURE.md).

| Lapisan   | Implementasi                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend  | Next.js 16.3.6, React, TypeScript, Tailwind, Lucide; token terpusat dan komponen workspace bertipe                    |
| API       | FastAPI, Pydantic, SQLAlchemy; REST dan pemeriksaan akses dasar server                                                |
| Database  | PostgreSQL 18; Alembic; metadata, versi, original bytes/checksum, chunk, saved questions, GuardResult, dan AuditEvent |
| Retrieval | Interface `Retriever`; adapter keyword/concept deterministik, filter akses/domain/sumber/versi, bobot authority       |
| Jawaban   | Interface `AnswerProvider`; extractive default atau sintesis lokal Ollama dengan structured output                    |
| Guard     | Evaluasi extractive deterministik, evidence requirements, konflik eksplisit, lima status dan audit                    |
| Analytics | QCD dari state operasional; controlled generative UI bertipe dan simulasi kapasitas yang diberi disclosure            |
| Workspace intent | CopilotKit V2/AG-UI headless di Next.js; FastAPI memilih intent dan mengotorisasi; registry workspace bertipe merender komponen existing |
| Pengujian | pytest/API, Node frontend unit tests, Playwright browser/E2E pada database terpisah                                   |

Pertanyaan dikirim ke API dengan identitas demo. Retrieval hanya membaca chunk dari sumber yang diizinkan. Provider default mengembalikan excerpt; provider Ollama opsional menyintesis jawaban terstruktur hanya dari excerpt authorized dan citation ID yang valid. SuperFlow Guard mengevaluasi reliability sebelum output dan selalu meminta human review untuk sintesis AI. API memeriksa akses dan hasil Guard lagi saat saved answer atau source dibuka. Frontend merender teks dan komponen terkontrol, tanpa HTML dari model.

Lihat [PRD aktif](SuperFlow_PRD_v2.md), [AGENTS.md](AGENTS.md), [rencana implementasi](IMPLEMENTATION_PLAN.md), [status aktual](IMPLEMENTATION_STATUS.md), [inference AI lokal](docs/LOCAL_INFERENCE.md), [Regulation-to-Action](docs/REGULATION_TO_ACTION.md), [Investment Intelligence](docs/INVESTMENT_INTELLIGENCE.md), [Impact Analytics](docs/IMPACT_ANALYTICS.md), dan [referensi UI/21st.dev](docs/UI_REFERENCES.md).

## Struktur proyek

```text
SuperFlow/
├── AGENTS.md
├── SuperFlow_PRD_v2.md
├── IMPLEMENTATION_PLAN.md
├── IMPLEMENTATION_STATUS.md
├── README.md
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
├── apps/
│   ├── web/
│   │   ├── app/                 Home, Ask, Knowledge, domain experiences, Impact, My Work, Reviews; stylesheet/token
│   │   ├── components/          Shell, controlled workspace, composer, answer, source, editor, primitive UI
│   │   └── lib/                 API client dan kontrak bertipe
│   └── api/
│       ├── superflow/           Model, route, parsing, retrieval, provider, seed
│       ├── migrations/          Alembic
│       └── tests/               Unit dan API tests
├── data/seed/                   Dokumen sintetis dan manifest versi
├── docs/                        Arsitektur fitur, metode Impact, dan provenance UI/21st.dev
├── scripts/                    Launcher Python/PostgreSQL dan persiapan E2E
└── tests/                      Browser journeys dan frontend unit tests
```

## Prasyarat

- Node.js 24 dan npm 11.17 atau lebih baru.
- Python 3.12 atau lebih baru.
- PostgreSQL 18 melalui Docker Compose, runner lokal, atau instance yang sudah tersedia.
- Tidak memerlukan API key AI berbayar.

Di workspace Windows ini tersedia runtime Python terisolasi `.runtime/python`, dependencies npm, Chromium, dan cluster PostgreSQL lokal. Berkas runtime diabaikan Git. Untuk checkout baru, ikuti setup berikut.

Inference nyata bersifat opsional. Ollama/Qwen dapat dijalankan secara native pada Windows atau melalui profile Docker dengan API loopback `127.0.0.1:11434`; lihat [panduan inference lokal](docs/LOCAL_INFERENCE.md). Pada workstation verifikasi, model `qwen3.5:0.8b` yang sama dapat dipakai untuk sintesis Ask dan vision website. Aktifkan dengan `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=qwen3.5:0.8b`, dan `VISION_MODEL=qwen3.5:0.8b` pada proses API. Tanpa Ollama, provider extractive deterministik tetap tersedia.

## Setup

Jalankan dari root repo. PowerShell dapat memblokir shim `npm.ps1`; gunakan `npm.cmd`.

```powershell
npm.cmd ci
Copy-Item .env.example .env
python -m venv .venv
$env:PYTHON = (Resolve-Path .venv/Scripts/python.exe).Path
& $env:PYTHON -m pip install -r apps/api/requirements-lock.txt
```

`requirements-lock.txt` berisi dependencies runtime/development yang diuji. Untuk lingkungan runtime saja, gunakan `apps/api/requirements.txt`.

macOS/Linux (terverifikasi pada macOS arm64, Node 24.16, npm 11.13, Python 3.12.13):

```bash
npm ci
cp .env.example .env
python3.12 -m venv .venv
.venv/bin/python -m pip install -r apps/api/requirements-lock.txt
echo "PYTHON=$PWD/.venv/bin/python" >> .env
PLAYWRIGHT_BROWSERS_PATH="$PWD/.runtime/playwright" npx playwright install chromium   # hanya untuk E2E
```

`embedded-postgres` memasang binary PostgreSQL untuk platform yang sesuai (termasuk `darwin-arm64`) dari lockfile.

Launcher Python mencari `PYTHON`, lalu `.runtime/python/python.exe`, lalu `python` sistem. Tetapkan `PYTHON` di tiap terminal atau `.env` bila memakai virtual environment. Launcher dan konfigurasi Next.js membaca `.env` root.

## Environment

| Variable                   | Nilai demo/default                                                       | Fungsi                                                 |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `DATABASE_URL`             | `postgresql+psycopg://superflow:superflow_demo@127.0.0.1:5432/superflow` | Database aplikasi                                      |
| `TEST_DATABASE_URL`        | URL yang sama dengan database `superflow_test`                           | Database test terpisah; nama harus berakhiran `_test`  |
| `CORS_ORIGINS`             | `http://localhost:3000,http://127.0.0.1:3000`                            | Origin frontend yang diizinkan API                     |
| `NEXT_PUBLIC_API_URL`      | `http://127.0.0.1:8000`                                                  | URL API yang diketahui browser; tetapkan sebelum build |
| `SUPERFLOW_API_URL`        | Opsional; memakai `NEXT_PUBLIC_API_URL` bila kosong                      | URL FastAPI dari runtime Next.js untuk agent workspace |
| `LLM_PROVIDER`             | `deterministic`                                                          | `ollama` mengaktifkan inference lokal Ask dan usulan tindakan investigasi yang tetap divalidasi backend |
| `OLLAMA_BASE_URL`          | `http://127.0.0.1:11434`                                                 | Endpoint Ollama dari proses FastAPI                    |
| `OLLAMA_MODEL`             | `qwen3.5:9b`                                                             | Model lokal                                            |
| `VISION_MODEL`             | `qwen3.5:0.8b`                                                           | Model multimodal lokal untuk screenshot website/WebSearch |
| `OLLAMA_NUM_CTX`           | `8192`                                                                   | Batas context runtime                                  |
| `OLLAMA_NUM_PREDICT`       | `512`                                                                    | Batas token keluaran untuk respons terkontrol          |
| `PYTHON`                   | Opsional; path interpreter                                               | Mengganti interpreter launcher                         |
| `PLAYWRIGHT_BROWSERS_PATH` | Opsional; `.runtime/playwright`                                          | Lokasi Chromium lokal                                  |

Password di atas khusus demo sintetis lokal. Jangan memasukkan kredensial produksi. Environment berawalan `NEXT_PUBLIC_` akan tersedia di browser.

CopilotKit memakai versi `1.75.2` dan AG-UI `0.0.59` dari lockfile. Aplikasi menonaktifkan telemetry CopilotKit. Runtime Next.js tersedia di `/api/copilotkit`; endpoint klasifikasi FastAPI ada di `POST /api/workspace-intent`. Saat runtime agent/Ollama tidak tersedia, intent deterministik dan navigasi domain langsung tetap dapat dipakai. Panduan: [Generative Workspace](docs/GENERATIVE_WORKSPACE.md).

Demo singkat: jalankan frontend/backend, buka `/ask`, lalu ketik `How many annual leave days do I get?` sebagai Employee. Coba `What changed in the latest regulation?` sebagai Compliance, `Analyze proposal A.` sebagai Finance, `Investigate alert AML-2026-001.` sebagai Compliance, `Where does reliability need attention?` sebagai Manager, `What do I need to do?`, dan `What needs my approval?` sebagai Manager. Hasilnya memakai state dan izin backend; tindakan material tetap meminta klik/konfirmasi manusia. PNG browser ada di `artifacts/screenshots/generative-workspace/`.

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

Jalankan perintah pembuatan hanya bila database test belum ada. `docker compose down` menghentikan server tanpa menghapus volume. Compose PostgreSQL dan profile Ollama sudah diverifikasi pada Docker Desktop/WSL 2.

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

API tidak membuat schema otomatis. Migrasi harus dijalankan terlebih dahulu. Seed menyediakan tujuh identitas (termasuk Compliance Checker), 13 dokumen/15 versi, template workflow, dan tiga investigasi sintetis. Seed berulang tidak menghapus upload, perubahan metadata, atau pertanyaan yang sudah tersimpan.

Satu dokumen hanya boleh memiliki satu versi active. Publikasi versi mengambil lock dokumen dan menandai versi active sebelumnya sebagai outdated dalam transaksi yang sama. Versi bertanggal efektif di masa depan harus draft.

### Reset demo Fase 0–7

Reset menghapus upload, perubahan metadata, dan pertanyaan pada database target lalu mengembalikan seed awal. Schema/migration tetap dipertahankan. Hanya PostgreSQL lokal dengan nama `superflow` atau `superflow_test` yang diterima; diperlukan flag eksplisit:

```powershell
npm.cmd run db:reset -- --confirm-synthetic-data
```

`DATABASE_URL` menentukan target. Tanpa flag tersebut atau untuk target lain, CLI menolak reset. Setelah reset, buka Home; URL saved answer/versi sebelum reset dapat menjadi tidak tersedia. Reset mencakup Knowledge Core, GuardResult, AuditEvent, Case, evidence requirements, workflow, task, approval, attempt, receipt, serta regulatory review/finding dan investment analysis sintetis. Impact tidak mempunyai tabel baru dan otomatis membaca ulang state operasional hasil reset. Untuk tiga demo workflow awal, jalankan `npm.cmd run demo:workflow` setelah reset. Playwright mereset database test sebelum suite agar demo browser dapat diulang.

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
| Manager / `manager`       | Arif Santoso  | Membaca, mengirim request, dan melakukan review independen            |
| SME / `sme`               | Nadia Rahman  | Membaca dan memelihara sumber yang dapat diakses                      |
| Compliance / `compliance` | Raka Wijaya   | Menjalankan Regulatory Review, memutuskan gap, menugaskan remediation |
| Finance / `finance`       | Dina Sari     | Menyiapkan Investment Analysis, memilih nilai sumber, submit approval |
| Governance / `governance` | Alex Pratama  | Membaca/memelihara semua sumber demo dan melihat Impact platform      |

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

Endpoint Fase 6: `GET /api/impact` mengembalikan overview QCD, sedangkan `POST /api/impact` menerima pertanyaan dampak dan mengomposisikan hanya komponen controlled generative UI yang disetujui. Keduanya role-gated dan tidak mengirim konten sumber milik role lain.

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
2. Buka Annual Leave Policy di Knowledge. Periksa owner, authority, akses, active v2.0, dan outdated v1.0. Pilih **Ask about this source** untuk membuka Ask dengan filter sumber tersebut.
3. Tanyakan **How many annual leave days do I get?**. Jawaban mengambil excerpt v2.0: 15 hari. Klik citation untuk melihat chunk, tanggal efektif, versi, owner, dan authority.
4. Aktifkan **Include historical versions** dan tanyakan lagi. v1.0 memuat 12 hari serta label outdated. Dari Source Panel, **Open document** membuka versi yang tepat. Refresh mempertahankan saved answer/filter atau detail versi dengan pemeriksaan API ulang.
5. Ganti ke Governance. Knowledge memuat 13 sumber seed termasuk proposal dan regulasi sintetis. Upload Markdown/TXT/PDF/DOCX, edit metadata, tambah versi, ubah status publikasi, atau re-index.
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

- Provider default berupa extract source deterministik. Provider Ollama opsional menghasilkan sintesis AI nyata. Retrieval dapat keyword/concept atau hybrid BGE lokal; Guard belum membuktikan semantic entailment, sehingga sintesis AI selalu REVIEW_REQUIRED. `Source-grounded` menunjukkan evidence/citation yang lolos validasi, bukan izin melakukan tindakan bisnis.
- OCR lokal dan hybrid retrieval tersedia dengan dependency opsional. Parser mendukung UTF-8 TXT/Markdown, PDF native/scan, DOCX, PNG/JPEG hingga 10 MB; batas halaman/piksel diterapkan. Scan tidak terbaca, file rusak/encrypted, atau OCR yang gagal ditolak dengan error jelas. Model embedding default berbahasa Inggris; inference OCR dan source evidence masih memerlukan pemeriksaan manusia.
- Guard memakai aturan extractive dan evidence/conflict terbatas pada skenario yang dikonfigurasi. Belum ada semantic conflict detection, ambiguity detection menyeluruh, atau confidence score. Calculation check hanya berlaku pada Investment Analysis; konteks lain menandainya tidak applicable.
- Impact Analytics sudah menghitung QCD dari data operasional yang tersedia, tetapi belum mempunyai filter periode, baseline organisasi yang dapat dikonfigurasi, snapshot warehouse, drill-down BI, export, atau alert. Capacity memakai asumsi prototype transparan dan selalu bertanda **Illustrative simulation**; bukan realized profit. Full Governance belum diimplementasikan. Investigation Review Fase 7 bersifat sintetis; tidak ada sistem nasabah/FIU nyata, filing, atau keputusan AML otomatis. Workflow masih code-defined, satu run per Case, mock authority, dan belum mempunyai scheduler/notifications produksi.
- AnswerCard, SourcePanel, EvidenceChecklist, ApprovalPanel, WorkflowTimeline, ComparisonTable, dan FinancialAnalysis fungsional. Impact memakai controlled generative UI: provider deterministik hanya dapat memilih komponen registry bertipe; tidak ada arbitrary HTML atau executable UI dari model. LLM structured-output dipakai untuk sintesis Ask dan opsional untuk usulan satu tindakan investigasi yang divalidasi allowlist backend; model tidak memilih komponen Impact.
- Pass frontend memakai MCP 21st.dev untuk pencarian dan inspeksi source tabel. Kuota gratis dua retrieval membatasi pemeriksaan source kandidat lain; komponen yang belum diperiksa tidak dipasang. Adopsi pola dan hasil pass dicatat di [FRONTEND_REFINEMENT.md](docs/FRONTEND_REFINEMENT.md).
- Docker Ollama dengan GPU NVIDIA dan API host-only sudah diverifikasi. PostgreSQL lokal nyata tetap dipakai oleh proses aplikasi saat verifikasi ini. Keyboard/browser diuji; audit screen reader lengkap belum dilakukan.
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

Seed demo opsional/idempotent menyediakan **Annual Leave Review**, **Supporting Evidence Request**, dan **Access Review Clarification**. Buka Work sebagai Employee, pilih request, dan gunakan **Information checked**. Reviewer membuka tab **Needs My Decision**; SME menggunakan route internal untuk pengujian. Reviewer dapat **Request More Information**; owner memilih **Provide supporting information**, menambahkan section/requirement, dan **Continue review**. Approval tetap independen, konflik tetap membutuhkan reason, dan refresh mempertahankan state. Governance Admin dapat override dengan reason setelah prerequisites lulus. Data demo lama tidak ditimpa atau diduplikasi; adapter menyajikan judul lamanya dalam bahasa pekerjaan.

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

## Pengalaman pengguna menurut PRD v2 dan instruksi UX terbaru

| Role | Navigasi produk |
| --- | --- |
| Employee | Home, Ask SuperFlow, Work, Knowledge Library |
| Manager | Home, Ask SuperFlow, Work, Knowledge Library |
| Compliance | Home, Ask SuperFlow, Regulatory Review, Work, Knowledge Library |
| Finance | Home, Ask SuperFlow, Investment Analysis, Work, Knowledge Library |
| Governance Admin | Home, Work, Knowledge Library |

SME dan Compliance Checker tetap merupakan peran backend untuk review dan proof point AML/FIU, tetapi tidak tampil dalam pemilih persona demo utama. `/impact` tetap dapat dibuka langsung sesuai izin.

Modul yang belum tersedia tidak menjadi navigasi utama. Governance Admin tetap mempunyai akses API Ask existing; navigasi mengikuti tugas control/review. Knowledge memakai permission `knowledge:write` existing untuk membatasi upload/edit/version/re-index.

**Work** menggabungkan proyeksi Case, workflow/tasks, approval, dan status kebutuhan informasi dari endpoint existing. Tab **My Tasks** menampilkan pekerjaan sendiri; **Needs My Decision** menampilkan keputusan yang berwenang. Adapter frontend `product-view.ts` tidak menyimpan state execution baru. Work item menampilkan judul bisnis, status, langkah saat ini, next action, owner/reviewer, due date bila ada, reliability, dan pembaruan terakhir. **Progress** menyembunyikan routing/node types dan cabang yang tidak terpilih. **Activity** menerjemahkan AuditEvent tanpa memperlihatkan payload JSON/revision.

Detail pekerjaan mengambil konteks lengkap langsung dari Case API, sehingga tidak menunggu daftar pekerjaan/review lain. Daftar agregasi masih mengikuti endpoint existing tanpa pagination; waktu pemuatannya dapat bertambah bersama jumlah data.

Tab **Needs My Decision** hanya menampilkan pending request dengan `allowed_actions` dari backend. Employee tidak mendapat tab keputusan atau kontrol approval. Backend tetap menentukan akses, independensi reviewer, kelengkapan evidence, dan concurrency.

### Demo Ask menuju Work

1. Employee bertanya annual leave lalu memilih **Request Review**, atau bertanya konflik access review lalu **Start Review**.
2. Periksa/edit judul bisnis dan pilih **Submit Request**. Frontend membuat Case dan memulai generic review memakai API existing; pengguna tidak memilih definisi workflow.
3. Request muncul di Work. Pilih **Information checked** untuk menjalankan pemeriksaan evidence dan routing reviewer existing.
4. Manager membuka tab **Needs My Decision**, membaca evidence/source/reliability, lalu Approve/Reject/Request More Information/Escalate. SME memakai route internal untuk pengujian. Override hanya sesuai authority backend dan reason wajib.
5. Refresh dan buka Activity untuk melihat keputusan/progress tersimpan.
6. Pertanyaan receipt tanpa dokumen pendukung menyediakan **Request Exception** sebagai request pengumpulan informasi. Consent eksplisit wajib; status BLOCKED tidak menjadi approval otomatis.

Creation dan start merupakan dua transaksi API existing. Jika start gagal, request yang sudah tersimpan dipakai kembali untuk retry dalam form; My Work tetap dapat membukanya. Tidak ada transaksi gabungan baru atau perubahan schema. Create Case belum memiliki idempotency backend, sehingga refresh form setelah respons creation hilang tetap memiliki keterbatasan existing.

## Regulation-to-Action — Fase 4

**Regulatory Review** membandingkan versi regulasi saat ini dengan versi sebelumnya, mengidentifikasi perubahan material, memetakan SOP/kontrol yang dapat diakses, dan mengusulkan gap. Compliance mengonfirmasi (boleh mengedit pernyataan) atau menolak setiap gap. Gap terkonfirmasi menjadi remediation dengan owner dan due date di My Work pemilik; approval Manager independen diperlukan sebelum review dapat ditutup. Semua analisis deterministik dan berbasis citation chunk nyata. Rincian arsitektur, aturan, API, dan batasan: [REGULATION_TO_ACTION.md](docs/REGULATION_TO_ACTION.md).

```bash
npm run db:migrate   # menambah migrasi 0005
npm run db:seed      # memasang template regulatory remediation (idempotent)
```

### Demo Regulatory Review

1. Pilih **Compliance — Raka Wijaya**. Home menampilkan "New current version v2.0 · not yet reviewed against v1.0". Buka **Regulatory Review**, pilih Synthetic Digital Operations Regulation (v1.0 → v2.0), klik **Start Regulatory Review**.
2. **What changed**: tiga perubahan material — Article 4 every 12 → 6 months, Article 7 within 72 → 24 hours, Article 9 3 → 5 years — masing-masing dengan obligation baru dan prosedur yang dipetakan. Klik **Inspect** untuk membuka chunk sumber (v1.0 ditandai historis).
3. **Gap review**: empat usulan. Contoh: tolak Access Review Control Policy dengan alasan; konfirmasi Access Review SOP dengan owner Alex Pratama (Governance). Memilih Employee sebagai owner ditolak karena tidak dapat mengakses regulasi. **Source reliability** menampilkan REVIEW_REQUIRED karena konflik 12 vs 6 bulan antar-kontrol saat ini.
4. Ganti ke **Governance**, buka My Work → "Update Access Review SOP for Article 4 — Access review" → **Remediation completed**.
5. Ganti ke **Manager** → Reviews / Approvals → Approve dengan alasan (wajib karena REVIEW_REQUIRED).
6. Kembali ke Compliance → review berstatus **Ready to close** setelah gap lain diputuskan dan semua remediation disetujui → **Close regulatory review**. Activity mencatat seluruh keputusan.

Dari Ask, Compliance yang menanyakan perubahan regulasi (mis. "What changed in the regulation?") mendapat tindakan **Start Regulatory Review**.

## Investment Intelligence — Fase 5

**Investment Analysis** membaca proposal beserta quotation, proyeksi cash flow, dan approval policy yang dapat diakses. SuperFlow mengekstrak asumsi dengan citation dan menampilkan nilai yang bertentangan. Finance wajib memilih nilai sumber mana yang dipakai, disertai alasan. NPV, IRR, ROI, payback, break-even, dan sensitivity dihitung dengan fungsi Python deterministik yang dites, lengkap dengan rumus, unit, dan periode. Draft memo dapat diedit. Submit membekukan hasil dan memo, lalu meminta approval dari authority yang ditentukan oleh threshold di approval policy. Rincian: [INVESTMENT_INTELLIGENCE.md](docs/INVESTMENT_INTELLIGENCE.md).

```bash
npm run db:migrate   # menambah migrasi 0006
npm run db:seed      # memasang template investment approval (idempotent)
```

### Demo Investment Analysis

1. Pilih **Finance — Dina Sari**. Home menampilkan dua proposal yang belum dianalisis. Buka **Investment Analysis**, pilih Workflow Modernization Proposal A. Sumber pendukung (Vendor A Quotation, Synthetic Cash Flow Projection, Investment Approval Authority) sudah tercentang. Klik **Prepare Analysis**.
2. **Source-backed assumptions**: initial investment **Sources conflict**, karena proposal dan proyeksi menyebut IDR 180.000.000 sedangkan quotation menyebut IDR 195.000.000. Hasil belum dihitung dan Source reliability REVIEW_REQUIRED dengan konflik di Evidence checklist.
3. Di **Conflicting inputs**, pilih IDR 195.000.000, isi alasan, lalu **Use selected value**. Tanpa alasan, pilihan ditolak.
4. **Financial analysis**: NPV IDR 11.041.254 @10%, IRR 12,59%, ROI 33,33%, payback 3 tahun, break-even IDR 61.516.807/tahun. Tabel sensitivity menunjukkan NPV negatif bila investasi naik 10%. Buka "How it is calculated" untuk melihat rumus.
5. Edit memo bila perlu, lalu **Submit for approval**. Route: department manager approval (IDR 195.000.000 ≤ IDR 250.000.000, dengan citation ke approval policy).
6. Ganti ke **Manager** → Reviews / Approvals → buka request. Hasil dan memo tampil sebelum kontrol keputusan. Approve dengan alasan (wajib karena authority proposal di bawah threshold).
7. Kembali ke Finance: analisis berstatus **Approved**, dan Activity mencatat pilihan, edit memo, submit, dan keputusan.

Proposal B tidak memiliki konflik, jadi langsung **Ready to submit**. Dari Ask, pertanyaan Finance tentang proposal/asumsi (mis. "What assumptions are in proposal A?") menawarkan **Prepare Analysis**.

## Impact Analytics — Fase 6

**Impact** mengubah state operasional menjadi gambaran Quality, Cost / Capacity, dan Delivery (QCD). Backend menghitung metrik dari QuestionRun, GuardResult, Case, Approval, dan AuditEvent yang lolos permission. Pengguna dapat bertanya tentang reliability, capacity, atau delivery; composer deterministik memilih dan mengurutkan hanya `ImpactBrief`, `MetricGroup`, `DistributionChart`, `CapacitySimulation`, dan `NextActions`. Payload Pydantic/TypeScript divalidasi sebelum dirender dan unknown component gagal secara aman. Rincian metode, permission, asumsi, API, dan batasan: [IMPACT_ANALYTICS.md](docs/IMPACT_ANALYTICS.md).

### Demo Impact

1. Buat beberapa hasil Ask dan pekerjaan/review agar state operasional mempunyai observasi nyata.
2. Pilih **Governance — Alex Pratama**, lalu buka `/impact` secara langsung untuk agregat platform sintetis. Impact tidak tampil di navigasi utama. Manager, SME, Compliance, dan Finance hanya melihat scope data yang dapat mereka akses; Employee tidak mendapat agregat Impact.
3. Periksa overview Quality, Cost / Capacity, dan Delivery. Metrik yang belum mempunyai observasi tampil sebagai **Not yet measured**, bukan nol rekaan.
4. Tanyakan **Where does reliability need attention?** untuk komposisi Quality, **How much capacity could be released?** untuk capacity, atau **What is slowing delivery?** untuk Delivery.
5. Pada Capacity, periksa semua asumsi dan label **Illustrative simulation**. Hours released dan illustrative cost avoidance adalah skenario soft-dollar, bukan penghematan terealisasi.

## Investigation Review — Fase 7

**Investigation Review** adalah proof point AML/FIU sintetis, bukan identitas produk atau koneksi sistem FIU nyata. Layar existing kini membaca `Investigation`, `CaseEvidence`, `ToolRun`, GuardResult, workflow, Approval, dan AuditEvent dari backend. Template demo mendefinisikan lima bukti wajib. Alat `get_customer_profile`, `summarize_transactions`, `run_watchlist_screening`, dan `search_adverse_news` hanya membaca fixture sintetis. Agent memilih tindakan dari allowlist dengan batas delapan langkah dan dua upaya per alat. Ollama boleh mengusulkan tindakan terstruktur yang divalidasi backend; planner deterministik tetap berjalan tanpa Ollama. Analis mencatat rekomendasi, kemudian checker Compliance yang berbeda memutuskan melalui Reviews / Approvals. Rincian arsitektur: [AML_FIU_INVESTIGATION.md](docs/AML_FIU_INVESTIGATION.md).

```bash
npm.cmd run db:migrate
npm.cmd run db:seed
# Reset eksplisit data sintetis lokal saja:
npm.cmd run db:reset -- --confirm-synthetic-data
```

Proof point internal: pilih Compliance — Raka Wijaya dan buka `/investigations` untuk alert sintetis. Checker Sinta tidak tersedia di pemilih demo biasa. Untuk pengujian terkontrol, set `localStorage.setItem("superflow.demo-user", "compliance_checker")` pada origin aplikasi lalu reload route `/investigations`; inspeksi bukti dan putuskan. Work dan Activity memakai state yang sama setelah refresh. Status reliability VERIFIED hanya berarti bukti wajib lulus; tidak ada kesimpulan AML atau keputusan pelaporan otomatis.
