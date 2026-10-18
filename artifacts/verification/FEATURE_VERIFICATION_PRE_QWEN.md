# SuperFlow Feature Verification

Tanggal: 18 Oktober 2026. Branch `main`, HEAD `a1c36d6`. Pemeriksaan dilakukan pada checkout ini dan aplikasi yang benar-benar berjalan. Status **PASS** berarti perilaku diamati dari proses/browser nyata; hasil test fixture saja diberi batasan.

## Environment

- Windows, Node 24.19.0, npm 11.17.0, Python 3.12.10; Next.js 16.3.6, Playwright Chromium lokal, PostgreSQL 18.4 lokal.
- `npm ls` mengonfirmasi `puppeteer-core@25.14.0`, `motion@14.3.0`, `@copilotkit/react-core@1.75.2`, `@copilotkit/runtime@1.75.2`, dan `@ag-ui/core@0.0.59` benar-benar terpasang.
- Dependensi npm awal tidak lengkap (`puppeteer-core`, `motion/react`). `npm.cmd install --prefer-offline` memasangnya. Dependensi RAG/OCR Python awal juga tidak ada; dipasang dari `apps/api/requirements-rag-lock.txt`. Tidak ada kredensial yang diperlukan untuk mode deterministik.
- Server produksi lokal: `127.0.0.1:3000` dan API `127.0.0.1:8000`. Health `200`, PostgreSQL `ok`, retrieval `hybrid`/`llamaindex`, embedding multilingual MiniLM, OCR dan web capture enabled, inference `deterministic-extractive-v1`. Proxy `/api/backend/api/health` juga `200`.
- Frontend, API, dan PostgreSQL lokal dihentikan setelah seluruh pemeriksaan; data dan artefak tetap tersimpan.
- Ollama/model vision **tidak tersedia** pada mesin ini (tidak ada service di `11434` maupun binary lokal). Sintesis AI, website vision, dan WebSearch Ask penuh tidak dapat dikonfirmasi. Fallback extractive berjalan.
- Browser Playwright tersimpan di `.runtime/playwright`, sehingga preview website yang dijalankan dari API perlu `WEB_BROWSER_EXECUTABLE=C:\Life\Superthon\SuperFlow\.runtime\playwright\chromium-1243\chrome-win64\chrome.exe` pada lingkungan ini. Tanpa path tersebut, API mengembalikan 422 generik; setelah path diset, preview halaman publik mencapai tahap vision dan mengembalikan 503 yang tepat karena Ollama offline.
- Google discovery nyata oleh Puppeteer menghasilkan HTTP **429**, nol result links, screenshot ber-hash. Tidak ada klaim hasil Google atau grounding web yang sukses.
- Setelah impor ulang delapan OJK PDF dan enam PDF publik, API `rag/status` menunjukkan **27 dokumen, 1.437/1.437 chunk terindeks, nol unready**. Data ini berasal dari database lokal yang dimigrasi dan di-seed tanpa reset database aplikasi; run Ask baru memiliki ID baru, bukan cache browser lama.

## Recent Changes Reviewed

| Commit | Checklist perubahan yang diverifikasi |
| --- | --- |
| `fab25e3` | CopilotKit V2/AG-UI, intent backend dan controlled workspace |
| `b4743a1` | `/demo`, dataset presentasi, Playwright journey |
| `b66c4a9` | OCR, embedding lokal, hybrid retrieval, Puppeteer/website capture |
| `650d872` | LlamaIndex/RPL, PDF OJK resmi, regulatory answer card |
| `dbbd6fe` | Label asal evidence, Motion dan reduced motion |
| `9497da3` | Google discovery/WebSearch dengan vision lokal dan snapshot privat |
| `a1c36d6` | Enam sumber publik lintas divisi, refresh vektor atomik, Ask activity |

## Summary

Status keseluruhan: **PARTIAL**. Platform inti, local RAG/OJK, OCR, CopilotKit workspace, reliability, dan demo terintegrasi dapat dijalankan. Jalur yang bergantung Ollama dan Google belum dapat ditunjukkan sukses. Ada satu masalah relevance: beberapa pertanyaan tidak terkait tetap menerima potongan OJK.

Total fitur pada matriks: 17. Passed: 10. Partial: 3. Failed: 1. Blocked by external/local dependency: 3.

## Feature Matrix

| Feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Local RAG | PASS | API Ask employee dengan `domain=People`, `document_ids=leave-policy`: 15 hari dari 3 chunk Annual Leave Policy; `VERIFIED`; `rag/status` | Mode `hybrid` + LlamaIndex benar-benar aktif, bukan jawaban fixture. Unfiltered retrieval punya masalah relevance yang dicatat di bawah. |
| Ask grounded responses tanpa filter sumber | FAIL | Live Ask untuk cuti Employee mencampur OJK yang tidak terkait; sejumlah pertanyaan fiktif juga mendapat citation OJK dan `REVIEW_REQUIRED` | False relevance dapat membuat jawaban tampak berdasar sumber yang salah. Jalur source-scoped pada video berhasil, tetapi default Ask belum layak untuk pertanyaan bebas tanpa evaluasi ranking/Guard. |
| Embedding pipeline | PASS | `rag:reindex`; `rag/status` 27 dokumen, 1.437/1.437 chunk terindeks setelah public import; 14 real-model/backend OCR tests | Model multilingual ONNX diunduh dan dijalankan lokal. |
| Public knowledge expansion | PASS | Enam PDF diimpor; Ask Finance → FDIC halaman 4, Operations → NIST CSF halaman 10, People → ILO Practical Guide halaman 6; screenshot `10-public-finance.png` sampai `12-public-people.png` | Masing-masing `REVIEW_REQUIRED`; referensi publik tidak diperlakukan sebagai kebijakan internal Superbank. |
| Local inference | BLOCKED | Health menunjukkan `deterministic-extractive-v1`; port Ollama `11434` tutup | Fallback extractive benar-benar bekerja; sintesis Ollama tidak diuji. |
| OCR | PASS | Opt-in `tests/rag-ocr.spec.ts` 1 passed; 14 targeted backend tests | PDF image-only → OCR → upload/index → Ask → citation/Source Panel → original bytes. |
| Puppeteer | PASS | `puppeteer-capture.json`, `screenshots/puppeteer-example.png`; `google-discovery.json` | Chromium lokal membuka `example.com`, membaca 917 karakter, mengambil screenshot dengan SHA-256. Google memberi 429. |
| Governed website capture | PARTIAL | Puppeteer nyata; API preview dengan browser path mencapai 503 vision unavailable; backend/Playwright fixture tests | End-to-end preview → vision → save draft tidak dapat dijalankan tanpa Ollama; metadata dan permission path diuji otomatis. |
| Website/vision | BLOCKED | Ollama tidak tersedia | Tidak ada observasi vision nyata pada run ini. |
| WebSearch grounding | BLOCKED | `google-discovery.json`: HTTP 429, nol links; `tests/web-search.spec.ts` memakai route fixture | UI blocked state teruji; tidak ada jawaban yang benar-benar di-grounding oleh Google saat verifikasi. |
| Official OJK/RPL corpus | PASS | Delapan PDF diunduh/checksum cocok dan diimpor; Ask Compliance mengutip POJK 21/2023 Pasal 9 halaman 5 pertama; `REVIEW_REQUIRED` | Validitas hukum/current applicability tidak disimpulkan. |
| CopilotKit | PASS | `demo-run.json`: POST `/api/copilotkit/agent/workspace/run`; package/import terpasang; screenshot `06-generated-review.png` | Headless CopilotKit V2/AG-UI memilih intent; backend tetap memegang data dan kontrol. |
| Generative UI | PASS | Prompt “What changed in the latest regulation?” → region `Generated workspace` → tabel perbandingan regulasi | Ini komposisi dinamis dari katalog komponen terkontrol, bukan HTML arbitrer dari model. |
| Evidence origin labels | PASS | `05-ojk-source.png`: “From Knowledge Base”, PDF, publisher, version, page/Pasal; OCR browser test; frontend unit labels | Label Internet pada WebSearch diuji dengan fixture; real Internet snapshot tidak tersimpan di run ini. |
| Live Ask activity | PARTIAL | `tests/ask-activity.spec.ts` 2 passed, backend progress tests; `demo-run.json` memuat dua GET `/api/ask-progress/...` nyata | UI stage/reduced motion diuji dengan progress response terkontrol; inference panjang nyata tidak tersedia untuk memeriksa setiap stage live. |
| Accessibility/motion | PASS | E2E reduced motion, keyboard/dialog, mobile width; recorded production browser `pageErrors=[]` | Peringatan Motion/Lit saat dev bukan error produksi. |
| Integrated demo workflow | PARTIAL | `superflow-demo.webm`, sembilan screenshot, real API/AG-UI requests; `/demo` dan My Work | Jalur inti sukses; vision/WebSearch tidak disisipkan sebagai sukses. |

## Automated Tests

| Command | Result | Details |
| --- | --- | --- |
| `npm.cmd run lint` | PASS | ESLint. |
| `npm.cmd run typecheck` | PASS | Awalnya gagal karena package `motion` tidak terpasang; lulus setelah install. |
| `npm.cmd run test:web` | PASS | 42/42; awalnya 40 pass, 1 import error `puppeteer-core`, kemudian lulus setelah install. |
| `npm.cmd run lint:api` | PASS | Ruff. |
| `npm.cmd run format:api` | PASS | 81 file terformat. |
| `npm.cmd run test:api -- -p no:cacheprovider --tb=short` | PASS | 208 passed, 2 skipped; 1 Starlette/httpx deprecation warning. Jalankan di luar sandbox karena pytest temp permission. |
| `SUPERFLOW_TEST_LOCAL_MODELS=1` targeted `test_rag_ocr.py` | PASS | 14 passed, OCR dan embedding model nyata. |
| `npm.cmd run test:e2e` (awal) | FAIL | 57 passed, 1 failed, 3 skipped; Regulatory Review click belum selesai navigasi saat locator diuji. |
| `npm.cmd run test:e2e -- --grep 'Compliance turns a regulation change into approved remediation'` (sesudah fix) | PASS | 1 passed. |
| `npm.cmd run test:e2e` (rerun kedua) | FAIL | 57 passed, 1 failed, 3 skipped; `/demo` client navigation belum selesai dalam timeout URL lima detik. |
| `npm.cmd run test:e2e -- --grep 'walkthrough switches identity, opens prepared work and survives refresh'` (sesudah fix) | PASS | 1 passed. |
| Opt-in `npm.cmd run test:e2e -- tests/rag-ocr.spec.ts` | PASS | 1 passed dengan `SUPERFLOW_TEST_LOCAL_MODELS=1`. |
| `npm.cmd run test:e2e` (rerun ketiga) | FAIL | 57 passed, 1 failed, 3 skipped; reduced-motion activity test mengukur overflow tepat saat resize, sebelum layout stabil. |
| `npm.cmd run test:e2e -- --grep 'Ask activity reports live stages and stays usable with motion reduce'` | PASS | 1 passed setelah assertion menunggu layout stabil. |
| `npm.cmd run test:e2e` (rerun keempat) | FAIL | 57 passed, 1 failed, 3 skipped; heading `Impact` kini ambigu dengan heading `Impact across quality, capacity, and delivery` pada test role change. |
| `npm.cmd run test:e2e -- --grep 'role change clears generated Impact data and reauthorizes'` | PASS | 1 passed setelah locator heading dibuat exact. |
| `npm.cmd run test:e2e` (rerun kelima/final) | PASS | 58 passed, 3 skipped (5,2 menit). Skip opt-in: OJK live download, OCR local model, website vision; OCR diuji terpisah dan OJK diuji lewat API/browser produksi. |
| `npm.cmd run build` | PASS | Production build. Ada bundler warning dynamic dependency dari `@ai-sdk/google-vertex` yang terbawa CopilotKit. |
| `npm.cmd run format:check` | FAIL | 85 file yang sudah tidak sesuai Prettier; tidak diformat massal karena di luar cakupan verifikasi. |

## Browser / Console Findings

- Rekaman produksi: `pageErrors=[]`, tidak ada HTTP 5xx yang tertangkap pada sequence, request CopilotKit dan Ask benar-benar terjadi (`demo-run.json`).
- Permintaan live Employee yang dibatasi ke `proposal-a` menghasilkan nol sumber, `BLOCKED`, dan tidak menampilkan nilai investasi restricted. E2E juga memeriksa role-aware navigation, Source Panel, My Work, Reviews, mobile, serta keputusan manusia.
- LOW: Lit dev-mode, Motion reduced-motion notice, serta `NO_COLOR`/`FORCE_COLOR` dari dev test server; tidak muncul sebagai kegagalan produk pada produksi.
- LOW: warning dynamic dependency dari paket Google Vertex yang dibawa CopilotKit pada build. Build dan runtime berjalan.
- LOW: test server mencatat peringatan CopilotKit single-route envelope saat pemuatan `/api/copilotkit` info. Request `/api/copilotkit/agent/workspace/run` pada rekaman produksi berhasil; tidak ada page error. Pesan `Agent execution failed` pada suite berasal dari test yang sengaja memutus AG-UI untuk memeriksa fallback.
- MEDIUM (belum ditriase): `npm install` melaporkan 25 advisory dependency (7 low, 5 moderate, 13 high). Ini hasil audit paket, bukan bukti exploit pada jalur SuperFlow yang diuji. Tidak menjalankan `npm audit fix` karena dapat mengubah dependency di luar scope verifikasi.
- HIGH: retrieval dapat memberi sumber OJK yang tidak relevan untuk pertanyaan “pasta on Mars”, “blue pineapple protocol”, dan “pet dragon”. Pertanyaan “extraterrestrial spaghetti on Neptune” menghasilkan nol sumber dan `BLOCKED`. Ini masalah kualitas retrieval/Guard yang perlu evaluasi threshold dan entailment; jangan anggap semua jawaban bercitation relevan.
- HIGH: Ask cuti Employee tanpa filter domain/sumber dapat mencampur potongan OJK publik ke jawaban Annual Leave, sehingga banner “Official OJK evidence” dan `REVIEW_REQUIRED` muncul pada pertanyaan kebijakan internal. Dengan sumber `leave-policy` dipilih secara eksplisit, tiga chunk cocok dan status `VERIFIED`. Rekaman final memakai pilihan sumber yang terlihat di UI.
- MEDIUM: tanpa `WEB_BROWSER_EXECUTABLE` pada instalasi Playwright lokal nondefault, API preview mengembalikan 422 “Cannot capture this URL” untuk `example.com` meskipun capture langsung berhasil. Dengan path dikonfigurasi, API mengembalikan 503 vision unavailable; setup dan pesan error perlu dibuat lebih spesifik.
- External: Google 429 dan Ollama offline membatasi jalur vision/WebSearch.

## Bugs Found

1. **HIGH — false relevance/source mixing**: Ask hybrid kadang memberi 6 kutipan OJK dan `REVIEW_REQUIRED` pada prompt fiktif yang tidak terkait. Pertanyaan cuti Employee tanpa filter juga tercampur OJK; jawaban sumber tunggal `leave-policy` benar dan `VERIFIED`. Perlu evaluasi ranking dan gating lintas domain sebelum demo Ask tanpa filter.
2. **MEDIUM — E2E assertions**: Regulatory Review dan `/demo` test langsung memeriksa UI/URL saat client navigation Next.js masih menampilkan halaman sebelumnya. Reduced-motion Ask test langsung mengukur lebar dokumen tepat setelah resize. Test Impact memakai locator parsial yang cocok dengan dua heading. Test sekarang menunggu URL/kondisi layout yang stabil dan memilih heading exact.
3. **LOW — formatting debt**: 85 file gagal `format:check` sebelum perubahan luas apa pun.
4. **MEDIUM — browser path/error copy**: API website preview melaporkan 422 seolah URL tidak dapat diakses ketika Chromium default tidak ditemukan. Pengaturan path menjadikan hasil 503 vision unavailable yang sesuai.

## Fixes Made

- Instalasi dependency yang memang ditentukan lockfile, tanpa perubahan dependency manifest.
- `tests/regulatory.spec.ts` dan `tests/demo.spec.ts`: tunggu URL rute tujuan setelah klik sebelum menguji UI; kedua targeted journey lulus. `tests/ask-activity.spec.ts`: poll overflow setelah viewport berubah. `tests/generative-workspace.spec.ts`: gunakan heading exact pada assertion Impact. Kedua targeted retest terakhir lulus.
- Tidak mengubah backend retrieval tanpa evaluasi threshold terhadap recall OJK.

## Remaining Risks

- Ollama/Qwen vision dan sintesis Ask belum diverifikasi pada mesin ini. Google 429 memblokir discovery otomatis; tidak dilakukan CAPTCHA bypass.
- Vision website hanya memindai viewport terbatas dan membutuhkan review manusia menurut desain.
- Pada Next dev server di bawah beban suite, client navigation kadang memerlukan lebih dari lima detik; test sekarang menunggu rute tujuan hingga 30 detik. Performa navigasi perlu diukur terpisah pada build produksi sebelum presentasi langsung.
- Penilaian applicability OJK tidak dilakukan oleh sistem; source adalah referensi publik yang `REVIEW_REQUIRED`.
- `RETRIEVAL_PROVIDER=hybrid` dengan relevance floor 0,30 dapat memberi sumber kebetulan pada prompt nonsense; perlukan benchmark query negatif dan positif sebelum demo terbuka.
- Mock identity/header peran bukan autentikasi produksi. Situs dan dataset demo sintetis kecuali PDF referensi publik.
- Advisory dependency dari npm perlu ditriase per paket dan jalur pemakaian sebelum rilis publik.

## Reproduce Locally

Jalankan dari root repo pada workstation dengan Node 24, Python 3.12, Chromium Playwright, dan PostgreSQL. Pada checkout ini runtime Python dan Chromium sudah ada di `.runtime`.

```powershell
# Terminal 1
npm.cmd run db:local
```

```powershell
# Persiapan satu kali / bila database belum terisi; terminal 2
npm.cmd install --prefer-offline
& .runtime/python/python.exe -m pip install -r apps/api/requirements-rag-lock.txt
npm.cmd run db:migrate
npm.cmd run db:seed
$env:EMBEDDING_MODEL='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
npm.cmd run rag:reindex
npm.cmd run demo:ojk
npm.cmd run demo:public

# API live; terminal yang sama tetap terbuka
$env:RETRIEVAL_PROVIDER='hybrid'
$env:RETRIEVAL_ENGINE='llamaindex'
$env:SEMANTIC_MIN_SCORE='0.30'
$env:RETRIEVAL_TOP_K='6'
$env:WEB_BROWSER_EXECUTABLE='C:\Life\Superthon\SuperFlow\.runtime\playwright\chromium-1243\chrome-win64\chrome.exe'
npm.cmd run dev:api
```

```powershell
# Terminal 3
$env:NEXT_PUBLIC_API_URL='/api/backend'
$env:SUPERFLOW_API_URL='http://127.0.0.1:8000'
npm.cmd run build
npm.cmd start
```

```powershell
# Terminal 4, setelah health API dan web 200
node artifacts/verification/record-demo.mjs
```

Pada checkout baru, pasang Chromium dan FFmpeg Playwright di `.runtime/playwright` lebih dahulu dengan `PLAYWRIGHT_BROWSERS_PATH` yang diarahkan ke folder tersebut. Perintah importer idempotent; jangan jalankan `demo:reset` setelah impor karena itu menghapus data demo aplikasi dan corpus hasil impor.

## Demo Artifacts

- Video: `artifacts/demo/superflow-demo.webm` (3:13.20, 1440×900, VP8; SHA-256 `2384875579B32F4A257CC347A3564D550619CB205227DF33E51A8FA099E384F2`). MP4 tidak dibuat karena FFmpeg bawaan Playwright hanya mendukung WebM/VP8.
- Screenshots: `artifacts/demo/screenshots/01-home.png` sampai `09-my-work.png`; `10-public-finance.png` sampai `12-public-people.png`; `puppeteer-example.png`, `google-scan.png`.
- Naskah: `artifacts/demo/DEMO_SCRIPT.md`.
- Request, browser error, dan scene log: `artifacts/verification/demo-run.json`.
- Log capture nyata: `artifacts/verification/puppeteer-capture.json` dan `artifacts/verification/google-discovery.json`.
- Script reproduksi recording: `artifacts/verification/record-demo.mjs`.
- Full Playwright HTML report: `playwright-report/` setelah suite final.
