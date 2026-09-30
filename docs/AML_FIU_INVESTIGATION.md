# AML/FIU Investigation Review — Fase 7

SuperFlow tetap **Enterprise Knowledge-to-Action Platform**. Investigation Review adalah contoh penerapan fondasi bersama pada pekerjaan berisiko tinggi. Seluruh alert, subjek, transaksi, screening, dan berita pada prototype adalah **sintetis**. Tidak ada koneksi ke Transaction Monitoring, customer system, watchlist, pencarian internet, Getcontact, FIU, atau sistem pelaporan.

## Alur dan model

Alert → pengumpulan bukti → bantuan agent terbatas → SuperFlow Guard → rekomendasi analis → checker independen → audit.

- `Case(type=aml_investigation)` menyimpan pemilik, status, revisi, dan konteks eksekusi. `Investigation` (PK `case_id`) menyimpan alert, template, referensi subjek, skenario, indikator, provenance, catatan/rekomendasi analis, dan waktu submit/selesai.
- `CaseEvidence` memakai kontrak `EvidenceItem` existing. `ToolRun` menyimpan tiap upaya, input aman, hasil sintetis, error, dan waktu. Provenance per syarat bukti menunjuk `ToolRun`, waktu, nama alat, dan SHA-256 JSON hasil.
- `GuardEvaluation` memakai `QuestionRun` konteks Case existing; status, checks, reasons, dan audit tetap memakai SuperFlow Guard yang sama. Migrasi `0007` hanya menambah `investigations` dan `investigation_tool_runs`.
- Workflow code-defined `aml-investigation-v1`: pemeriksaan Guard → checker Compliance → selesai. User melihat pengumpulan bukti, rekomendasi, dan review sebagai progres bisnis. Tidak ada engine kedua.

## Template dan triage

`synthetic-alert-review-v1` mewajibkan `customer_profile`, `source_of_funds`, `transaction_pattern`, `watchlist_screening`, dan `adverse_news`; `supporting_documents` opsional. Ini **template skenario demo**, bukan aturan AML universal. Bukti missing tetap missing ketika alat gagal. Data awal memuat tiga syarat pertama dari dua alat sintetis.

Prioritas dihitung deterministik dari jumlah indikator yang tercatat: 0–1 = **LOW**, 2 = **MEDIUM**, 3 atau lebih = **HIGH**. Fixture ini memiliki empat indikator: 18 transfer dalam 36 jam, volume transfer di atas baseline gaji, tujuh penerima baru, dan ketidaksesuaian volume dengan deklarasi salary. Tidak ada skor probabilitas. Indikator triage hanya menentukan perhatian investigasi; bukan klasifikasi nasabah atau temuan pencucian uang.

## Alat dan agent terbatas

Registry allowlist: `get_customer_profile`, `summarize_transactions`, `run_watchlist_screening`, `search_adverse_news`. Input `SyntheticToolRequest` dan output Pydantic khusus per alat divalidasi sebelum bukti diperbarui. Semua adapter mengembalikan fixture deterministik, tidak memanggil jaringan. Tool yang tidak dikenal ditolak 422; output rusak menjadi `ToolRun` gagal dan bukti tetap missing. Setiap panggilan berizin, tersimpan sebagai `ToolRun`, menghasilkan AuditEvent, dan hanya keberhasilan yang mengubah EvidenceItem menjadi available.

Planner deterministik memilih syarat wajib berikutnya yang missing dan masih dapat dicoba. Jika `LLM_PROVIDER=ollama`, model lokal menerima hanya nama tindakan yang sudah diizinkan backend beserta kunci syarat bukti. Pydantic menolak output rusak atau tindakan di luar allowlist; fallback deterministik dipakai. Model tidak menerima wewenang mutasi, izin, Guard, triage, workflow, atau keputusan. Maksimum **8 langkah per run** dan **2 upaya per alat**. Setelah batas, agent berhenti dan mencatat kebutuhan perhatian manual. Alasan yang diaudit ringkas; chain-of-thought tidak disimpan.

## Guard dan otoritas manusia

Guard FIU memeriksa permission, provenance/fingerprint, status alat, bukti wajib, dan konflik eksplisit. Status tetap kanonik:

- **VERIFIED**: semua bukti wajib yang dikonfigurasi lulus; tetap memerlukan analis dan checker. Tidak menyatakan nasabah aman/bersalah.
- **BLOCKED**: bukti wajib missing, alat gagal, atau provenance tidak valid. Submit ditolak.
- **REVIEW_REQUIRED**: bukti ada tetapi profil salary-only bertentangan dengan narasi transaksi business settlement pada skenario konflik. AI tidak menyelesaikan konflik.
- **ACCESS_RESTRICTED**: actor tidak berwenang; API tidak mengembalikan detail bukti. `OUTDATED` tetap status kanonik platform tetapi tidak dipakai karena fixture alat tidak punya versi dokumen historis.

Raka Wijaya adalah analis sintetis. Sinta Mahardika adalah Compliance Checker sintetis dengan role `compliance`, tetapi user ID berbeda. Backend hanya memberi detail FIU kepada pembuat/pemilik atau checker yang sudah ditugaskan. Employee, Finance, Manager, dan Governance tidak dapat membaca detail raw FIU. Analis tidak dapat menyetujui sendiri. Approval existing menolak keputusan ganda/stale dengan revisi Case dan mengharuskan alasan saat REVIEW_REQUIRED. Checker dapat approve, reject, atau meminta informasi tambahan melalui layanan Approval existing; permintaan informasi menggunakan `CaseEvidence` dan langkah Guard existing. Escalation FIU tanpa checker berotoritas lebih tinggi ditolak secara eksplisit; tidak dialihkan diam-diam ke Governance.

## API dan audit

`GET/POST /api/investigations`, `GET /api/investigations/{id}`, `POST .../{id}/tools/{tool_name}`, `POST .../{id}/tools/{tool_name}/retry`, `POST .../{id}/agent/run`, `POST .../{id}/recommendation`, dan `POST .../{id}/submit`. Mutasi memakai `expected_revision` dan optional `idempotency_key`; Case dikunci saat mutasi. Keputusan checker menggunakan `/api/approvals/{id}/{action}` existing. My Work dan Reviews menggunakan Case/WorkflowRun/Approval existing, bukan salinan state FIU.

AuditEvent append-only mencatat investigasi dibuat, agent mulai/merencanakan aksi, alat diminta/berhasil/gagal/diulang, bukti terkumpul, Guard dievaluasi, rekomendasi diubah, submit, keputusan checker, dan selesai. Payload tidak menyimpan reasoning tersembunyi atau data sistem nyata. Impact Analytics membaca Case/Approval/Audit operasional sesuai scope izin existing; capacity tetap ilustratif.

## Skenario dan reset

- **AML-2026-001 — lengkap:** kumpulkan watchlist dan adverse news, Guard VERIFIED, simpan rekomendasi, submit, ganti ke checker, approve. Activity tersimpan setelah refresh.
- **AML-2026-002 — alat gagal:** watchlist gagal dua kali; evidence tetap missing, Guard BLOCKED, submit ditolak, fallback manual tercatat.
- **AML-2026-003 — konflik:** koleksi berhasil, Guard REVIEW_REQUIRED karena narasi transaksi dan profil tidak selaras; analis dan checker memutuskan dengan alasan.

Jalankan `npm.cmd run db:migrate` lalu `npm.cmd run db:seed`. Reset lokal eksplisit: `npm.cmd run db:reset -- --confirm-synthetic-data`. Reset hanya menerima PostgreSQL lokal bernama `superflow` atau `superflow_test`, menghapus pekerjaan/audit sintetis sebelumnya, dan menanam ulang tiga skenario. Tidak ada endpoint reset produksi.

## Batasan

Fixture adalah sampel demo dan belum mewakili aturan atau investigasi FIU nyata. Fingerprint membuktikan kesesuaian payload yang tersimpan, bukan keaslian sumber eksternal. AI tidak membuat disposisi AML, keputusan pelaporan, STR/SAR, atau penutupan otonom. Identitas masih mock role switcher; tidak ada SSO, notifikasi, integrasi produksi, lampiran nyata, atau audit WORM eksternal. Fase 8 tetap terpisah.
