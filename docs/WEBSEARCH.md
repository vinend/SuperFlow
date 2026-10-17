# Enable WebSearch — Google, browser dan vision pada perangkat lokal

Di **Ask SuperFlow**, tekan tombol **Enable WebSearch**, lalu ajukan pertanyaan. Tab dan konsep SuperFlow tetap sama. Knowledge-only tetap default.

## Alur nyata

1. Pertanyaan publik atau query opsional dikirim ke `google.com/search` oleh **Puppeteer Core + Chromium lokal**. Ini bukan Google Search API, SerpAPI, search API cloud, atau browser yang berjalan pada server eksternal. Jaringan Google tetap diperlukan.
2. Browser mengekstrak URL result dari DOM. Screenshot Google dibaca oleh **Ollama/Qwen vision lokal**. Model tidak menentukan URL, menjalankan instruksi halaman, atau memecahkan CAPTCHA.
3. Maksimal dua hasil dibaca. HTML: teks DOM, satu viewport screenshot dan observasi vision. PDF dengan URL `.pdf`: download dengan validasi/pinning IP publik dan batas 10 MB, parser native/OCR, dua potongan relevan, serta render satu halaman relevan untuk vision. Endpoint PDF tanpa ekstensi atau file/halaman yang tidak dapat dibaca dapat dikecualikan secara eksplisit.
4. Maksimal empat citation KB digabung dengan potongan web/PDF dan observasi visual. Ollama menghasilkan jawaban dari context ini. Observasi visual diberi jenis `vision`, ditandai belum terverifikasi, dan model diinstruksikan mengatribusikannya sebagai pemindaian visual, bukan fakta teks sumber.
5. Citation, original bytes, screenshot/hash, URL/waktu dan model disimpan. **Internet** membedakan bukti web dari **From Knowledge Base**. PDF/OCR/Puppeteer/Vision observation menjelaskan metode. Vision dari halaman PDF dirender dengan PDFium; tidak diklaim sebagai screenshot Puppeteer.

Snapshot hasil pencarian bersifat **per-answer, milik pengguna pembuat**. Tidak masuk inventory Knowledge, indeks embedding bersama, retrieval pertanyaan lain atau pilihan dokumen Regulatory/Investment. Tidak otomatis menjadi kebijakan approved. File/observasi ini tetap membutuhkan review. Gunakan import Knowledge existing untuk membuat sumber bersama melalui proses yang berlaku.

## Waktu proses dan pemulihan

Frontend memulai `POST /api/web-search/asks` (202), lalu memantau `GET /api/web-search/asks/{id}`. Satu worker membatasi memory browser/model lokal. Pertanyaan pending tidak masuk history jawaban selesai. Hash `webjob` memungkinkan reload melanjutkan pemantauan; job pending dipulihkan saat API restart. Output yang gagal tidak disajikan sebagai jawaban sukses. Karena model CPU dapat memerlukan beberapa menit per gambar, polling menghindari satu request panjang yang dapat timeout.

Browser memakai path same-origin `/api/backend`, yang diteruskan Next.js ke `SUPERFLOW_API_URL` lokal (default `http://127.0.0.1:8000`). Ini menghindari gangguan koneksi/CORS ke port API terpisah pada in-app browser. `NEXT_PUBLIC_API_URL=/api/backend` adalah URL browser; `SUPERFLOW_API_URL` tetap absolute/server-only untuk proxy dan agent CopilotKit. Rebuild frontend setelah mengubah konfigurasi. Polling mencoba ulang kegagalan koneksi sementara dan berhenti jika akses dicabut atau hasil reliability invalid.

`/api/ask` sinkron tetap tersedia untuk kompatibilitas; gunakan endpoint background untuk WebSearch. Semua endpoint status/evidence memeriksa kepemilikan. Google screenshot asli tersedia lewat **Inspect Google scan**, hanya untuk pembuat pertanyaan.

## Google HTTP 429 / CAPTCHA

Pengujian aktual lokal mengembalikan **HTTP 429 dan reCAPTCHA**. Puppeteer membuka Google dan vision membaca halaman blokir. Tidak ada result Google yang dianggap berhasil atau dimasukkan sebagai fakta jawaban. Card menampilkan status unavailable dan konteks yang benar-benar tersedia.

Tombol **Open Google search** memungkinkan pencarian manual. Pada WebSearch options, **Selected result URLs** dapat berisi sampai dua URL publik; pipeline membaca/men-scan URL tersebut dan memasukkannya ke AI context. Jalur ini diberi provenance `user-selected-urls` dan tidak diklaim sebagai hasil otomatis Google. Tidak ada bypass CAPTCHA, stealth/proxy rotation, atau respons web sintetis.

## Setup dan batas prototype

Jalankan migrasi `0011`, PostgreSQL, API, frontend, Chromium dan Ollama lokal. Konfigurasi existing:

```dotenv
WEB_CAPTURE_ENABLED=true
WEB_SEARCH_MAX_RESULTS=2
VISION_MODEL=qwen3.5:0.8b
VISION_TIMEOUT_SECONDS=600
VISION_THREADS=4
LLM_PROVIDER=ollama
```

Query berasal dari input publik pengguna; potongan dokumen internal tidak dikirim ke Google. Batas IP publik, GET-only browser, redirect/subresource validation dan sandbox existing tetap berlaku. Tidak ada login, consent acceptance atau CAPTCHA solving otomatis. Screenshot hanya mencakup viewport/halaman yang dicatat, bukan crawl seluruh situs. Model kecil dapat salah membaca. Tidak ada retention/cleanup otomatis untuk snapshot prototype.

Tes unit/backend memakai fixture untuk mengisolasi failure, permission, callback job dan penggabungan context. Browser fixture test memeriksa opt-in/polling/status UI. Pengujian model sebenarnya terpisah dan dicatat tanpa menyatakan Google sukses ketika diblokir.
