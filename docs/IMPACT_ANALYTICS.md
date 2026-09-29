# Impact Analytics — Fase 6

Pengalaman pengguna: **Impact** untuk Manager, Subject Matter Expert, Compliance, Finance, dan Governance. Employee tetap memakai My Work dan tidak mendapat agregat lintas pekerjaan.

Impact mengukur **Quality, Cost / Capacity, dan Delivery (QCD)** dari data operasional yang memang tersimpan. Angka observed tidak direkonstruksi di frontend. Nilai kapasitas yang memakai asumsi selalu diberi label **Illustrative simulation** dan tidak dipresentasikan sebagai profit atau penghematan terealisasi.

## Controlled generative UI

Pengguna dapat bertanya, misalnya:

- `Where does reliability need attention?`
- `How much capacity could be released?`
- `What is slowing delivery?`

Backend `DeterministicImpactComposer` mengklasifikasikan intent menjadi `overview`, `quality`, `capacity`, atau `delivery`, lalu memilih dan mengurutkan komponen dari registry yang disetujui:

- `ImpactBrief`
- `MetricGroup`
- `DistributionChart`
- `CapacitySimulation`
- `NextActions`

Payload divalidasi terhadap kontrak Pydantic dan TypeScript sebelum dirender. Tipe komponen yang tidak dikenal membuat frontend fail closed. Composer tidak dapat menghasilkan HTML, JavaScript, permission, rumus, atau nilai metrik sendiri.

Provider prototype adalah `deterministic-impact-composer-v1`, sehingga demo tidak memerlukan kredensial AI berbayar. Abstraksi `ImpactComposer` dapat diganti provider structured-output di masa depan tanpa mengubah registry dan kontrol frontend.

## Scope dan permission

- Backend mengizinkan Manager, SME, Compliance, Finance, dan Governance.
- Governance melihat agregat data sintetis platform.
- Role lain hanya melihat pertanyaan miliknya dan Case yang lolos `can_access_case`, termasuk pemeriksaan ulang akses sumber.
- Employee mendapat 403 dari API dan tidak melihat navigasi Impact.
- Payload hanya berisi agregat, metode, dan label bisnis; judul/isi sumber milik role lain tidak ikut disalin.

## Quality

| Metrik                            | Sumber persisted                                                                |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Citation coverage                 | latest `citation_coverage` Guard check per pertanyaan yang benar-benar disubmit |
| Verified result rate              | latest canonical `VERIFIED` Guard result                                        |
| Conflicts detected                | latest `conflict_detection` check dengan `passed = false`                       |
| Information requested             | append-only `evidence_requested` audit event                                    |
| Historical-source results flagged | latest canonical `OUTDATED` Guard result                                        |

QuestionRun yang dibuat sebagai context internal Case tidak dihitung sebagai pertanyaan pengguna. Hanya entitas dengan event `question_submitted` yang masuk volume Ask.

## Cost / Capacity

Observed:

- pertanyaan yang disubmit,
- work item yang selesai.

Illustrative simulation:

- knowledge lookup: 15 menit baseline vs 3 menit dengan SuperFlow,
- controlled work: 90 menit baseline vs 45 menit dengan SuperFlow,
- illustrative loaded capacity cost: IDR 150.000 per jam.

Output:

- capacity released,
- illustrative cost avoidance,
- capacity value per completed item.

Semua asumsi ditampilkan di UI. Angka ini adalah skenario soft-dollar, bukan realized profit.

## Delivery

| Metrik                      | Sumber persisted                                                  |
| --------------------------- | ----------------------------------------------------------------- |
| Average answer time         | pasangan timestamp audit `question_submitted` → `result_returned` |
| Average work cycle time     | `Case.created_at` → final `updated_at` untuk Case completed       |
| Active backlog              | Case non-terminal yang dapat diakses                              |
| Completed work / throughput | Case `COMPLETED`                                                  |
| Completion rate             | completed ÷ semua Case accessible                                 |
| Average review time         | `Approval.requested_at` → `decided_at`                            |
| Escalations                 | append-only `escalation_created` audit event                      |

Nilai tanpa observasi ditampilkan sebagai **Not yet measured**, bukan nol yang direka.

## Audit visualization

Event yang diizinkan dikelompokkan ke bahasa pengguna:

- Answers and retrieval
- Reliability controls
- Human review decisions
- Regulatory and investment actions

Raw event type, payload, dan ID internal tidak menjadi tampilan utama.

## API

| Endpoint           | Fungsi                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| `GET /api/impact`  | workspace overview QCD sesuai scope role                                  |
| `POST /api/impact` | menerima `question` dan mengomposisikan approved components sesuai intent |

Kontrak TypeScript dihasilkan dari Pydantic:

```powershell
node scripts/python.mjs scripts/generate-analytics.py
node scripts/python.mjs scripts/generate-analytics.py --check
```

## Batasan

- Belum ada filter periode atau baseline organisasi yang dapat dikonfigurasi.
- Cycle time memakai timestamp Case yang tersedia; belum ada business calendar atau jam kerja.
- Capacity simulation memakai asumsi prototype statis yang transparan.
- Belum ada trend historis/snapshot warehouse, drill-down BI, export, atau alert.
- Composer masih deterministik; provider LLM structured-output belum diaktifkan.
