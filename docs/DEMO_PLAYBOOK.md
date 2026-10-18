# Panduan Demo Terintegrasi SuperFlow

Panduan ini adalah naskah presenter di luar antarmuka produk. Halaman `/demo` telah dihapus agar pengguna masuk melalui Home, Ask, Knowledge, My Work, dan pengalaman lain sesuai perannya. Untuk setiap langkah di bawah, pilih identitas sintetis melalui **Viewing as** pada header, lalu buka halaman yang disebutkan. Pemilihan peran di prototype bukan autentikasi produksi; API tetap memeriksa izin sumber dan tindakan. [Alur final 4:03 menit](FINAL_DEMO_FLOW.md) dan [peta fitur](FEATURE_MAP.md) merangkum cerita produk.

Rekaman lengkap 4:03 menit tersedia di `artifacts/demo/superflow-demo.webm`, dengan [naskah pendek](../artifacts/demo/DEMO_SCRIPT.md) dan [hasil verifikasi](../artifacts/verification/FEATURE_VERIFICATION.md). Rekaman itu dibuat sebelum Impact dikeluarkan dari navigasi; pada build kini presenter membuka `/impact` langsung. Rekaman memakai Qwen lokal, corpus OJK/public yang sudah diimpor, OCR, website vision, dan WebSearch URL terpilih. Dataset rekaman disiapkan di database lokal `superflow_final` (27 dokumen, 1.437 vektor sebelum interaksi; satu percobaan rekaman sebelumnya meninggalkan satu scan dan satu website sehingga dua sumber itu sudah terlihat saat rekaman final dimulai). Untuk merekam ulang pada checkout ini, ikuti perintah laporan verifikasi dan **jangan jalankan `demo:reset` pada database final**, karena reset menghapus corpus impor. Bagian persiapan di bawah hanya untuk walkthrough dataset sintetis dengan provider deterministik.

## Peta presentasi

| Langkah | Peran dan halaman | Tindakan yang ditunjukkan | Bukti yang diperiksa |
| --- | --- | --- | --- |
| Temukan jawaban terpercaya | Employee · `/ask` | Tanyakan jumlah cuti tahunan; buka citation dan versi aktif. | Jawaban bersumber dan reliability terlihat. |
| Lanjutkan menjadi pekerjaan | Employee · `/cases` (My Work) | Buka Annual Leave Review; lengkapi evidence, lalu bandingkan permintaan dengan evidence hilang atau konflik. | Tindakan berikutnya dan progress yang persisten. |
| Ubah regulasi menjadi remediasi | Compliance · `/regulatory` | Bandingkan regulasi historis/aktif, periksa gap SOP, konfirmasi temuan dengan owner dan due date. | Keputusan manusia menciptakan pekerjaan remediasi yang terlacak. |
| Selesaikan asumsi investasi | Finance · `/investment` | Buka Proposal A, pilih sumber biaya dengan alasan, lihat formula dan sensitivitas, kirim memo. | Asumsi bersumber dan perhitungan deterministik. |
| Tinjau sebelum memutuskan | Manager · `/decisions` (Reviews / Approvals) | Periksa permintaan, evidence dan reliability sebelum keputusan; buka My Work sesudahnya. | Otoritas manusia independen dan aktivitas tercatat. |
| Ukur dampak platform | Governance Admin · `/impact` (buka URL langsung) | Lihat Quality, Cost / Capacity, Delivery setelah langkah lain. | Aktivitas nyata dibedakan dari **Illustrative simulation**. |

Proof point opsional: Compliance membuka `/investigations` untuk alert sintetis, mengumpulkan evidence, lalu Compliance Checker yang berbeda melakukan review independen. Fitur ini memakai fondasi yang sama dan tidak mengakses data FIU nyata.

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

Buka [aplikasi lokal](http://127.0.0.1:3000/) dan ikuti peta presentasi di atas. Panduan ini tetap tersedia sebagai Markdown; tidak ada tautan presenter pada shell pengguna.

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

- Membaca ulang panduan ini tidak melakukan reset, mengeksekusi alat, atau mengirim keputusan.
- Jika sumber/provider/API gagal, gunakan error dan retry yang tersedia. Untuk presentasi tanpa Ollama, jalankan ulang API dengan provider deterministik; tidak perlu mengubah sumber atau kontrol.
- Jika versi sumber berubah selama demo, Guard dapat memerlukan pemeriksaan ulang. Gunakan `demo:reset` hanya untuk kembali ke kondisi awal; jangan menyamarkan kegagalan dengan approval otomatis.
- Dataset presentasi tidak memalsukan event, durasi historis, savings, atau hasil keputusan. Waktu dan dampak observed berasal dari interaksi demo yang benar-benar dijalankan.
- Mode produksi memerlukan build ulang setelah perubahan kode. Role switcher dan thread sementara CopilotKit tetap batasan prototype.

## Verifikasi

`tests/demo.spec.ts` mempersiapkan dataset presentasi hanya pada database test, mengecek ketiadaan halaman presenter pada UI, akses langsung ke pekerjaan lintas peran, refresh, navigasi mobile, dan simulasi Impact, lalu memulihkan seed standar agar suite existing tidak berubah.

Backend `test_presentation_demo.py` membuktikan reset berulang, idempotensi persiapan, keputusan manusia yang masih terbuka, serta rollback seluruh reset saat persiapan gagal. Journey domain existing tetap menjadi pengujian utama mutasi, permission, evidence, approval, dan audit.
