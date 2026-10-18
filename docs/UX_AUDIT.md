# Audit UX sebelum penyederhanaan

Audit ini mencatat **alasan membuka halaman, satu tugas utama, informasi langsung, detail yang dapat ditunda, duplikasi, dan konsep internal** untuk lima persona demo. Semua data dan otoritas tetap berasal dari API yang ada.

| Persona | Layar yang dibuka | Tugas utama | Perlu langsung | Tunda/sembunyikan | Duplikasi atau istilah yang perlu dihilangkan |
| --- | --- | --- | --- | --- | --- |
| Employee | Home | Menemukan langkah berikutnya | Salam, tindakan ringkas, pintu Ask, sumber terbaru | Tabel Work, riwayat Ask panjang, metadata corpus | Home mengulang Work/Knowledge; jangan tampilkan case/workflow |
| Employee | Ask | Bertanya tentang kebijakan | Input, contoh relevan, jawaban, status, sumber, tindakan | Filter domain/sumber/versi/WebSearch, daftar riwayat dan bukti rinci | Konfigurasi retrieval sebelum pertanyaan |
| Employee | Work | Melanjutkan request atau bukti yang ditugaskan | Tugas, status, langkah berikutnya | Audit/progress rinci dalam detail | My Work dan Reviews tidak perlu menjadi dua menu |
| Employee | Knowledge Library | Membaca sumber asli | Judul, kategori, versi, pembaruan | Hash, authority scoring, akses, reindex | Repository teknis |
| Manager | Home | Melihat tugas dan keputusan penting | Jumlah keputusan dan pekerjaan, Ask | Tabel approval dan Work penuh | Dua antrean yang mengulang isi |
| Manager | Ask / Knowledge Library | Mencari jawaban atau sumber untuk keputusan | Jawaban/sumber yang diizinkan | Detail teknis dan pemeliharaan tanpa izin | Hindari bahasa Guard/Run |
| Manager | Work | Memutuskan request | Tab My Tasks / Needs My Decision, bukti sebelum tombol | Aktivitas, pemeriksaan rinci | Item keputusan jangan mengulang di kedua tab tanpa tanggung jawab berbeda |
| Compliance | Home | Menemukan review regulasi dan keputusan | Ringkasan perhatian, link specialist | Perbandingan/gap penuh | Jangan menyalin Regulatory Review ke Home |
| Compliance | Ask / Knowledge Library | Menginspeksi aturan dan kebijakan | Jawaban, versi dan sumber | Konfigurasi pencarian dan metadata teknis | Jaga referensi OJK terpisah dari sintesis |
| Compliance | Work | Menangani tugas atau keputusan | Tab tugas/keputusan | Jejak teknis | Review approval berada di Work |
| Compliance | Regulatory Review | Menilai perubahan → gap → remediasi | Ringkasan 3 tahap dan satu tahap aktif | Tahap lain, audit, checks, citation detail | Form panjang serentak; backend review tetap |
| Finance | Home | Menemukan analisis dan keputusan | Ringkasan perhatian, link Analysis | Analisis penuh | Hindari dashboard analitik |
| Finance | Ask / Knowledge Library | Memeriksa referensi/asumsi | Jawaban dan dokumen | Filter serta metadata teknis | Sumber publik bukan kebijakan internal |
| Finance | Work | Menangani request/keputusan | Tugas dan keputusan terpisah dalam tab | Riwayat/audit | Tidak perlu menu Reviews terpisah |
| Finance | Investment Analysis | Memilih sumber asumsi lalu menilai hasil | Konflik nilai dan tindakan saat relevan | Tabel asumsi, kalkulasi, memo sampai tahapnya | Semua tahap saat awal membebani pengguna |
| Governance Admin | Home | Menemukan pekerjaan sumber dan keputusan | Link Work/Knowledge serta perhatian | Tabel korpus/analitik | Home bukan admin dashboard |
| Governance Admin | Knowledge Library | Memelihara sumber resmi | Daftar sumber dan kontrol unggah | Metadata, versi, authority, re-index dalam detail | Pembaca biasa tidak melihat kontrol ini |
| Governance Admin | Work | Menangani keputusan/tugas berwenang | Tab tugas/keputusan | Audit/Guard dalam detail | Tidak perlu menu approval terpisah |

Route langsung `/impact`, `/investigations`, `/cases`, dan `/decisions` tetap dipertahankan. SME dan Compliance Checker tetap sebagai peran backend untuk workflow/proof point, tetapi tidak menjadi pilihan persona demo utama. Penyederhanaan UI tidak mengubah permission, keputusan, kalkulasi, atau persistensi backend.
