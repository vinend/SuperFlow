# SuperFlow Feature Verification

**18 Oktober 2026 · `main` a1c36d6 + perubahan lokal finishing. Status produk: PARTIAL; siap untuk demo hackathon terkurasi.** Status di bawah berasal dari tes dan perilaku aplikasi yang dijalankan, bukan inferensi dari kode saja. PASS teknis tidak menyatakan ketepatan hukum atau semua klaim model.

**Pembaruan navigasi setelah perekaman:** Impact/INSIGHTS kini tidak muncul dalam shell utama untuk peran mana pun. `/impact`, API, analytics dan kontrol akses tetap tersedia secara langsung untuk manajemen/demo. Video 4:03 di bawah merekam build sebelumnya sehingga masih memperlihatkan menu Impact; fitur analitik pada video tetap nyata, tetapi susunan menunya bukan susunan produk terkini. Hasil regresi perubahan ini dicatat pada bagian Automated Tests.

## Environment

- Windows x64; Node 24.19.0, npm 11.17.0, Python 3.12.10, PostgreSQL 18.4, Next.js 16.3.6. API dan frontend production masing-masing di `127.0.0.1:8000` dan `:3000`.
- Database demo `superflow_final` berasal dari seed transaksi, ditambah delapan PDF OJK dan enam PDF publik dari cache resmi. Sebelum interaksi ada 27 dokumen dan 1.437 embedding. Database test `superflow_test` terpisah; database default `superflow` tidak dipakai merekam video final.
- Health production: provider `ollama-grounded-v1`, model `qwen3.5:0.8b`, retrieval `hybrid`/`llamaindex`, embedding `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. Ollama v0.40.4, model dan Chromium lokal berada di `.runtime` yang diabaikan Git. Tidak memerlukan API key berbayar.
- Browser final memakai konteks Playwright baru, viewport 1440×900, aplikasi nyata dan PostgreSQL nyata. Rekaman final dimulai sesudah satu percobaan gagal; satu scan dan satu capture website dari percobaan tersebut masih ada di database. Ini dijelaskan agar keadaan data tidak disamarkan.
- Identitas `Viewing as` adalah pemilih peran sintetis, **belum autentikasi produksi**. Pemeriksaan izin sumber dan tindakan dilakukan oleh backend untuk peran tersebut.

## Recent Changes Reviewed

Riwayat aktual: `a1c36d6` public knowledge/Ask activity; `9497da3` Google vision WebSearch; `dbbd6fe` provenance/motion; `650d872` OJK, LlamaIndex dan CopilotKit; `b66c4a9` RAG/OCR/website vision; `b4743a1` Phase 8; `fab25e3` workspace CopilotKit. Riwayat lebih awal juga mencakup workflow, regulasi, investasi, Impact dan proof point FIU sintetis. Inventaris produk/teknologi/roadmap ada di `docs/FEATURE_MAP.md`.

## Summary

**32 kemampuan/jalur:** 29 PASS, 2 PARTIAL, 0 FAIL internal, 1 BLOCKED oleh layanan luar. Satu gate format lintas repositori gagal pada 79 file (drift lama, termasuk beberapa file yang disentuh pada finishing); gate ini tidak disembunyikan. Status keseluruhan tetap PARTIAL karena relevansi untuk pertanyaan pendek, mutu Qwen 0.8B, identitas sintetis, dan Google 429.

## Feature Matrix

| Feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Home | PASS | Video 01, E2E produk | Ruang kerja personal, navigasi menurut peran. |
| Ask SuperFlow | PASS | Video 02–17, `demo-run.json` | Jawaban, bukti, reliabilitas, aktivitas, tindakan lanjut. |
| Knowledge | PASS | Video 07, 10–11, 23–25 | Upload, versi, draft website, sumber publik. |
| My Work | PASS | Video 18–18b, E2E | Tugas Employee membawa request ke review Manager. |
| Reviews / Approvals | PASS | Video 22, E2E | Reviewer independen melihat request/evidence sebelum keputusan. |
| Regulatory Review | PASS | Video 19, E2E | Perbandingan, gap, remediasi, review manusia. |
| Investment Analysis | PASS | Video 20–21, E2E | Asumsi bersumber dan kalkulasi deterministik. |
| Impact | PASS | Video 26, E2E | QCD dan simulasi diberi label. |
| RAG dan relevansi Ask tanpa scope | PARTIAL | `retrieval-relevance-final.txt`, video 02/04/08/17 | Cuti utama hanya 3 chunk Annual Leave Policy; prompt fiktif 0 hasil; pertanyaan pendek masih dapat menyisipkan chunk ILO. |
| Embedding pipeline | PASS | Health, status index, 1.437 vektor awal | Embedding lokal tersimpan dan dipakai sesudah filter izin. |
| Inferensi Qwen lokal | PASS | `qwen-live.json`, video, OJK live | Provider/model terkonfirmasi pada jawaban API nyata; kualitas kalimat tetap perlu review. |
| Corpus resmi OJK/RPL | PASS | Video 04–05, OJK live | POJK 21/2023 Pasal 9 halaman 5 ditemukan; tidak mengklaim keberlakuan hukum final. |
| Pengetahuan publik | PASS | Video 23–25, diagnosis FDIC/NIST/ILO | PDF publik terpisah dari kebijakan internal. |
| OCR → indeks → Ask | PASS | Video 07–09, OCR live | Scan menghasilkan `extraction_method=ocr`, kutipan dan status perlu review. |
| Puppeteer/Chromium | PASS | Video 10, browser website test | URL publik aman dibuka dan ditangkap. |
| Governed website capture | PASS | Video 10–12 | Screenshot/teks/metadata URL dan waktu; draft ditinjau sebelum aktif. |
| Website vision | PASS | Video 10, `demo-run.json` | Screenshot dianalisis Qwen lokal; pengamatan visual ditandai bukan fakta yang dikutip. |
| WebSearch URL terpilih | PASS | Video 13–15, `websearch-live.json` | Opt-in membaca satu URL publik untuk jawaban privat; asal Internet jelas. |
| Google discovery otomatis | BLOCKED EXTERNAL | Video 16, `websearch-live.json` | Google mengembalikan HTTP 429; UI `Unavailable`/`BLOCKED`, tanpa hasil Google buatan. URL terpilih tetap berhasil. |
| CopilotKit V2 / AG-UI | PASS | Video 06, 4 request workspace pada `demo-run.json` | Runtime benar-benar dipanggil, bukan hanya dependensi. |
| Generative UI terkontrol | PASS | Video 06, OJK live, E2E | Intent → respons terstruktur → komponen perbandingan → navigasi/tindakan; registry memvalidasi tipe. |
| Asal bukti dan citation | PASS | Video 03/05/09/12/15 | Knowledge Base, OJK, OCR, website dan Internet dapat dibedakan; versi/section terlihat. |
| Live Ask activity | PASS | Video 13, E2E | Status pembacaan/proses muncul saat job berjalan dan berhenti saat selesai/gagal. |
| Guard dan kekurangan bukti | PASS | Video 17, `demo-run.json` | Prompt tanpa bukti: 0 sumber, `BLOCKED`; Guard tidak menjamin entailment setiap kalimat. |
| Retry/fallback terbatas | PASS | Video 16, backend/E2E | Kegagalan eksternal dilaporkan; provider deterministik tersedia jika Ollama tidak dikonfigurasi. |
| Aksesibilitas dan motion | PASS | E2E keyboard/mobile/reduced motion, screenshot | Fokus dan kontrol tetap dapat digunakan; tidak ada error page produksi. |
| PostgreSQL persistence | PASS | Video, suite API/E2E | Sumber, Ask, tugas, keputusan bertahan setelah refresh. |
| Permissions sebelum retrieval | PASS | API/E2E restricted source | Employee tidak menerima konten Finance terbatas; draft website tidak bocor. |
| Riwayat Ask | PASS | Home/Ask video, E2E | Run tersimpan dan dapat dibuka ulang. |
| Audit dan workflow persistence | PASS | Video 18b/19/22, API/E2E | Aktivitas, transisi dan reviewer persisten. |
| Pembatasan akses website | PASS | Security tests URL/DNS | URL privat/credential/port tidak aman ditolak. |
| Autentikasi identitas | PARTIAL | Selector `Viewing as`, inspeksi route | Prototipe menggunakan identitas sintetis; belum SSO/session produksi. |

## Automated Tests

**Regresi navigasi terbaru (sesudah video):** `npm.cmd run test:web` 42/42 PASS; `npm.cmd run lint`, `npm.cmd run typecheck`, dan `npm.cmd run build` PASS; `npx.cmd prettier --check` pada lima file yang disentuh PASS; `npm.cmd run test:e2e` 58 passed/3 opt-in skipped; `npm.cmd run test:e2e -- tests/product-experience.spec.ts tests/impact.spec.ts tests/demo.spec.ts` 12/12 PASS setelah format. Build tetap memuat route `/impact`. Tes browser memeriksa tidak adanya Impact/INSIGHTS pada menu desktop/mobile untuk seluruh peran, akses langsung `/impact` oleh Governance, serta pembatasan Employee. Backend analytics tidak diubah.

Tabel berikut mencatat verifikasi fitur luas pada build saat video direkam; addendum di atas mencatat regresi khusus penyederhanaan navigasi sesudahnya:

| Command | Result | Count / relevant logs |
| --- | --- | --- |
| `npm.cmd run test:web` | PASS | 42/42. |
| `npm.cmd run test:api -- -p no:cacheprovider --tb=short` | PASS | 209 passed, 2 skipped; satu deprecation warning Starlette/httpx. |
| `npm.cmd run lint`, `npm.cmd run typecheck` | PASS | ESLint dan TypeScript. |
| `npm.cmd run lint:api`, `npm.cmd run format:api` | PASS | Ruff. |
| `npm.cmd run build` | PASS | Production build; warning dynamic dependency CopilotKit/Google Vertex; route `/demo` tidak ada. |
| `npm.cmd run test:e2e` | PASS | 58 passed, 3 opt-in skipped, 7,9 menit. Opt-in OJK/OCR/website/WebSearch diuji lagi sebagai smoke live dan rekaman. |
| `node artifacts/verification/verify-qwen-live.mjs` | PASS | Employee policy dan official OJK, model `qwen3.5:0.8b`. |
| `npm.cmd run test:ojk:live` | PASS | OJK Pasal 9, satu AG-UI run, `REVIEW_REQUIRED`, 0 browser errors. |
| `node artifacts/verification/preflight-ocr-ui.mjs` | PASS | Upload → OCR → satu sumber → Qwen Ask. |
| `node artifacts/verification/verify-websearch-live.mjs` | PASS untuk URL; 429 eksternal | Satu URL dibaca. Query Google yang tidak cocok dengan KB menghasilkan 429, 0 URL dibaca dan 0 sumber Internet. |
| Website/vision live | PASS | Rekaman final menangkap `example.com`, satu screenshot, model Qwen vision; tes opt-in browser sebelumnya juga lulus. |
| `npm.cmd run format:check` | FAIL | 79 file tidak sesuai Prettier, sebagian besar tidak terkait finishing tetapi beberapa file disentuh. Tidak melakukan formatting massal yang mengaburkan diff. |

## Browser / Console Findings

- Rekaman production: **27 scene, lima jawaban Ask, empat request CopilotKit workspace, dua WebSearch job, satu OCR, satu website capture dan vision**. Log `demo-run.json`: `pageErrors=[]`, `consoleErrors=[]`, `http4xx=[]`, `httpErrors=[]`. Google 429 berasal dari browser server side; UI melaporkannya.
- **HIGH:** Jawaban Qwen kecil dapat menambah detail di luar yang jelas didukung citation. Smoke OJK mengandung elaborasi tambahan; tidak diperlakukan sebagai nasihat regulator final. Guard memvalidasi sumber/status, belum entailment setiap klaim.
- **MEDIUM:** Relevansi Ask bebas membaik pada query utama dan negatif, tetapi query pendek/parafrasa masih dapat membawa potongan semantik yang lemah. Contoh `How do I take time off?` mengembalikan tiga chunk cuti dan satu ILO teleworking. Query regulasi perbandingan dapat memenuhi top-k dengan OJK sebelum sumber internal muncul.
- **MEDIUM:** Google discovery HTTP 429 dari layanan luar; tidak dibypass. Pilihan URL langsung tetap bekerja.
- **LOW:** Warning Lit/Motion pada dev dan dynamic dependency CopilotKit saat build. Tidak ada hydration/uncaught exception kritis pada browser production final. 25 advisory npm dari audit baseline belum ditriase untuk rilis publik.

## Bugs Found and Fixes Made

1. Ask bebas sebelumnya dapat mengutip OJK untuk pertanyaan cuti/fiktif. Filter relevansi setelah retrieval berizin ditambah untuk query luas ≥3 istilah: cakupan kata 50%, atau ≥33% plus semantic ≥0,6. Query dengan scope eksplisit tetap mendukung parafrasa. Regression test baru membuktikan cuti mendapat sumber cuti dan pertanyaan fiktif tidak mendapat OJK. Diagnosis final mencatat sisa noise, jadi masalah tidak dinyatakan hilang total.
2. Runtime Ollama/Qwen lokal dipasang dan dikonfigurasi; inferensi Ask serta vision diuji langsung. Perubahan tidak mengubah kontrol backend.
3. `/demo` dan tautan presenter di produk dihapus sesuai instruksi; alur dipindah ke Markdown. Pada build video, navigasi masih memiliki SUPERFLOW/WORK/SOLUTIONS/INSIGHTS; pembaruan sesudah video menghapus INSIGHTS dari shell. Layar Workflows lama redirect ke My Work. Copy dan layout kecil disesuaikan tanpa redesign. Deviasi dari PRD v2 yang masih menyebut `/demo` dicatat di `IMPLEMENTATION_STATUS.md`.
4. Percobaan rekaman pertama gagal pada antrean Manager karena Employee belum menyelesaikan tugas bukti. Recorder diperbaiki untuk menyelesaikan task nyata dulu, lalu membuka review Manager. Perpindahan peran dari detail Compliance sempat menghasilkan 404 izin yang benar; recorder kini berpindah melalui Home. Rekaman final tidak memiliki 4xx.

## Remaining Risks

- Identitas sintetis dan data bisnis contoh membuat demo **bukan deployment bank produksi**. Akses backend diuji, tetapi SSO belum ada.
- Qwen 0.8B, OCR, vision, dan pernyataan OJK harus ditinjau manusia. Status `REVIEW_REQUIRED` terlihat pada jawaban sintesis. Tidak ada klaim validitas hukum otomatis.
- Relevansi query luas/pendek dan pemeringkatan multi-sumber perlu evaluasi lebih luas sebelum penggunaan terbuka. Fix sengaja konservatif untuk menjaga recall.
- Google membatasi otomasi dengan 429. Alur URL terpilih didukung; sistem tidak membuat sumber Google palsu.
- Reset seed menghapus corpus impor. Video final memakai snapshot `superflow_final` yang disiapkan khusus; ikuti playbook untuk mereproduksi.
- Gate Prettier 79 file dan dependency advisory adalah utang repo; beberapa file berformat drift ikut disentuh, tetapi tidak diformat massal pada feature freeze.

## Reproduce Locally

Setup terperinci: `README.md`, `docs/LOCAL_INFERENCE.md`, `docs/DEMO_PLAYBOOK.md`. Pada checkout ini, `.runtime` berisi PostgreSQL, Ollama/Qwen dan Chromium. Siapkan `SUPERFLOW_FINAL_DATABASE_URL` secara lokal dengan URL database `superflow_final` dan kredensial PostgreSQL setempat; jangan simpan kredensial di laporan atau video. Dari empat terminal PowerShell:

```powershell
npm.cmd run db:local
```

```powershell
$env:OLLAMA_HOST='127.0.0.1:11434'
$env:OLLAMA_MODELS=(Resolve-Path '.runtime/ollama/models').Path
& '.runtime/ollama/bin/ollama.exe' serve
```

```powershell
$env:DATABASE_URL=$env:SUPERFLOW_FINAL_DATABASE_URL  # URL lokal dengan kredensial dari konfigurasi pribadi
$env:RETRIEVAL_PROVIDER='hybrid'
$env:RETRIEVAL_ENGINE='llamaindex'
$env:EMBEDDING_MODEL='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
$env:SEMANTIC_MIN_SCORE='0.30'
$env:RETRIEVAL_TOP_K='6'
$env:LLM_PROVIDER='ollama'
$env:OLLAMA_MODEL='qwen3.5:0.8b'
$env:VISION_MODEL='qwen3.5:0.8b'
$env:OLLAMA_TIMEOUT_SECONDS='300'
$env:WEB_BROWSER_EXECUTABLE=(Resolve-Path '.runtime/playwright/chromium-1243/chrome-win64/chrome.exe').Path
npm.cmd run dev:api
```

```powershell
$env:SUPERFLOW_API_URL='http://127.0.0.1:8000'
npm.cmd run build
npm.cmd run start
```

Setelah health 200, `node artifacts/verification/record-demo.mjs` merekam ulang aplikasi nyata. Gunakan database baru dari `demo:reset` + import OJK/public sesuai README bila ingin keadaan awal yang sama; jangan reset `superflow_final` tanpa mencadangkan corpus. Kesalahan 429 Google dapat berbeda menurut jaringan/waktu.

## Demo Artifacts

- Video final: `artifacts/demo/superflow-demo.webm` — Playwright VP8/WebM, **1440×900, 4:03.40, 22.407.035 byte**, SHA-256 `8E0B6DACDD222004AF4DFA9ECA0B5D1DD58B42DBF75242A44C5692079D5A649C`. MP4 tidak dibuat karena encoder FFmpeg bundel Playwright hanya mendukung VP8/WebM.
- 27 screenshot: `artifacts/demo/screenshots/`. Naskah: `artifacts/demo/DEMO_SCRIPT.md`; alur: `docs/FINAL_DEMO_FLOW.md`; peta: `docs/FEATURE_MAP.md`.
- Log browser/request: `artifacts/verification/demo-run.json`; Qwen: `qwen-live.json`; WebSearch: `websearch-live.json`; diagnosis relevansi: `retrieval-relevance-final.txt`; browser suite: `playwright-report/`.
- Laporan historis sebelum finishing: `artifacts/verification/FEATURE_VERIFICATION_PRE_QWEN.md`. Temuan Ask lama di situ telah diperbaiki sebagian sebagaimana dijelaskan di atas.
