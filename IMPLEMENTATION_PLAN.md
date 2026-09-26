# Rencana Implementasi SuperFlow

## Tujuan dan ruang lingkup

SuperFlow adalah **Enterprise Knowledge-to-Action Platform** untuk workspace internal Superbank. Rantai produknya: Governed Knowledge → AI Agent → Reliability Layer → Controlled Action → Business Impact.

Pekerjaan yang diotorisasi saat ini adalah **rekonsiliasi Fase 0/1 dan penyempurnaan frontend**. Implementasi berhenti pada fondasi platform dan Knowledge Core. Fase 2 tidak dimulai. [PRD](SuperFlow_PRD_v1.md) dan [AGENTS.md](AGENTS.md) tetap berbahasa Inggris; panduan proyek lainnya menggunakan Bahasa Indonesia.

## Tahapan PRD

| Fase                        | Tujuan                                     | Deliverable                                                                                        | Dependency                           | Status                                                                             |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| 0 — Skeleton                | Fondasi aplikasi yang dapat dijalankan     | Monorepo Next.js/FastAPI, PostgreSQL, Alembic, seed sintetis, shell dan identitas demo             | Node.js, Python, PostgreSQL          | Selesai; PostgreSQL lokal terverifikasi, Compose menunggu lingkungan Docker        |
| 1 — Knowledge Core          | Pertanyaan yang dapat ditelusuri ke sumber | Upload/parsing/chunking, metadata/versi/relasi, retrieval abstraction, Ask, citation, Source Panel | Fase 0, dokumen seed                 | Selesai untuk scope prototype Fase 0/1; rekonsiliasi dan verifikasi lulus          |
| 2 — Reliability Core        | Pemeriksaan reliability yang persisten     | SuperFlow Guard, citation coverage, evidence/conflict, audit                                       | Knowledge Core, kontrak reliability  | Belum dimulai; memerlukan instruksi berikutnya                                     |
| 3 — Workflow Core           | Aksi dan keputusan manusia                 | Cases, state machine, tasks, retry/escalation, Decision Center, approval                           | Guard dan audit                      | Belum dimulai                                                                      |
| 4 — Regulation-to-Action    | Perubahan regulasi menuju remediation      | Comparison, SOP mapping, gap, remediation                                                          | Fase 1–3                             | Belum dimulai; hanya sumber sintetis tersedia                                      |
| 5 — Investment Intelligence | Analisis investasi deterministik           | Extraction, formula keuangan, sensitivity, memo, approval                                          | Fase 1–3                             | Belum dimulai; hanya proposal/quotation/cash-flow seed tersedia                    |
| 6 — Analytics               | Pengukuran QCD dan dampak                  | Quality, Cost/Capacity, Delivery, audit visualization                                              | Data eksekusi dan definisi metrik    | Belum dimulai                                                                      |
| 7 — AML/FIU Extension       | Contoh workflow opsional                   | Mock evidence, exception, human escalation                                                         | Fondasi bersama                      | Di luar ruang lingkup awal                                                         |
| 8 — Polish                  | Stabilitas demo seluruh platform           | Journey lengkap, reset lintas modul, presentasi                                                    | Modul yang diotorisasi telah selesai | Ditunda; reset lokal dan aksesibilitas Fase 0/1 tersedia sebagai kebutuhan fondasi |

## Deliverable Fase 0

- npm workspace `apps/web`; FastAPI/Pydantic/SQLAlchemy di `apps/api`.
- PostgreSQL sebagai sumber data aplikasi. Docker Compose disediakan; runner lokal PostgreSQL tersedia jika Docker tidak ada. SQLite hanya untuk pengujian terisolasi.
- Migrasi roles, users, documents, versions, chunks, dan saved questions. Original bytes/checksum disimpan bersama versi dokumen.
- Enam identitas sintetis; 12 dokumen dengan 14 versi. Seed berulang tidak menimpa data pengguna.
- Role switcher mock yang tersimpan sebagai ID di browser; role sebenarnya dipahami API melalui `X-User-Id`.
- Home, Ask SuperFlow, Knowledge Hub tersedia. Cases, Workflows, Decision Center, Analytics, Governance hanya placeholder navigasi.
- Reset CLI lokal yang eksplisit, dibatasi database PostgreSQL `superflow`/`superflow_test`, mengembalikan tabel Fase 0/1 secara atomik. Tidak ada endpoint reset produksi atau reset fitur fase berikutnya.

## Deliverable Fase 1

- Upload TXT/Markdown UTF-8, PDF berbasis teks, DOCX; heading/page/table diubah menjadi chunk terbatas.
- Metadata owner/domain/authority/access/relasi; versi file immutable; status active/outdated/draft; re-index dengan ID citation stabil.
- Constraint satu versi active, lock dokumen saat publikasi, supersede atomik, dan penolakan publikasi tanggal efektif di masa depan.
- Pemeriksaan akses dasar sebelum retrieval dan sebelum mengembalikan sumber/download/saved answer. Ini prasyarat keamanan Knowledge Core, bukan arsitektur Guard lengkap.
- `Retriever` dan `AnswerProvider` dapat diganti. Adapter awal deterministik berbasis keyword/concept, filter metadata, bobot authority, dan active-version selection. Historical retrieval harus dipilih; draft dikecualikan.
- Jawaban berupa kutipan extractive nyata; citation merujuk ID document/version/chunk sebenarnya.
- AnswerCard dan SourcePanel bertipe; hanya keduanya fungsional. Komponen fase berikutnya dan slot reliability dicadangkan tanpa output palsu.
- Refresh membuka kembali saved answer/filter dan detail versi melalui referensi URL; API memeriksa izin lagi. Sumber yang tidak tersedia menghasilkan error, bukan konten cache browser.

## Penyempurnaan UI

1. Baca konteks proyek dan audit implementasi sebelum perubahan.
2. Periksa komponen yang ada, cari kandidat melalui MCP 21st.dev, dan inspeksi source/dependencies sebelum adaptasi. Dokumentasikan provenance dan batas kuota di [UI_REFERENCES.md](docs/UI_REFERENCES.md).
3. Gunakan shell navy, token terpusat, hierarchy jelas, dan kepadatan enterprise.
4. Home berpusat pada Ask, sumber terbaru, dan riwayat; counts hanya pendukung.
5. Knowledge Hub memakai tabel; Ask memisahkan jawaban/evidence/metadata/tindakan membaca sumber.
6. Gunakan primitive header/badge/metadata/loading/error/empty/dialog; pertahankan API/editor/detail yang sudah berfungsi.
7. Perbaiki fokus, Escape, navigasi keyboard, responsive sheet, reload, dan race saat pergantian role.

Pass frontend terfokus telah menyempurnakan tujuh masalah komposisi: header, tinggi composer, area kosong, rail riwayat, kepadatan tabel, detail sheet, dan label dekoratif. Pola Origin UI Table serta InputBar diadaptasi; API dan backend dipertahankan. Hasil dan kandidat yang tidak diadopsi dicatat di [FRONTEND_REFINEMENT.md](docs/FRONTEND_REFINEMENT.md).

## Verifikasi

- Migrasi dan seed idempotent di PostgreSQL; lifecycle migrasi terisolasi; reset dan penolakan target tidak aman.
- Backend unit/API: non-leakage, versi, citation, filter, owner/access, saved-source re-authorization, parsing/upload, rollback kegagalan.
- Frontend unit: resolusi citation nyata, presentasi status versi yang persisten, format file dari metadata.
- Browser/E2E: role/catalog, Ask/current/history, no-sources, upload/edit/version/re-index, keyboard/dialog, refresh, mobile, API error, respons terlambat saat role berganti.
- Formatter, linter, TypeScript, build produksi, dan inspeksi aplikasi berjalan. Jalankan suite yang memakai database test yang sama secara berurutan.
- Catat hasil aktual serta batasan lingkungan di [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Pekerjaan yang ditunda

Guard, reliability decisions, conflict/evidence logic, audit append-only, workflow engine, Cases, Decision Center, regulation comparison/remediation, investasi/rumus keuangan, analytics, AML/FIU, autentikasi produksi, OCR, dan vector retrieval tidak diimplementasikan dalam pass ini.
