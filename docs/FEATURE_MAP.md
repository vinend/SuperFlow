# Peta Fitur SuperFlow

Status berdasarkan implementasi dan pengujian pada 18 Oktober 2026. **PASS** berarti perilaku teramati melalui UI/API dan tes; **PARTIAL** berarti ada batasan yang dijelaskan. Rincian bukti ada di [laporan verifikasi](../artifacts/verification/FEATURE_VERIFICATION.md). Teknologi adalah penjelasan implementasi, bukan menu produk.

## A. Produk yang digunakan pengguna

| Capability | User value | Product surface | Technology | Status | Demo |
| --- | --- | --- | --- | --- | --- |
| Ruang kerja personal | Melihat pekerjaan dan langkah berikutnya | Home | Next.js, PostgreSQL | PASS | Ya |
| Jawaban dengan bukti | Menemukan informasi yang dapat diperiksa | Ask SuperFlow | FastAPI, RAG, Qwen, Guard | PASS dengan batasan kualitas model | Ya |
| Koleksi sumber | Mengunggah, membaca, dan mengelola versi sumber | Knowledge | PostgreSQL, OCR, indexing | PASS | Ya |
| Tindak lanjut pekerjaan | Melihat progres dan menyediakan informasi | My Work | Persistent workflow | PASS | Ya |
| Keputusan manusia | Meninjau bukti sebelum keputusan | Reviews / Approvals | Guard, audit, approval API | PASS | Ya |
| Perubahan regulasi menjadi tindakan | Membandingkan sumber, mencatat gap, menugaskan remediasi | Regulatory Review | Comparison, workflow | PASS | Ya |
| Analisis investasi | Memeriksa asumsi, perhitungan, dan memo | Investment Analysis | Deterministic finance | PASS | Ya |

## B. AI dan keandalan

| Capability | User value | Product surface | Technology | Status | Demo |
| --- | --- | --- | --- | --- | --- |
| Pencarian pengetahuan lokal | Jawaban merujuk potongan sumber yang diizinkan | Ask, Knowledge | LlamaIndex, embedding multilingual, hybrid BM25 | PASS pada skenario teruji; relevansi luas tetap perlu pemantauan | Ya |
| Referensi regulator resmi | Menginspeksi halaman/pasal OJK tanpa menganggapnya nasihat hukum final | Ask, Knowledge, Regulatory Review | PDF OJK tersimpan, checksum, RAG | PASS; selalu REVIEW_REQUIRED | Ya |
| Referensi publik | Membandingkan panduan publik dengan sumber internal | Ask, Knowledge | Corpus FDIC/NIST/ILO | PASS | Ya |
| Sintesis lokal | Memperoleh ringkasan dari bukti yang diambil | Ask | Ollama `qwen3.5:0.8b` | PASS secara teknis; kualitas narasi perlu review | Ya |
| Pemahaman dokumen hasil pindai | Mencari teks dari gambar/PDF hasil pindai | Knowledge, Ask | RapidOCR, vector index, Qwen | PASS; teks OCR perlu pemeriksaan asli | Ya |
| Pembacaan situs dengan tata kelola | Menangkap halaman, meninjau draft, lalu memublikasikannya | Knowledge, Ask | Puppeteer/Chromium, allowlist jaringan | PASS pada URL aman teruji | Ya |
| Pemahaman visual halaman | Meninjau pengamatan screenshot dengan asal yang jelas | Knowledge, Ask | Qwen vision lokal | PASS secara teknis; observasi belum diverifikasi | Ya |
| Bukti Internet yang dipilih | Mengambil URL publik untuk satu jawaban tanpa mencampur KB bersama | Ask | Browser lokal, WebSearch opt-in | PASS untuk URL terpilih | Ya |
| Penemuan web otomatis | Menemukan URL publik lewat Google | Ask | Google discovery lokal | PARTIAL: HTTP 429 saat verifikasi | Kegagalan ditampilkan |
| Penyajian jawaban sesuai konteks | Menampilkan kartu, perbandingan dan tindakan yang sesuai maksud | Ask | CopilotKit V2/AG-UI, registry tervalidasi | PASS; pemilihan runtime teramati | Ya |
| Asal dan kutipan bukti | Membedakan sumber internal, OJK, OCR, website, dan Internet | Ask, Source Panel | Provenance dan citation records | PASS | Ya |
| Keandalan dan ketidakpastian | Menghentikan jawaban tanpa bukti dan meminta review | Ask, Reviews | SuperFlow Guard | PASS untuk bukti kosong/restricted; entailment semantik belum dijamin | Ya |
| Aktivitas saat menjawab | Mengetahui tahap pencarian, pembacaan, dan penyelesaian | Ask | Live Ask activity | PASS | Ya |
| Pemulihan terbatas | Melihat kegagalan layanan, retry/fallback yang diizinkan | Ask, workspaces | Controlled error states, bounded agents | PASS pada skenario teruji | Ya |

## C. Fondasi enterprise

| Capability | User value | Product surface | Technology | Status | Demo |
| --- | --- | --- | --- | --- | --- |
| Data persisten | Riwayat Ask, sumber, pekerjaan, dan keputusan bertahan setelah refresh | Seluruh produk | PostgreSQL, Alembic | PASS | Ya |
| Akses sesuai peran | Sumber dan tindakan dibatasi sebelum retrieval | Navigasi, Ask, workspaces | FastAPI permission checks | PASS pada pengujian; identitas masih sintetis | Ya |
| Riwayat aktivitas | Keputusan dan perubahan material dapat ditelusuri | My Work, Reviews | Audit events | PASS | Ya |
| Akses situs aman | Mencegah URL privat, credential, dan port tidak aman | Knowledge, Ask | URL/DNS validation | PASS pada tes keamanan | Ya |
| Pengukuran dampak internal | Manajemen melihat Quality, Capacity, Delivery dengan simulasi berlabel | Route langsung `/impact`, tanpa menu utama | Analytics | PASS; akses langsung dan pembatasan Employee diuji ulang | Demo internal |

## D. Batasan dan item di luar demo utama

| Capability | User value | Product surface | Technology | Status | Demo |
| --- | --- | --- | --- | --- | --- |
| Autentikasi produksi | Mengikat identitas ke pengguna bank sebenarnya | Seluruh produk | Belum diintegrasikan; selector identitas sintetis | ROADMAP | Tidak |
| Investigasi AML/FIU sintetis | Proof point Compliance dengan checker terpisah | My Work dan route kontekstual | Bounded agent, Guard, workflow | PASS pada tes; bukan produk utama | Tidak |
| Integrasi nasabah/FIU nyata | Menjalankan proses pada sistem bank sebenarnya | Tidak tersedia | Belum dihubungkan | ROADMAP | Tidak |
| Penilaian otomatis kebenaran setiap klaim | Menjamin semua kalimat sintesis didukung sumber | Ask | Belum tersedia | ROADMAP | Tidak |

Pemilih **Viewing as** adalah fasilitas prototype untuk memperlihatkan pembatasan peran. Ia bukan autentikasi produksi. Nilai Impact yang disimulasikan tetap bertanda **Illustrative simulation**.
Video demo 4:03 direkam sebelum Impact dikeluarkan dari navigasi utama; alur analitik pada video tetap memakai route yang dipertahankan.
