# SuperFlow Guard — Fase 2

**Catatan setelah Fase 3:** fondasi ini sekarang dipakai Workflow Core dengan additional EvidenceItem untuk Case requirements; tidak ada reliability engine kedua. GuardEvaluation/QuestionRun tetap sumber persistence. Case context internal dibaca melalui Case API agar requirements tidak dilewati melalui saved Ask. Lihat [WORKFLOW_CORE.md](WORKFLOW_CORE.md). Calculation dan arbitrary action interface tetap tidak dijalankan.

## Alur dan batas fase

Pertanyaan → authorized retrieval → AnswerProvider → SuperFlowGuard → hasil reliability → UI terkontrol → audit.

`QuestionRun`, dokumen, versi, chunk, `can_read`, dan citation existing tetap menjadi sumber kebenaran. Tidak ada permission engine atau sistem versi kedua. Fase ini berakhir pada evaluasi pengetahuan; tidak ada Case, workflow, task, approval, atau perhitungan keuangan.

## Kontrak

`GuardInput` berisi user, AskInput, sumber yang sudah diotorisasi, jawaban extractive, dan interface action opsional. Action belum didukung dan menghasilkan BLOCKED.

`GuardResult` berisi status, sembilan check bertipe, reasons, evidence, source references, active replacements, allowed actions, policy version, ID, dan timestamp evaluasi. Check memiliki `passed: boolean | null`, `applicable`, dan `details`. Null berarti tidak dievaluasi; bukan passed.

Status kanonik didefinisikan sekali dalam `ReliabilityStatus` backend: VERIFIED, REVIEW_REQUIRED, BLOCKED, OUTDATED, ACCESS_RESTRICTED. TypeScript dihasilkan dari schema Pydantic, termasuk nama check dan allowed actions:

```powershell
node scripts/python.mjs scripts/generate-reliability.py
npm.cmd exec prettier -- --write apps/web/lib/reliability-contracts.ts
node scripts/python.mjs scripts/generate-reliability.py --check
```

Frontend memvalidasi kontrak sebelum merender. Komponen fungsional: AnswerCard, SourcePanel, EvidenceChecklist. React merender teks; tidak ada HTML model.

## Aturan deterministik

| Check                    | Aturan Fase 2                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| citation_coverage        | Setiap extract jawaban harus sama persis dengan seluruh teks chunk yang dirujuk, diikuti marker `[citation_id]`. Semua source yang dipakai provider harus tercakup. Teks tambahan tanpa dukungan, marker hilang, atau excerpt yang diubah gagal. Whitespace di batas extract dinormalisasi; isi chunk tidak memakai fuzzy matching. |
| source_validity          | Hubungan document/version/chunk, teks tersimpan, status, effective date, dan authority harus sesuai dengan citation.                                                                                                                                                                                                                |
| source_authority         | Setiap sumber yang mendukung jawaban harus memiliki authority 4 atau 5. Sumber tingkat 1–3 tetap bisa diperiksa sebagai evidence, tetapi memerlukan REVIEW_REQUIRED. Threshold ini aturan prototype, bukan klasifikasi approval produksi.                                                                                           |
| version_validity         | Active dan sudah efektif untuk jawaban current. Historical retrieval tetap opt-in; adanya sumber outdated memberi OUTDATED. Draft atau future-effective tidak menjadi dasar jawaban.                                                                                                                                                |
| permission_validity      | Reuse `can_read`: filter dokumen sebelum query chunk dan ranking, lalu pemeriksaan ulang sebelum source text/output/saved answer/download.                                                                                                                                                                                          |
| evidence_completeness    | Supporting source wajib ada. Pertanyaan receipt exception memerlukan Receipt Exception Authority Policy yang current, approved, dan berhasil diretrieve. Access review memerlukan kedua referensi current.                                                                                                                          |
| conflict_detection       | Regex claim eksplisit `review access rights every N months` pada sumber active dengan authority ≥4. Nilai berbeda berarti konflik. Versi historis tidak dibandingkan sebagai konflik current. Tidak ada semantic/LLM conflict detector.                                                                                             |
| calculation_validity     | `applicable=false`, `passed=null`; tidak ada kalkulasi keuangan yang dijalankan.                                                                                                                                                                                                                                                    |
| human_review_requirement | Konflik, authority rendah, atau permintaan action membutuhkan perhatian manusia. Tidak membuat approval/task.                                                                                                                                                                                                                       |

Urutan keputusan: ACCESS_RESTRICTED → BLOCKED untuk prasyarat/evidence gagal → REVIEW_REQUIRED untuk konflik → OUTDATED → BLOCKED jika versi tidak current → REVIEW_REQUIRED untuk authority rendah → VERIFIED. Status tidak mengukur relevansi semantik atau probabilitas kebenaran. VERIFIED terbatas pada kontrol extractive yang disebutkan di atas; tidak memberi izin eksekusi bisnis.

Allowed actions hanya `inspect_sources`, `inspect_active_version`, dan `consult_owner`. Tidak ada approve, start workflow, atau create case.

## Evidence dan konflik

Evidence disimpan dalam JSON hasil Guard, terkait answer/run. Setiap item memiliki key, label, required, status available/missing/conflicting, details, dan referensi citation sebenarnya. Model ini tidak bergantung pada AML atau Case.

Aturan receipt exception dipicu oleh token receipt bersama without/missing/lost. Evidence requirement memakai judul terkontrol **Receipt Exception Authority Policy**, bukan hasil LLM. Source wajib current dan authority ≥4. Seed sengaja tidak memiliki policy tersebut. Upload sumber dengan metadata/judul itu dapat memenuhi requirement bila masuk retrieval; upload tidak otomatis membenarkan pengecualian, jawaban tetap teks sumber.

Aturan access review memerlukan Access Review SOP dan Access Review Control Policy. Filter yang mengeluarkan satu referensi memberi BLOCKED, bukan klaim bahwa sumber telah sepakat. Deteksi konflik dapat diganti melalui interface `ConflictDetector`. Skenario seed tidak mengubah SOP existing; policy sintetis tambahan memuat interval 6 bulan, sedangkan SOP memuat 12 bulan.

## Izin dan saved answer

ACCESS_RESTRICTED memakai sinyal metadata saja: minimal dua token judul relevan dan sekurangnya setengah vocabulary judul. Filter ID sendiri tidak mengonfirmasi keberadaan sumber. Dokumen unknown/inaccessible tetap memberi respons direct-read 404 yang sama. Denied chunks, excerpt, title, owner, citation, dan file tidak dibaca/dikembalikan. Guidance akses bersifat generik.

Setiap saved answer diperiksa ulang. Fingerprint evaluasi yang sama memakai record Guard yang sama; perubahan source status/authority/evidence menghasilkan evaluasi baru. Saved run Fase 1 mendapat Guard pada pembacaan pertama. Perubahan izin yang mencabut source menghasilkan 403 aman dan menghilangkan run dari history; tidak mengembalikan cached answer. Perubahan teks chunk membuat coverage gagal dan menahan jawaban lama.

## Database dan audit

Migrasi `0002_reliability_core` menambah `guard_results` dan `audit_events`. `0003_audit_protection` memperkuat trigger audit tanpa menghapus data existing.

- `guard_results`: FK ke QuestionRun, status kanonik dengan constraint, JSON kontrak, fingerprint, timestamp. Re-evaluation menambah record, sehingga evaluasi sebelumnya tetap dapat ditelusuri.
- `audit_events`: actor/type, event type, entity/type/ID, payload JSON, timestamp; tidak menyalin raw excerpt/jawaban. Input/output dicatat dengan digest dan hubungan run. QuestionRun menyimpan pertanyaan/output asli sesuai fondasi Fase 1.
- Event: question_submitted, retrieval_completed, answer_generated, guard_evaluated, source_blocked_by_permission, outdated_source_detected, conflict_detected, result_returned. Saved reads juga menghasilkan result_returned.
- Ask menyimpan run, Guard, dan event dalam transaksi yang sama. Tidak ada PATCH/DELETE audit API.
- ORM menolak update/delete AuditEvent. PostgreSQL trigger menolak UPDATE, DELETE, dan TRUNCATE langsung. SQLite unit tests memiliki proteksi ORM; trigger database hanya diverifikasi di PostgreSQL.
- Reset demo lokal memakai mode maintenance dalam transaksi untuk DELETE sintetis, lalu mengembalikannya ke off. Update dan truncate tetap dilarang. Database owner masih dapat mengubah trigger/config; ini bukan WORM atau jaminan tahan manipulasi administrator produksi.

`GET /api/audit?run_id=...` mengembalikan maksimal 200 event identitas sendiri. Governance demo juga tidak memperoleh event user lain. Source references diotorisasi ulang; filter private tidak dikembalikan. Endpoint ini fondasi/debug API, bukan modul Governance UI.

## Demo lima status

Gunakan Employee, domain All domains, source filter sesuai tabel. Pastikan database sudah dimigrasi/seed. Reset hanya memakai CLI eksplisit untuk data sintetis lokal.

| Status            | Pertanyaan / pilihan                                                               | Hasil yang diperiksa                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| VERIFIED          | `How many annual leave days do I get?`; source Annual Leave Policy; historical off | 15 hari, v2.0 active, citation dan semua check applicable lulus                                                 |
| OUTDATED          | `annual leave days historical v1`; source Annual Leave Policy; historical on       | 12 hari dari v1.0 historical, status OUTDATED, tombol active replacement v2.0                                   |
| ACCESS_RESTRICTED | `What is the investment approval authority?`; All sources                          | Guidance generik; tidak ada restricted excerpt, citation, title, atau file                                      |
| BLOCKED           | `Can I reimburse an expense without a receipt?`; source Expense Reimbursement SOP  | Receipt exception authority missing; extract tetap dapat diperiksa sebagai evidence, tanpa kesimpulan exception |
| REVIEW_REQUIRED   | `How often are access rights reviewed?`; All sources                               | SOP 12 bulan dan control policy 6 bulan, kedua referensi tersedia, tidak memilih satu secara diam-diam          |

Buka Evidence checklist dan Guard checks. Klik evidence/citation untuk source/version yang tepat. Refresh mempertahankan run/reliability; role switch mengosongkan konteks dan API memeriksa hak akses kembali. Ulangi setelah reset untuk hasil yang sama.

## Keterbatasan

- Provider masih extractive; coverage tidak membuktikan bahwa sumber benar atau menjawab seluruh maksud pertanyaan.
- Requirement/claim rules eksplisit hanya mencakup skenario di atas. Tidak ada pemeriksaan semantic contradiction atau ambiguity menyeluruh; detail check menyatakan cakupannya.
- ACCESS_RESTRICTED bergantung pada relevansi judul metadata; query samar mungkin menghasilkan BLOCKED. Guidance tidak membocorkan identitas sumber.
- Retrieval tetap keyword/concept dan top-four, sehingga evidence di luar filter/ranking dapat menjadi missing. Sistem tidak mengklaim pencarian evidence menyeluruh.
- Mock identity belum SSO/auth produksi. Audit belum retention/WORM eksternal. Reset sintetis sengaja menghapus audit demo.
- Fase 3 sekarang memakai fondasi ini melalui Workflow Core; modul Fase 4 dan sesudahnya belum dimulai.

## Hasil verifikasi Fase 2

- Backend PostgreSQL: 62 lulus, termasuk proteksi audit SQL langsung dan permission/revocation. Backend SQLite terisolasi: 62 lulus.
- Frontend unit: 7 lulus. E2E Chromium: 14 lulus, termasuk sembilan regresi Fase 0/1 dan lima status reliability.
- Ruff formatter/linter, Prettier, ESLint, TypeScript, generated-contract check, migrasi/schema check, seed idempotent, dan production build lulus.
- Produksi berjalan pada port 3000/8000 dengan PostgreSQL. Lima skenario dipastikan pada UI produksi; refresh/active replacement, Home, Knowledge/detail, dan role switch diperiksa. Nol browser runtime errors atau overflow halaman pada 375, 390, 768, 1024, dan 1440 px.
- Screenshot desktop/mobile/disclosure tersedia di `.runtime/screenshots/phase2`, tidak masuk Git. Warning TestClient HTTPX dan NO_COLOR/FORCE_COLOR tidak mengubah hasil test.
