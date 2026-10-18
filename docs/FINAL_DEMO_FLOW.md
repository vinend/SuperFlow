# Alur Demo Final — 4:03 menit

Rekaman: [`artifacts/demo/superflow-demo.webm`](../artifacts/demo/superflow-demo.webm), 1440×900. Gunakan aplikasi lokal dengan PostgreSQL, corpus terindeks, Ollama/Qwen, Chromium, dan identitas sintetis. Halaman `/demo` sudah dihapus; semua langkah berlangsung pada halaman produk. Video ini mendahului penyederhanaan menu Impact; pada build terkini buka `/impact` langsung untuk segmen analitik internal. Detail persiapan ada di [DEMO_PLAYBOOK.md](DEMO_PLAYBOOK.md), hasil aktual di [FEATURE_VERIFICATION.md](../artifacts/verification/FEATURE_VERIFICATION.md).

| Waktu | Tindakan pengguna | Layar yang diharapkan | Kemampuan | Narasi presenter |
| --- | --- | --- | --- | --- |
| 0:00–0:18 | Buka Home lalu Ask | Ruang kerja personal dan formulir Ask | Navigasi menurut peran | “Mulai dari pertanyaan karyawan, lalu lanjutkan ke tindakan.” |
| 0:18–0:42 | Tanya hak cuti; buka kutipan | Jawaban, reliabilitas, Annual Leave Policy dan versi | Qwen, RAG lokal, sumber internal | “Jawaban ini bisa dilacak ke kebijakan yang masih aktif.” |
| 0:42–1:08 | Tanya kewajiban OJK; buka Pasal 9 | Kartu sumber OJK dan status perlu review | Corpus resmi, provenance | “Referensi regulator terlihat jelas, namun penerapannya tetap perlu pemeriksaan.” |
| 1:08–1:23 | Minta perubahan regulasi | Komponen perbandingan muncul dari intent | CopilotKit/AG-UI terkontrol | “Tampilan menyesuaikan kebutuhan tanpa memberi AI wewenang mengambil keputusan.” |
| 1:23–1:48 | Unggah scan; tanya tenggat kuitansi | Teks OCR ditemukan dan dikutip | OCR, indexing | “Informasi dari gambar pun dapat dicari, dengan penanda bahwa scan perlu dicek.” |
| 1:48–2:20 | Tangkap situs publik; review draft; tanya isinya | Screenshot, observasi visual, lalu kutipan website | Capture, vision, tata kelola | “Halaman dibaca secara lokal dan masuk sebagai draft sebelum dipakai.” |
| 2:20–2:48 | Aktifkan WebSearch dengan URL terpilih | Aktivitas berjalan dan sumber Internet privat | Public grounding, live activity | “Asal Internet terpisah dari pengetahuan perusahaan.” |
| 2:48–3:08 | Coba discovery dan pertanyaan tanpa bukti | Google 429 terlihat; Ask `BLOCKED` | Kegagalan jujur, Guard | “Saat layanan luar membatasi akses atau bukti kurang, sistem berhenti.” |
| 3:08–3:45 | Buka My Work, Regulatory Review, Investment, Reviews | Progres, gap/remediasi, kalkulasi, review | Knowledge-to-action, human review | “Bukti berubah menjadi pekerjaan terkendali, bukan keputusan otomatis.” |
| 3:45–4:03 | Buka Knowledge dan Impact | Sumber publik dan metrik berlabel simulasi | Fondasi lintas divisi, pengukuran | “Dampaknya dapat dilihat tanpa menyamakan simulasi dengan hasil nyata.” |

Operator: URL publik yang dipilih berhasil; Google discovery pada lingkungan ini mengembalikan HTTP 429 dan harus dinarasikan sebagai keterbatasan. Identitas **Viewing as** adalah selector prototype, bukan autentikasi produksi. Jangan jalankan `demo:reset` pada database dengan corpus OJK/public impor karena reset akan menghapusnya.
