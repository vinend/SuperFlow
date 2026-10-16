# Import website dengan Puppeteer dan vision lokal

Knowledge → **Import website** tersedia untuk SME/Governance dengan permission `knowledge:write`. Masukkan URL publik, pilih **Scan website**, periksa screenshot/teks/observasi vision, tentukan owner/domain/readers, lalu **Save draft source**. Detail dokumen menyediakan **Inspect website capture** untuk membuka bukti tersimpan. Publikasi tetap melalui kontrol versi Knowledge existing.

## Setup

```powershell
npm install
npx playwright install chromium
npm run db:migrate
ollama serve
```

Di terminal lain:

```powershell
ollama pull qwen3.5:0.8b
```

`.env`:

```dotenv
WEB_CAPTURE_ENABLED=true
VISION_MODEL=qwen3.5:0.8b
VISION_TIMEOUT_SECONDS=600
VISION_THREADS=4
OLLAMA_BASE_URL=http://127.0.0.1:11434
# WEB_BROWSER_EXECUTABLE=C:/path/to/chrome.exe
# WEB_NODE_EXECUTABLE=C:/path/to/node.exe
```

Restart API setelah mengubah konfigurasi. `puppeteer-core` menggunakan Chromium existing sehingga tidak mengunduh browser kedua. Pada workstation Windows ARM yang full Chrome x64 tidak dapat dijalankan, arahkan `WEB_BROWSER_EXECUTABLE` ke `chromium_headless_shell-<revision>/chrome-headless-shell-win64/chrome-headless-shell.exe` di folder browser Playwright. Model Ollama berjalan pada CPU bila GPU tidak didukung. Profil Docker AI existing juga dapat dipakai dengan runtime yang mendukung Qwen3.5 dan model vision sudah dipull; pengaturan generator Ask tetap terpisah.

## Alur dan provenance

1. Backend memeriksa permission sebelum membuka browser. Worker Node menerima JSON melalui stdin, tanpa shell atau pembuatan kode dari URL.
2. Puppeteer headless memakai profil baru, tanpa cookie akun. Halaman HTML dieksekusi untuk memuat konten dinamis. Permintaan dibatasi GET, 160 request, port 80/443, waktu navigasi 30 detik, dan batas capture 45 detik. Tidak ada login, klik, form submission, recursive crawl, atau bypass CAPTCHA/paywall.
3. Proxy loopback memeriksa semua hasil DNS dan menghubungkan langsung ke IP publik yang sudah divalidasi. Redirect/subresource melewati pemeriksaan yang sama; loopback, metadata cloud, private/link-local/multicast, serta IPv4-mapped private ditolak. Browser tidak melakukan resolusi target sendiri. Sandbox Chromium tetap aktif. Untuk hosting produksi, isolasikan worker dengan egress firewall dan resource quota per pengguna.
4. Ekstraksi `innerText` dibatasi 100.000 karakter, terpisah dari screenshot. Vision membaca maksimal dua viewport 1280×900 dari bagian atas halaman; coverage ini bukan pemindaian seluruh halaman. Screenshot PNG dibatasi 4 juta karakter base64 masing-masing.
5. Ollama menerima hanya screenshot publik, prompt tetap, tanpa tools. JSON tervalidasi berisi visible text, deskripsi visual, dan keterbatasan. Output model adalah observasi belum terpercaya; instruksi dalam halaman/gambar tidak memiliki otoritas. Model gagal/offline/output invalid menghasilkan error eksplisit, tanpa respons sintetis pengganti.
6. Migration `0009` menyimpan preview, actor, waktu, URL, screenshot/hash, model, observasi, dan tautan versi. Preview hanya dapat disimpan oleh pembuat selama satu jam dan sekali saja. Draft dan indeks disimpan dalam transaksi yang sama; metadata/readers diverifikasi backend. Bukti setelah penyimpanan mengikuti akses dokumen, termasuk jika readers berubah.
7. Snapshot Markdown immutable menyimpan teks DOM, URL/waktu, dan hash screenshot. **Observasi model tidak masuk indeks RAG sebagai fakta**; screenshot asli dan observasi vision tetap tersedia terpisah di detail dokumen melalui API terotorisasi. Chunk ditandai `web_capture`; citation tetap mengacu versi/chunk existing. Website selalu memerlukan human review setelah publikasi, termasuk sesudah re-index. Konten yang hanya terlihat di gambar perlu dikurasi manusia sebelum ditambahkan sebagai fakta sumber.

Preview yang belum disimpan tetap berada di database setelah expiry dan tidak dapat disimpan lagi; retention/cleanup otomatis belum tersedia. Hindari pemindaian massal pada prototype. `WEB_CAPTURE_ENABLED=false` menonaktifkan capture baru. Ini tidak menghapus bukti yang sudah disimpan.

Verifikasi nyata pada laptop Windows ARM memakai Ollama 0.40.5 dan Qwen3.5 0.8B Q8_0. Scan pertama satu screenshot memerlukan sekitar **3,9 menit dengan dua thread CPU**; pengulangan dengan default **empat thread memerlukan sekitar 2,1 menit**, dengan timeout maksimal sepuluh menit per screenshot. Model membaca paragraf Inggris, tetapi membuat kesalahan transkripsi Arab dan jumlah bahasa pada halaman contoh. Karena itu output vision tetap evidence review, bukan sumber fakta otomatis. Multilingual OCR/vision perlu model dan evaluasi tambahan sebelum penggunaan produksi.

## Pengujian

```powershell
npm run test:api
npm run test:web
$env:SUPERFLOW_TEST_WEB_MODELS='1'
npm run test:e2e -- tests/website-import.spec.ts
```

Tes unit memakai fixture untuk kegagalan dan permission; tes browser opt-in benar-benar membuka URL publik melalui Puppeteer dan menjalankan model vision lokal. Tidak ada klaim benchmark akurasi atau model yang dilatih khusus. Model 0.8B dipilih agar dapat diuji pada workstation; ubah `VISION_MODEL` ke model multimodal lebih kuat sesuai kapasitas jika diperlukan.

Referensi resmi: [Puppeteer interception](https://pptr.dev/guides/network-interception), [Ollama vision API](https://docs.ollama.com/capabilities/vision), [Qwen3.5 0.8B](https://ollama.com/library/qwen3.5:0.8b). Repository RPL tetap referensi arsitektur; API key atau implementasi browser template dari reference tidak disalin.
