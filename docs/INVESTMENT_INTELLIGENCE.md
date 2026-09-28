# Investment Intelligence — Fase 5

Pengalaman pengguna: **Investment Analysis** (hanya role Finance di navigasi). Alurnya:

1. Pilih proposal dan sumber pendukung (quotation, proyeksi cash flow, approval policy).
2. Asumsi diekstrak dengan citation, dan konflik ditampilkan.
3. Finance memilih nilai sumber dengan alasan.
4. NPV, IRR, ROI, payback, break-even, dan sensitivity dihitung deterministik.
5. Draft memo dibuat.
6. Analisis disubmit ke approver yang ditentukan dari approval policy.
7. Approver memutuskan di Reviews / Approvals.

## Model internal

| Konsep internal                                                | Tampilan pengguna                            |
| -------------------------------------------------------------- | -------------------------------------------- |
| Case `investment` + tabel `investment_analyses` (PK = case_id) | Satu Investment Analysis                     |
| `assumptions` (JSON snapshot hasil ekstraksi)                  | Source-backed assumptions                    |
| `selections` (pilihan manusia per input)                       | "Selected by Finance" + alasan               |
| `submitted` (snapshot kalkulasi, memo, route)                  | Hasil dan memo yang dibekukan untuk approver |
| Workflow `investment-approval-v1` / `investment-committee-v1`  | Waiting for approval → Approved              |
| AuditEvent Case                                                | Activity                                     |

- Analisis memakai ulang akses Case, `expected_revision`, idempotency receipt, audit, dan konteks Guard. Migrasi `0006` menambah satu tabel. Model Fase 0–4 tidak diubah.
- Endpoint generic `start workflow` menolak Case analisis (409). Submit hanya lewat modul investment, yang memvalidasi input dan membekukan snapshot. Attach evidence generic tetap boleh, dipakai saat approver meminta informasi tambahan.
- Workflow approval: GUARD "Check sources and calculation" (retry 2, fallback ke approval) → APPROVAL → TERMINAL. Approver independen dari pembuat (Finance tidak dapat self-approve).

## Ekstraksi dan resolusi (deterministik)

`investment_extraction.py` murni dan dapat diganti lewat Protocol `AssumptionExtractor` (misalnya provider LLM dengan structured output). Aturan `deterministic-assumption-extract-v1`:

| Sumber    | Pola                                                                                                        | Input                              |
| --------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Proposal  | `initial investment of IDR …`, `annual net cash inflows of IDR … for N years`, `discount rate is N percent` | investment, inflow, term, rate     |
| Quotation | `quotes IDR …`                                                                                              | investment (quoted cost)           |
| Proyeksi  | `Year 0: -…`, `Year n: …`                                                                                   | investment, inflow per tahun, term |
| Policy    | `up to IDR … require`                                                                                       | approval threshold                 |

Setiap nilai menyimpan chunk sumber dan kalimat asalnya. Per input, status `resolve` adalah:

- **consistent**: semua sumber sepakat.
- **conflict**: nilai berbeda, belum dipilih.
- **resolved**: dipilih Finance dengan alasan.
- **missing**: tidak ada sumber yang menyebutkannya.

SuperFlow tidak pernah memilih nilai sendiri. Pilihan hanya boleh dari nilai yang benar-benar ada di sumber; angka bebas tidak diterima.

Proposal = dokumen Finance aktif yang menyatakan `initial investment` sendiri. Quotation dan proyeksi tidak dianggap proposal. Sumber pendukung default = `related_document_ids` proposal yang lolos `can_read` sebelum teks dibaca. Sumber terbatas dilewati tanpa jejak, dan ID terbatas yang dikirim eksplisit menghasilkan 404.

## Kalkulasi (`finance_calc.py`)

Cash flow tahunan: tahun 0 = −investasi, tahun 1…n = inflow tetap.

| Metrik      | Rumus                                                                    | Unit / periode        |
| ----------- | ------------------------------------------------------------------------ | --------------------- |
| NPV         | Σ CFₜ ÷ (1 + r)ᵗ, t = 0…n                                                | IDR, n tahun @ r      |
| IRR         | r saat NPV = 0 (bisection); `None` bila cash flow tidak berganti tanda   | % per tahun           |
| ROI         | (Σ inflow − investasi) ÷ investasi                                       | %, tanpa diskonto     |
| Payback     | tahun sampai kumulatif ≥ 0, interpolasi linear                           | tahun, tanpa diskonto |
| Break-even  | investasi ÷ [(1 − (1 + r)⁻ⁿ) ÷ r]                                        | IDR per tahun         |
| Sensitivity | NPV saat satu input (investasi, inflow, rate) berubah −20/−10/0/+10/+20% | IDR                   |

Nilai referensi (dites):

| Skenario                            | NPV            | IRR    | Payback    |
| ----------------------------------- | -------------- | ------ | ---------- |
| Proposal A @10%, investasi 180 juta | IDR 26.041.254 | —      | 2,77 tahun |
| Proposal A @10%, quotation 195 juta | IDR 11.041.254 | 12,59% | 3 tahun    |
| Proposal B @12%                     | IDR 2.987.948  | —      | —          |

Frontend hanya memformat angka dari backend dan tidak menghitung ulang.

## Guard

`GuardInput.calculation` (opsional) membuat `calculation_validity` menjadi pemeriksaan nyata:

- Setiap input wajib menjadi EvidenceItem dengan status available/missing/conflicting beserta citation.
- Input missing → **BLOCKED**.
- Input conflict → **REVIEW_REQUIRED** (konflik ditampilkan di Evidence checklist).

Resolver didaftarkan per tipe Case melalui `cases.CALCULATION_INPUTS`, sehingga semua evaluasi, termasuk langkah workflow dan keputusan approval, memakai pemeriksaan yang sama.

Proposal bernilai authority 2, sehingga hasil tetap REVIEW_REQUIRED setelah konflik diselesaikan. Akibatnya approver wajib menulis alasan. Tanpa konteks kalkulasi, detail check tetap "Not applicable: this context involves no calculation." (label "Phase 2" dihapus dari teks yang tampil ke user).

## Routing approval

Threshold diambil dari sumber approval policy, lengkap dengan citation.

- Investasi ≤ threshold → `investment-approval-v1`, Manager ("department manager and Finance reviewer"; Finance adalah pembuat).
- Investasi > threshold → `investment-committee-v1`, Governance sebagai pengganti komite di demo.
- Tanpa sumber approval policy, input `approval_threshold` missing: BLOCKED dan submit ditolak.

## API

| Endpoint                               | Fungsi                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/investment-analyses/sources` | Proposal saat ini + sumber terkait yang dapat diakses; ID analisis terbuka                                               |
| `GET /api/investment-analyses`         | Analisis yang dapat diakses                                                                                              |
| `POST /api/investment-analyses`        | `proposal_document_id`, opsional `supporting_document_ids`; 201 baru, 200 memakai ulang analisis terbuka versi yang sama |
| `GET /api/investment-analyses/{id}`    | Input, asumsi, kalkulasi, memo, route, reliability, activity, `allowed_actions`                                          |
| `POST .../{id}/select`                 | `expected_revision`, `assumption_id`, `reason` (wajib)                                                                   |
| `POST .../{id}/memo`                   | `expected_revision`, `memo` (20–8000 karakter)                                                                           |
| `POST .../{id}/submit`                 | Membekukan snapshot dan memulai approval                                                                                 |

Keputusan memakai endpoint approval existing. Kontrak TypeScript di-generate dengan `node scripts/python.mjs scripts/generate-investment.py` (tambahkan `--check` untuk verifikasi).

## Frontend

- `/investment` untuk daftar dan persiapan; `/investment?analysis=<id>` untuk detail.
- Komponen terkontrol `FinancialAnalysis` kini _available_: metric tile dengan periode, formula, dan catatan; tabel cash flow; tabel sensitivity dengan nilai negatif bertanda minus dan label teks.
- `InputDecision` menampilkan nilai dan kutipan sumber sebelum kontrol pilihan. Memo dapat diedit sebelum submit.
- Layar review approver (`/decisions?case=`) menampilkan hasil dan memo yang disubmit sebelum ApprovalPanel.
- Home Finance menampilkan proposal yang belum dianalisis dan analisis yang menunggu input.
- Di Ask, pertanyaan Finance tentang proposal/asumsi/NPV menawarkan **Prepare Analysis**.

## Batasan

- Ekstraksi berbasis pola untuk kalimat seed. Belum ada OCR, tabel spreadsheet, atau pemahaman semantik.
- Model cash flow memakai inflow tetap. Proyeksi dengan inflow berbeda per tahun menjadi konflik yang harus dipilih manusia.
- Tidak ada pajak, inflasi, nilai sisa, atau pembiayaan. Semua angka sintetis dan ilustratif.
- Memo yang sudah diedit tidak ikut diperbarui saat input berubah. Status "edited" ditampilkan.
- Komite investasi disimulasikan oleh Governance.
- Analisis dibekukan setelah submit. Informasi tambahan diberikan lewat evidence existing, tanpa resubmit kalkulasi.
