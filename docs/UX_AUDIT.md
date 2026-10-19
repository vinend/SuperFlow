# Audit UX final — main 35ad330

Audit ini dibuat sebelum perubahan UI. `main` bersih pada awal pekerjaan. Lima persona demo adalah Employee, Manager, Compliance, Finance, dan Governance Admin. SME serta Compliance Checker tetap menjadi pengguna backend untuk eskalasi dan review independen.

| Persona dan halaman | Tujuan dan tindakan utama | Informasi pertama | Detail yang ditunda | Duplikasi / istilah internal |
| --- | --- | --- | --- | --- |
| Employee — Home | Temukan perhatian utama; buka Ask atau Work | Jumlah perhatian, pintasan Ask, sumber terbaru | Tabel pekerjaan, riwayat, repositori penuh | Menyalin Work dan Knowledge |
| Employee — Ask | Ajukan pertanyaan | Pertanyaan dan contoh yang relevan | Domain, sumber, riwayat versi, pencarian web, proses teknis | Konfigurasi pencarian terlihat terlalu awal |
| Employee — Work | Lanjutkan permintaan atau tugas | Judul, status, tindakan berikutnya | Rincian proses dan reliability | My Work terpisah dari Reviews |
| Employee — Knowledge | Baca sumber asli | Judul, kategori, versi, pembaruan | Skor authority, hash, akses | Metadata repositori mendominasi |
| Manager — Home | Temukan keputusan menunggu; buka Work | Jumlah keputusan dan perhatian singkat | Antrean lengkap | Mengulang halaman keputusan |
| Manager — Ask / Knowledge | Periksa kebijakan untuk keputusan; bertanya atau buka sumber | Ask dan Library sederhana | Filter dan metadata sumber | Sama dengan Employee |
| Manager — Work / keputusan | Putuskan setelah melihat bukti | Permintaan, pemohon, sumber, pilihan tindakan | Langkah mesin, skema aktivitas | Navigasi review terpisah |
| Compliance — Home | Masuk ke pekerjaan regulasi atau investigasi | Perhatian singkat dan pintasan | Tabel spesialis lengkap | Mengulang halaman spesialis |
| Compliance — Regulatory Review | Validasi perubahan, gap, lalu tugaskan remediasi | Jumlah perubahan/gap, tahap saat ini | Perbandingan penuh, sitasi, aktivitas, pemeriksaan | Semua tahap tampil sekaligus |
| Compliance — Investigation Review | Tinjau alert dan bukti; kirim rekomendasi | Alert, indikator, kelengkapan bukti, rekomendasi | Banyak kartu fakta, riwayat alat, impor JSON | Adapter JSON menjadi alur pengguna |
| Compliance — Work / Ask / Library | Lanjutkan pekerjaan, bertanya, membaca sumber | Tugas yang sama dengan persona lain | Istilah mesin proses | Antrean review terpisah |
| Finance — Home | Temukan proposal; buka analisis | Perhatian dan pintasan | Analisis penuh | Mengulang Investment Analysis |
| Finance — Investment Analysis | Selesaikan konflik asumsi lalu kirim rekomendasi | Konflik dan keputusan, ringkasan hitungan | Tabel sumber, rumus, sensitivitas, memo, audit | Semua tahap tampil sekaligus |
| Finance — Work / Ask / Library | Lanjutkan pekerjaan, bertanya, membaca sumber | Tugas inti | Istilah mesin proses | Antrean review terpisah |
| Governance — Home | Temukan pemeliharaan sumber; buka Library | Perhatian singkat dan sumber terbaru | Bagian analisis bisnis | Mengulang Library |
| Governance — Knowledge Library | Kelola sumber terpercaya; buka/tambah dokumen | Judul, versi, status, tindakan pemeliharaan | Diagnosis indeks, akses dan authority pada detail | Metadata repositori selalu tampil |
| Governance — Work | Tindak lanjuti pekerjaan yang ditugaskan | Judul, status, tindakan berikutnya | Antrean keputusan kecuali ditugaskan | Review dianggap universal |

Rute `/cases`, `/decisions`, `/impact`, dan investigasi tetap menerima tautan langsung. Shell menyajikan satu tujuan **Work**. Impact tetap untuk internal. Identitas Compliance Checker tetap dapat diuji lewat jalur internal. Sesi password produksi tidak menyediakan pemilih role.
