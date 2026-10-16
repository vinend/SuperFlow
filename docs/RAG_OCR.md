# RAG dan OCR Dokumen SuperFlow

## Tujuan dan referensi

Permintaan pengguna menambahkan ingestion PDF/OCR dan pencarian semantik sebelum pekerjaan sakelar demo/AI dilanjutkan. Ini memakai model pretrained lokal, bukan melatih model bahasa atau OCR dari awal.

Referensi yang diinspeksi:

- [RPL-backend `rag.py` pada commit 516da41](https://github.com/DAFFAsd/RPL-backend/blob/516da4138cb39dd9660512b82aa1cb1a285eacf4/rag.py): pemuatan PDF, chunk overlap, BGE-small, persistent vector index, dan query sumber melalui LlamaIndex/Groq.
- [RPL-frontend Gemini document tool pada commit 2885999](https://github.com/DAFFAsd/RPL-frontend/blob/28859996f559498b96d1753f69338648acad566d/src/lib/tools/gemini-documents.ts): pengelolaan dokumen dan indeks File Search. Implementasi ini tidak memakai Vercel Blob, Gemini, atau mengirim dokumen ke penyedia tersebut.

Kedua repository menjadi referensi arsitektur; tidak ditemukan implementasi OCR eksplisit. SuperFlow mempertahankan PostgreSQL, source/version authority, permission, citation ID, dan provider abstraction existing. Tidak disalin global index yang menelusuri semua dokumen sebelum otorisasi, dan tidak ditambahkan stack LlamaIndex/Groq yang tumpang tindih dengan aplikasi existing.

## Alur yang diimplementasikan

1. Upload PDF, DOCX, TXT/Markdown, PNG, atau JPEG. Original bytes dan checksum tetap disimpan pada versi immutable.
2. PDF memakai ekstraksi teks native. Halaman yang mempunyai raster image dirender dan dibaca **RapidOCR PP-OCRv4 melalui ONNX Runtime**. Pada halaman campuran, teks native dipertahankan dan hasil OCR tambahan digabungkan; baris yang identik tidak digandakan. PNG/JPEG memakai OCR yang sama. DOCX memakai parser paragraf/heading/table existing; gambar di dalam DOCX belum di-OCR.
3. Setiap chunk menyimpan section, page number, extraction method (`native`, `pdf_text`, `ocr`, `mixed`), dan skor pengenalan OCR terendah pada halaman bila ada. Chunk panjang dibatasi 1.200 karakter, dengan overlap maksimum 150 karakter dalam paragraf/section yang sama.
4. **FastEmbed / BAAI/bge-small-en-v1.5** menghasilkan vektor 384 dimensi pada CPU. Tabel `chunk_embeddings` menyimpan vektor, nama model, dan hash section/teks; tidak ada index global terpisah yang dapat menjadi sumber kebenaran kedua.
5. Backend mengotorisasi dokumen terlebih dahulu, menerapkan filter domain/dokumen/versi/effective date, lalu membaca chunk dan vektor yang diizinkan. Query ke dokumen terbatas menghasilkan nol hit tanpa memanggil embedding model.
6. Cosine similarity dengan floor `SEMANTIC_MIN_SCORE` menyaring relevansi; keyword ranking existing dan ranking semantik digabung melalui reciprocal rank fusion. Keyword overlap yang tidak lolos floor tidak dimasukkan kembali. Skor retrieval adalah urutan ranking, bukan probabilitas jawaban benar.
7. Hit menjadi citation yang menunjuk record document/version/chunk nyata. AnswerProvider existing menyusun jawabannya; Guard, approval, dan audit tetap milik backend. OCR/mixed evidence memerlukan **REVIEW_REQUIRED**, termasuk ketika skor pengenalan tinggi. Source Panel dan detail dokumen menampilkan peringatan untuk memeriksa hasil OCR terhadap file asli.

## Setup lokal

Gunakan Python environment project yang sama:

```powershell
.venv\Scripts\python.exe -m pip install -r apps/api/requirements-rag-lock.txt
npm.cmd run db:migrate
npm.cmd run rag:reindex
```

`requirements-rag-lock.txt` memuat dependency core dan RAG/OCR yang dipin. Untuk menambahkan hanya tiga dependency utama pada environment yang sudah tersedia, gunakan `requirements-rag.txt`.

Set `.env`, lalu restart API:

```dotenv
RETRIEVAL_PROVIDER=hybrid
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_THREADS=2
SEMANTIC_MIN_SCORE=0.65
OCR_ENABLED=true
OCR_MAX_PAGES=30
PDF_MAX_PAGES=200
```

Model embedding diunduh saat pemakaian pertama ke `.runtime/models`, lalu inference berjalan lokal. Model OCR dibundel pada dependency RapidOCR. File dokumen tidak diunggah ke layanan OCR/embedding eksternal. Cache model dan repository referensi berada dalam `.runtime` yang diabaikan Git.

`GET /api/health` mengungkap provider retrieval aktif, embedding model yang dikonfigurasi, dan apakah OCR diaktifkan. Ini informasi konfigurasi, bukan klaim semua model/index pasti siap. Index yang hilang/stale atau kegagalan model menghasilkan 503 yang eksplisit; tidak diam-diam mengubah query ke keyword atau melewatkan sebagian sumber.

Untuk kembali ke keyword retrieval, set `RETRIEVAL_PROVIDER=keyword` lalu restart API. Ini tidak menghapus vektor atau dokumen. `OCR_ENABLED=false` menolak pemrosesan halaman/gambar yang membutuhkan OCR.

## Migrasi dan pengindeksan

- Migrasi **0008** menambahkan metadata extraction pada chunk dan tabel vektor. Tidak mengubah original bytes, status versi, atau citation ID.
- `rag:reindex` menambahkan/memperbarui vektor dari teks tersimpan tanpa mengubah hasil parsing. Default identitas maintainer adalah Governance; `--user` dan `--document` tersedia. Otorisasi sumber tetap diperiksa. Commit dilakukan per dokumen; kegagalan satu dokumen rollback dokumen tersebut dan perintah berakhir gagal, sehingga retry aman.
- Upload versi baru pada mode hybrid menyimpan chunk dan embedding secara atomik. Kegagalan model rollback upload/publikasi, termasuk perubahan versi aktif.
- Tombol **Re-index** existing menjalankan parsing ulang serta indexing bila hybrid aktif. Jika jumlah chunk **atau isi/section berubah**, backend mengembalikan 409 dan meminta versi baru untuk menjaga citation yang sudah disimpan. Perubahan parser/OCR tidak diam-diam menulis ulang sumber jawaban lama.
- Backfill dan re-index mencatat event audit tanpa menyalin teks sumber ke log audit. Metadata/access yang berubah diterapkan ulang pada setiap retrieval; vektor lama tidak memberikan akses baru.

## Batasan yang harus dipahami

- BGE-small default berasal dari referensi dan ditujukan untuk teks **bahasa Inggris**. Model dapat dikonfigurasi, tetapi Bahasa Indonesia/multilingual perlu memilih model yang sesuai dan menguji threshold/retrieval kembali. Model berbeda memakai entri indeks berbeda dan perlu backfill sebelum query.
- OCR tidak menjamin ketepatan angka, ejaan, reading order kolom, tabel, handwriting, atau scan buruk. Skor yang ditampilkan adalah skor pengenalan terendah dari baris yang berhasil dibaca, **bukan** skor akurasi dokumen atau confidence AI. Baris yang tidak terdeteksi tetap dapat hilang; cek file asli. PDF vector-only yang tidak memiliki teks/raster image juga belum otomatis dirender sebagai scan.
- Batas: upload 10 MB, extracted text 2 juta karakter, PDF 200 halaman, OCR 30 halaman per file, render maksimum 20 juta piksel dan sisi maksimum 16.000 piksel. Kegagalan halaman OCR menolak seluruh ingestion, bukan menyimpan PDF parsial seolah lengkap.
- Cosine dihitung pada subset vektor yang diizinkan di PostgreSQL; ini sesuai corpus prototype, belum index ANN untuk jutaan chunk. Tidak ada klaim benchmark akurasi atau performa produksi.
- Dokumen saat ini tetap sample policies/proposals. RAG/OCR tidak mengubah data sintetis menjadi dokumen bank nyata. Endpoint upload existing menerima sumber baru sesuai permission pengguna.
- Pekerjaan demo-mode switch dan pengaktifan generator AI tetap dipause sesuai instruksi pengguna. Retrieval/OCR dapat diuji dengan AnswerProvider existing; OCR/embedding memakai model nyata dan tidak memakai respons fixture.

## Verifikasi

```powershell
$env:SUPERFLOW_TEST_LOCAL_MODELS="1"
npm.cmd run test:api
npm.cmd run test:e2e
```

Suite fungsional memakai provider fixture deterministik untuk isolasi; dua tes opt-in mengeksekusi **model OCR dan embedding nyata**. Test RAG mencakup paraphrase, filter versi/izin sebelum inference, perubahan akses setelah indexing, vektor persisten/idempotent/stale, rollback model gagal, original bytes, metadata OCR, batas halaman, dan perlindungan citation saat parser berubah.

`tests/rag-ocr.spec.ts` menguji upload PDF image-only → OCR → jawaban bersumber → Source Panel → download original serta non-leakage. Tes ini memerlukan dependency OCR opsional dan flag opt-in. Screenshot tersedia di `artifacts/screenshots/rag-ocr/` setelah dijalankan.

Smoke lokal juga memproses `rag_file.pdf` dari repository backend referensi: empat halaman, 11 chunk, extraction method mixed. File referensi tidak ditambahkan ke knowledge base aplikasi. Pada corpus existing, query paid time off menempatkan Annual Leave Policy sebagai hasil relevan; keyword-only sempat menempatkan Incident Reporting SOP di atasnya. Query reimbursement menemukan SOP yang benar, pertanyaan recipe/Mars menghasilkan nol sumber, dan filter Proposal A bagi Employee menghasilkan nol hit. Ini pemeriksaan kecil yang repeatable, bukan evaluasi akurasi menyeluruh.
