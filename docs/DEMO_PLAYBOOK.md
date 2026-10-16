# Panduan Demo Terintegrasi SuperFlow

## Persiapan

Gunakan data sintetis dan provider `LLM_PROVIDER=deterministic` untuk demo tanpa kredensial AI. CopilotKit memiliki fallback deterministik; inference Ollama opsional dan tidak diperlukan untuk alur utama. PostgreSQL harus berjalan sebelum migrasi.

```powershell
npm.cmd ci
npm.cmd run db:local
```

Pada terminal kedua, siapkan database dan dataset presentasi:

```powershell
npm.cmd run db:migrate
npm.cmd run demo:reset
npm.cmd run dev:api
```

Pada terminal ketiga:

```powershell
npm.cmd run build
npm.cmd run start
```

Buka [walkthrough lokal](http://127.0.0.1:3000/demo). Tautan **Demo walkthrough** di footer selalu membuka panduan kembali. Link langkah mengganti identitas demo secara eksplisit; mock identity bukan autentikasi produksi. Permission tetap diperiksa backend pada setiap sumber dan tindakan.

`demo:reset` **menghapus seluruh data aplikasi pada database demo lokal yang dikonfigurasi**, termasuk upload, pertanyaan, keputusan, dan hasil demo sebelumnya. Perintah hanya menerima PostgreSQL loopback bernama `superflow` atau `superflow_test`, memakai konfirmasi sintetis existing, dan tidak tersedia melalui endpoint web. Reset mempertahankan schema. Migrasi harus dijalankan terlebih dahulu.

Dataset berisi 13 dokumen/15 versi, tujuh identitas, tiga investigation sintetis, tiga request pengetahuan, satu regulatory review dengan temuan belum diputuskan, serta satu analisis Proposal A dengan konflik belum diselesaikan. Reset dan persiapan seluruh modul berada dalam satu transaksi: kegagalan persiapan mengembalikan dataset sebelumnya. ID dan timestamp baru dapat berbeda setiap reset; isi sumber, skenario, jumlah data, serta kondisi awal tetap sama.

## Cerita utama — sekitar 8–10 menit

1. **Employee — Ask.** Tanyakan `How many annual leave days do I get?`. Buka citation Annual Leave Policy v2.0. Tunjukkan jawaban 15 hari, versi aktif, sumber, serta reliability. Pengetahuan tidak berhenti pada jawaban.
2. **Employee — My Work.** Buka **Annual Leave Review** dan selesaikan tugas evidence. Sumber valid melewati Guard dan meminta review Manager. Bandingkan dengan **Supporting Evidence Request** tanpa evidence dan **Access Review Clarification** dengan konflik; selesaikan tugasnya untuk menunjukkan penghentian atau routing ke reviewer sesuai Guard. Jangan menyebut Verified sebagai approval bisnis otomatis.
3. **Compliance — Regulatory Review.** Buka review Synthetic Digital Operations Regulation. Bandingkan versi historis dengan versi aktif: 12 menjadi 6 bulan, 72 menjadi 24 jam, serta retensi 3 menjadi 5 tahun. Tunjukkan SOP terdampak dan usulan gap. Confirm satu temuan dengan owner yang memiliki izin sumber serta due date mendatang. Remediation muncul sebagai pekerjaan nyata; penutupan tetap menunggu semua keputusan dan remediation selesai.
4. **Finance — Investment Analysis.** Buka Proposal A. Perlihatkan konflik investasi IDR 180 juta vs quotation IDR 195 juta. Pilih quoted implementation cost dengan alasan, inspeksi NPV/IRR/ROI/payback, formula, periode, dan sensitivity. Submit memo untuk review Manager. Nilai diambil dari sumber; tidak ada pemilihan otomatis.
5. **Manager — Reviews / Approvals.** Buka Annual Leave Review atau investasi yang baru dikirim. Inspeksi evidence sebelum memilih keputusan. Jika reliability memerlukan alasan, isi alasan yang menjelaskan penilaian. Tunjukkan progress/activity setelah keputusan dan persistensi setelah refresh.
6. **Governance Admin — Impact.** Tunjukkan quality dari pertanyaan dan Guard, delivery dari work/review, serta capacity. Angka capacity bertanda **Illustrative simulation**, dengan asumsi terlihat, bukan realized profit. Metrik tanpa observasi tampil belum diukur. Scope role lain dibatasi; Employee tidak memiliki akses agregat.

## Proof point opsional — sekitar 3 menit

Compliance membuka **Investigation Review** untuk alert sintetis. Jalankan pengumpulan evidence, periksa provenance, status alat, serta Guard. Simpan rekomendasi analis dan submit. Ganti ke **Compliance Checker — Sinta Mahardika** untuk review independen di Reviews / Approvals. Skenario failed evidence dan conflict menunjukkan retry terbatas dan human escalation. Semua transaksi, profil, screening, dan berita adalah fixture sintetis; tidak ada keputusan regulator atau sistem bank nyata.

## Pemulihan dan batasan

- Kembali ke `/demo` tidak melakukan reset, mengeksekusi alat, atau mengirim keputusan.
- Jika sumber/provider/API gagal, gunakan error dan retry yang tersedia. Untuk presentasi tanpa Ollama, jalankan ulang API dengan provider deterministik; tidak perlu mengubah sumber atau kontrol.
- Jika versi sumber berubah selama demo, Guard dapat memerlukan pemeriksaan ulang. Gunakan `demo:reset` hanya untuk kembali ke kondisi awal; jangan menyamarkan kegagalan dengan approval otomatis.
- Dataset presentasi tidak memalsukan event, durasi historis, savings, atau hasil keputusan. Waktu dan dampak observed berasal dari interaksi demo yang benar-benar dijalankan.
- Mode produksi memerlukan build ulang setelah perubahan kode. Role switcher dan thread sementara CopilotKit tetap batasan prototype.

## Verifikasi

`tests/demo.spec.ts` mempersiapkan dataset presentasi hanya pada database test, mengecek role switching, data prepared, refresh, skip link, mobile navigation/Escape, overflow, serta simulasi Impact, lalu memulihkan seed standar agar suite existing tidak berubah.

Backend `test_presentation_demo.py` membuktikan reset berulang, idempotensi persiapan, keputusan manusia yang masih terbuka, serta rollback seluruh reset saat persiapan gagal. Journey domain existing tetap menjadi pengujian utama mutasi, permission, evidence, approval, dan audit.
