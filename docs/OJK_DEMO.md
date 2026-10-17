# Demo OJK: full-stack RAG di dalam SuperFlow

SuperFlow tetap platform Knowledge → Evidence → Decision → Action. Tab, shell, My Work, Reviews, Regulatory Review, Investment Analysis, Impact, dan proof point FIU tidak diganti. Sistem RAG dari RPL dipindahkan/adaptasi ke Knowledge dan Ask, dengan Motion untuk transisi kecil dan CopilotKit V2/AG-UI untuk memilih workspace serta varian kartu jawaban yang disetujui.

## Corpus nyata

Manifest reproducible: [`data/ojk/manifest.json`](../data/ojk/manifest.json). Hasil impor awal: **8 PDF resmi, 397 halaman, 1.101 chunk/vektor multilingual baru**. Original bytes, SHA-256, URL resmi, publisher, tanggal pengambilan, jenis dokumen, halaman/Pasal dan konfigurasi chunker disimpan. File PDF/cache/model tidak dimasukkan ke Git; metadata impor tersedia di `data/ojk/import-report.json`.

| Kelompok | Dokumen |
| --- | --- |
| Layanan digital | POJK 21 Tahun 2023 + FAQ |
| Pelindungan konsumen | POJK 22 Tahun 2023 + FAQ |
| Teknologi informasi bank umum | POJK 11 Tahun 2022 + FAQ |
| Pelaksanaan TI terbaru dalam corpus | PADK 1 Tahun 2026 + FAQ |

Sumber berasal dari halaman regulasi resmi OJK, bukan hasil generasi model atau ringkasan Google. Corpus ini terpilih untuk pengujian, bukan seluruh inventaris OJK atau hasil penetapan status hukum terkini. `active` berarti tersedia untuk retrieval; provenance tetap `unverified-reference` dan authority 2/5. Validitas hukum, perubahan/pencabutan, FAQ vs peraturan, dan penerapannya tetap memerlukan review Compliance. FAQ memakai tanggal ketersediaan impor untuk filter versi, bukan klaim tanggal penerbitannya.

## Implementasi RPL dan peningkatannya

Repository yang diperiksa ulang: [RPL-backend 516da41](https://github.com/DAFFAsd/RPL-backend/tree/516da4138cb39dd9660512b82aa1cb1a285eacf4) dan [RPL-frontend 2885999](https://github.com/DAFFAsd/RPL-frontend/tree/28859996f559498b96d1753f69338648acad566d). Remote HEAD masih sama saat pemeriksaan. Implementasi berada di repository SuperFlow; kedua repository RPL asli tidak dimodifikasi.

| Sistem RPL | Implementasi SuperFlow sekarang |
| --- | --- |
| LlamaIndex `VectorStoreIndex` dan retriever | **LlamaIndex Core 0.14.25 benar-benar digunakan** melalui `llama_rag.py`, dengan node ID dan vektor persisten dari PostgreSQL. Hanya kandidat authorized yang dimasukkan ke index query. Tidak ada default cloud embedding/LLM tersembunyi. |
| `SentenceSplitter(512, 128)` | Splitter token-aware yang sama, dibatasi halaman dan Pasal agar citation tetap dapat dibuka ke PDF asli. Parser legacy tetap tersedia untuk versi lama; re-index memakai chunker versi tersebut. |
| BGE-small berbahasa Inggris | FastEmbed multilingual MiniLM L12 ONNX, 384 dimensi, CPU lokal. Model/vektor lama tetap ada terpisah; perubahan model memerlukan backfill. |
| Query top-k pada global disk index | Retrieval version/permission-first, BM25 untuk istilah legal Indonesia, dense cosine relevance floor, lalu score fusion 65% normalized BM25 + 35% cosine, top-k terkontrol. Seluruh lexical candidate harus lolos dense floor, termasuk yang berada di luar dense top-40. |
| Persist/load global index | PostgreSQL menjadi sumber tunggal dokumen, original bytes, chunk, hash, vector/model, lifecycle dan audit. Reimport URL/checksum sama idempotent; bytes berubah menjadi versi baru tanpa menghapus citation lama. |
| Upload/library/index controls frontend | Reuse Knowledge existing: upload, metadata/access/version, original viewer/download; tambah status index dan indexing bagian yang belum siap, serta OJK search/direct PDF import di dialog Import website existing. |
| Groq backend dan Gemini File Search/Blob/Neon frontend | Kedua jalur RPL itu berbeda. SuperFlow menyatukannya melalui backend authoritative dan Ollama structured output lokal, tanpa cloud key. API key reference tidak disalin. Adapter Groq/Gemini/Blob tidak diaktifkan atau diklaim tersedia. |
| Respons chat frontend | CopilotKit V2/AG-UI memilih approved workspace/view; `regulation_brief` merender AnswerCard dinamis dengan official-source context, citation dan Guard. Model tidak menentukan permission, keputusan, atau HTML bebas. |
| Animasi Framer Motion | Motion for React 14.3.0 untuk fade/slide kecil pada kartu jawaban dan hasil/status impor; reduced-motion dihormati. Navigation dan konsep produk tetap sama. |

Ini implementasi penuh alur RAG dokumen, bukan migrasi seluruh aplikasi/fitur di luar RAG dari RPL. Auth SuperFlow masih mock `X-User-Id`; bukan auth produksi Better Auth dari RPL.

## Setup dan mengisi ulang

```powershell
python -m pip install -r apps/api/requirements-rag-lock.txt
npm install
npx playwright install chromium
npm run db:migrate
# db:seed hanya untuk database baru. Jangan reset database yang sudah berisi dokumen.
npm run db:seed
```

Konfigurasi profil OJK pada `.env`:

```dotenv
RETRIEVAL_PROVIDER=hybrid
RETRIEVAL_ENGINE=llamaindex
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
EMBEDDING_THREADS=2
SEMANTIC_MIN_SCORE=0.30
RETRIEVAL_TOP_K=6
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen3.5:0.8b
OLLAMA_NUM_CTX=8192
OLLAMA_NUM_PREDICT=1024
OLLAMA_TIMEOUT_SECONDS=300
```

Jalankan `npm run rag:reindex` setelah pergantian model untuk corpus existing, lalu `npm run demo:ojk`. Importer menambah sumber tanpa reset dokumen, case, approval, atau audit. `npm run demo:ojk -- --download-only` hanya mengunduh/mengecek PDF. `--refresh` mengunduh ulang sumber resmi; bytes yang berubah menghasilkan versi baru. Impor dilakukan per dokumen dalam transaksi, sehingga dapat diulang jika salah satu gagal.

Jalankan Ollama (`ollama serve`, `ollama pull qwen3.5:0.8b`), API, dan frontend seperti README. Model kecil dipilih agar laptop bisa menguji full flow tanpa API key; sintesis tetap REVIEW_REQUIRED, bukan benchmark akurasi atau keputusan hukum. Sakelar demo/AI lama di stash belum diterapkan; profil ini memakai konfigurasi provider existing.

## Google melalui Puppeteer

Knowledge → **Import website** → **Find and import official OJK documents**. Pencarian melakukan `site:ojk.go.id` pada Google di Puppeteer headless, memakai proxy public-IP existing. Hasil hanya link `ojk.go.id`/`www.ojk.go.id`; judul/snippet tidak menjadi source facts. Pilih halaman untuk preview browser/vision atau PDF untuk import, atau paste URL resmi secara langsung.

**Pemeriksaan aktual: Google mengembalikan HTTP 429.** Endpoint/UI menampilkan 503 yang menjelaskan rate limit/consent/CAPTCHA, tanpa bypass atau fabricated results. Karena itu corpus awal didapat dari tautan halaman resmi OJK yang diverifikasi, bukan diklaim sebagai hasil Google Puppeteer. Fitur search memerlukan Google mengizinkan akses jaringan tersebut. Direct PDF import tetap berfungsi dan sudah diuji.

## Pengujian nyata

- Query Indonesia tentang autentikasi dua faktor POJK 21 Tahun 2023 menempatkan **halaman 5 / Pasal 9** paling atas setelah koreksi fusion. Sebelumnya incidental passages mengalahkan pasal tepat; regression test sekarang melindungi lexical hit di luar dense top-40.
- Pertanyaan data pribadi/konsumen, pengaduan, tata kelola TI, dan pertanyaan Inggris mengembalikan sumber OJK. Query pasta/Mars/alien menghasilkan nol sumber. Ini evaluasi kecil, bukan pengukuran akurasi menyeluruh.
- Browser produksi mengirim request melalui **CopilotKit/AG-UI**, lalu API memakai LlamaIndex + multilingual vectors + **Ollama asli**. Jawaban Bahasa Indonesia memiliki citation nyata, Guard REVIEW_REQUIRED, source panel dengan official PDF, desktop/mobile tanpa page error/overflow, dan filter Proposal A bagi Employee tetap nol sumber.
- Original PDF/checksum, import idempotency, versi saat bytes berubah, access checks sebelum network/retrieval, Google blocked state, migration lifecycle, dan approved dynamic card view diuji.

Tes browser tambahan dengan unduhan OJK nyata:

`npm run test:ojk:live` menguji app produksi lokal yang sedang berjalan dengan LlamaIndex/Ollama asli dan CopilotKit, termasuk citation pertama Pasal 9, Guard, source panel, mobile dan denied source. Perintah ini bukan fixture test dan dapat memerlukan beberapa menit CPU.

```powershell
$env:SUPERFLOW_TEST_OJK='1'
npm run test:e2e -- tests/ojk.spec.ts
```

Backend fixture tests memakai provider deterministik untuk isolasi. Real-model production smoke terpisah memakai Ollama, bukan fixture. Jangan menjalankan `demo:reset`/`db:reset` setelah import kecuali siap menghapus database demo dan mengimpor ulang corpus OJK.
