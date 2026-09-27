# Regulation-to-Action — Fase 4

Pengalaman pengguna: **Regulatory Review** (hanya role Compliance di navigasi). Alur: perbandingan regulasi → perubahan material → dampak ke SOP/kontrol → usulan gap → keputusan manusia → remediation dengan owner dan due date → approval independen → review ditutup.

## Model internal

| Konsep internal                                           | Tampilan pengguna                               |
| --------------------------------------------------------- | ----------------------------------------------- |
| Case `regulatory_review` + tabel `regulatory_reviews`     | Satu Regulatory Review                          |
| `regulatory_findings` (PROPOSED/CONFIRMED/REJECTED)       | Gap yang diusulkan / dikonfirmasi / "Not a gap" |
| Case `remediation` + workflow `regulatory-remediation-v1` | Remediation di My Work pemilik                  |
| Approval pada step `approve_remediation`                  | Remediation approval di Reviews / Approvals     |
| AuditEvent pada kedua Case                                | Activity                                        |

- Review adalah Case agar akses (`can_access_case`), `expected_revision`, idempotency receipt, audit, dan konteks Guard dipakai ulang. Primary key `regulatory_reviews` = `case_id`, sehingga ID review sama dengan ID Case.
- Review **tidak** memakai workflow engine. Lifecycle-nya dikelola modul domain; endpoint generic `start workflow` dan `attach evidence` menolak Case review (409).
- Remediation memakai engine Fase 3 tanpa perubahan: TASK "Update the procedure or control" (owner, due date) → GUARD "Check supporting sources" (retry 2, fallback ke approval) → APPROVAL "Remediation approval" (Manager, fallback Governance, independen dari pembuat dan owner) → TERMINAL.
- Migrasi `0005` menambah dua tabel. Tidak ada model Fase 0–3 yang diubah; `CaseType` bertambah `remediation` (kolom string, tanpa migrasi).

## Analisis deterministik

Modul `regulatory_analysis.py` murni (tanpa DB) dan dapat diganti melalui Protocol `RegulationComparator`, `ImpactMapper`, `GapAnalyzer` — misalnya provider LLM dengan structured output — tanpa mengubah persistence atau otorisasi.

1. **Perbandingan** (`deterministic-regulation-compare-v1`): section diselaraskan berdasarkan heading. Status ADDED/REMOVED/MODIFIED/UNCHANGED. Perubahan persyaratan terdeteksi dari frasa `every|within|for N hour/day/week/month/year` (angka atau kata). Kalimat baru dengan istilah yang tidak ada di versi sebelumnya menjadi _new obligation_. Material = ada perubahan persyaratan, obligation baru, atau section ditambah/dihapus.
2. **Impact mapping**: kandidat hanya dokumen yang **sudah lolos `can_read`** sebelum teks dibaca, bukan regulasi, authority ≥ 4, versi aktif-efektif. Basis `explicit_reference` bila chunk menyebut "Article N" dan dokumen berelasi dengan regulasi; `topic_match` bila semua istilah topik heading artikel muncul di section.
3. **Gap**: `requirement_mismatch` bila nilai prosedur tidak memenuhi nilai baru (`every`/`within` = batas atas, `for` = batas bawah); `missing_obligation` bila < 50% istilah obligation baru tercakup section.

Semua citation menunjuk chunk nyata. Versi sebelumnya tampil sebagai baseline historis dan tidak masuk konteks Guard. Guard dievaluasi pada versi regulasi saat ini + section terdampak; pada seed hasilnya REVIEW_REQUIRED karena Access Review SOP (12 bulan) dan Access Review Control Policy (6 bulan) memang konflik.

## Aturan kontrol

- Membuat review dan memutuskan gap: role Compliance yang merupakan pembuat/owner review. Governance dapat melihat (oversight) tanpa kontrol keputusan. Role lain: 403 pada sumber/pembuatan, 404 pada review.
- Konfirmasi wajib owner dan due date ≥ hari ini; pernyataan gap dapat diedit (usulan asli tetap tersimpan). Owner harus dapat mengakses regulasi dan semua section terkait (divalidasi `new_case`); Employee ditolak.
- Reject wajib alasan. Keputusan yang sudah diambil tidak dapat diubah (409); remediation yang ditolak approver dapat di-_reassign_.
- Review hanya dapat ditutup bila semua gap diputuskan dan setiap remediation yang dikonfirmasi berstatus selesai (sudah di-approve).
- Konteks remediation berisi artikel terkini + seluruh kontrol yang dipetakan ke artikel itu, sehingga konflik antar-kontrol tetap terlihat oleh owner dan approver.
- Due date disimpan pukul 12:00 UTC agar tanggal kalender stabil untuk zona UTC-11 s.d. UTC+11.

## API

| Endpoint                                 | Fungsi                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /api/regulatory-reviews/sources`    | Regulasi (Compliance, authority 5) dengan versi sebelumnya; ID review terbuka bila ada                           |
| `GET /api/regulatory-reviews`            | Review yang dapat diakses                                                                                        |
| `POST /api/regulatory-reviews`           | `document_id`, opsional `base_version_id`; 201 baru, 200 bila review terbuka untuk versi yang sama dipakai ulang |
| `GET /api/regulatory-reviews/{id}`       | Perbandingan, dampak, gap, remediation, reliability, activity, `allowed_actions`                                 |
| `POST .../findings/{finding_id}/confirm` | `expected_revision`, `owner_id`, `due_date`, opsional `summary`, `reason`, `idempotency_key`                     |
| `POST .../findings/{finding_id}/reject`  | `expected_revision`, `reason`                                                                                    |
| `POST .../{id}/complete`                 | Menutup review                                                                                                   |

Kontrak TypeScript di-generate: `node scripts/python.mjs scripts/generate-regulatory.py` (tambahkan `--check` untuk verifikasi).

## Frontend

- Route `/regulatory` (daftar + mulai review) dan `/regulatory?review=<id>` (detail). Home Compliance menampilkan versi regulasi baru yang belum direview dan review yang menunggu keputusan.
- Komponen terkontrol `ComparisonTable` kini _available_ di registry. `GapFinding` menampilkan detail gap dan evidence **sebelum** kontrol keputusan.
- My Work membuka review di Regulatory Review; remediation tampil sebagai "Remediation" dengan label langkah dari definisi.
- Ask: untuk Compliance, pertanyaan tentang perubahan regulasi menawarkan **Start Regulatory Review**.

## Batasan

- Deteksi berbasis aturan: frasa kuantitas dan istilah kata kunci; tidak ada pemahaman semantik, parafrase, atau penilaian hukum. Usulan wajib dikonfirmasi manusia.
- Regulasi = dokumen domain Compliance dengan authority 5 (aturan prototype; belum ada field tipe dokumen).
- Target harus versi aktif; perbandingan versi draft (akan berlaku) belum didukung karena Guard memblokir draft.
- Konteks review dibatasi 30 section. Guard remediation tidak memverifikasi bahwa SOP sudah diperbarui — approver yang menilai; menempelkan versi SOP baru sebagai evidence didukung melalui fitur evidence existing.
- Hanya satu pengguna Compliance sintetis; review terbuka dipakai ulang per versi target untuk pengguna yang dapat mengaksesnya.
