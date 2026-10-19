# Panduan Presenter SuperFlow

Panduan ini hanya untuk presenter. Aplikasi tidak memiliki halaman walkthrough. Jangan jalankan `demo:reset` pada database yang berisi pekerjaan yang ingin dipertahankan: perintah tersebut menghapus data aplikasi pada database demo lokal dan menyiapkan ulang data sintetis.

## Persiapan

Jalankan PostgreSQL, migrasi, API, dan web sesuai README. Untuk dataset presentasi terpisah, jalankan `npm.cmd run demo:reset` setelah migrasi. Gunakan lima persona demo pada mode lokal; mode staging memakai login dengan akun dan tidak mengizinkan pergantian role. Sumber OJK publik harus tetap diberi konteks bahwa penerapan hukum dan amandemen memerlukan review Compliance.

## Alur produk

1. **Employee — Maya Putri.** Buka Home. Jelaskan satu kalimat: tanyakan pengetahuan perusahaan, periksa sumber, lalu lanjutkan ke pekerjaan. Buka Ask SuperFlow, ajukan pertanyaan kebijakan cuti, lihat jawaban, status, dan sumber. Buka Knowledge Library untuk membaca dokumen aslinya.
2. **Manager — Arif Santoso.** Buka Work → Needs My Decision. Periksa permintaan, pemohon, sumber, dan alasan review sebelum memilih tindakan. Keputusan manusia dan audit tetap diproses backend.
3. **Compliance — Raka Wijaya.** Buka Regulatory Review. Ikuti Changes → Potential gaps → Remediation. Bandingkan kewajiban baru dengan prosedur sekarang, konfirmasi gap, pilih pemilik dan tanggal, lalu buka hasilnya di Work. Buka Investigation Review untuk alert sintetis: pahami indikator, kumpulkan bukti, dan kirim rekomendasi. Compliance Checker tetap tersedia hanya melalui alur pengujian internal untuk keputusan independen.
4. **Finance — Dina Sari.** Buka Investment Analysis. Periksa sumber, pilih nilai saat sumber bertentangan, baca NPV/IRR/ROI/payback, lalu kirim rekomendasi. Perhitungan berasal dari backend, bukan aritmetika AI.
5. **Governance Admin — Alex Pratama.** Buka Knowledge Library. Tunjukkan pengelolaan dokumen, versi, akses, dan status indeks. Impact tetap dapat dibuka melalui `/impact` untuk bukti internal, tidak ada di navigasi biasa. Nilai kapasitas di Impact adalah **Illustrative simulation**.

## Batas dan pemulihan

Data investigasi dan alur keputusan adalah sintetis. Jangan menyebut indikator screening sebagai temuan AML final. Jika provider, browser publik, atau pencarian Google gagal, tunjukkan status sebenarnya; Google dapat mengembalikan 429/CAPTCHA. OCR, website capture, dan Qwen membutuhkan layanan/model lokal sesuai README. Kembali ke Home tidak mengubah keputusan atau mereset data.
