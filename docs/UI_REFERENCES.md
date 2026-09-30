# Referensi UI SuperFlow — Fase 0/1

## Akses 21st.dev

Pada pass rekonsiliasi 26 September 2026, tool MCP, skill, dan CLI 21st.dev tidak terkonfigurasi dalam sesi ini. Katalog publik 21st.dev dapat dibaca melalui web. Kandidat diperiksa setelah komponen repo, termasuk contoh kode, antarmuka props, dan dependensi yang tersedia pada halaman referensi.

Pada pass frontend berikutnya di tanggal yang sama, **MCP 21st.dev berhasil diakses melalui HTTP**. Pencarian tabel, composer, InputBar, dan sheet dilakukan; source Origin UI Table dan Basic Data Table diambil sebelum perubahan. Kuota gratis dua retrieval habis setelah pemeriksaan tersebut; source Records Table terkunci dan tidak diadopsi. InputBar diperiksa melalui source publik resmi penulis. Rincian keputusan dan hasil tersedia di [FRONTEND_REFINEMENT.md](FRONTEND_REFINEMENT.md).

Adopsi dilakukan pada **pola komposisi**, dengan implementasi TypeScript di repo dan token SuperFlow. Tidak ada instalasi otomatis atau klaim bahwa paket komponen vendor telah diimpor.

| Referensi yang diperiksa                                                         | Pola yang diadaptasi                                                                            | Implementasi SuperFlow                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Appshell — Moumen Soliman](https://21st.dev/@moumensoliman/components/appshell) | Pemisahan sidebar, header, breadcrumb, dan area kerja; komposisi children.                      | `components/application-shell.tsx`; navigasi tersedia dipisahkan dari modul fase berikutnya.    |
| [InputBar — Agent Elements](https://agent-elements.21st.dev/docs/input-bar)      | Input terkontrol, toolbar konteks, textarea menyesuaikan tinggi, dan pengiriman lewat keyboard. | `components/question-composer.tsx`; filter sumber/domain memakai kontrak API yang sudah ada.    |
| [Table — shadcn/ui](https://21st.dev/@shadcn/components/table)                   | Tabel semantik dengan header/caption dan wadah gulir lokal.                                     | `components/document-table.tsx`; metadata, versi, owner, authority, dan akses berasal dari API. |
| [Sheet — shadcn/ui](https://21st.dev/@shadcn/components/sheet)                   | Panel konteks dengan header, isi, dan tindakan; tetap terpisah dari hasil utama.                | `components/source-panel.tsx`; nonmodal di desktop lebar dan dialog modal di layar sempit.      |

Kandidat [AI Input With Search — Kokonut UI](https://21st.dev/@kokonutd/components/ai-input-with-search) juga diperiksa. Toggle web search, attachment, dan animasi Framer Motion tidak dibutuhkan oleh Ask pada Fase 1; tidak diadopsi. Kandidat tabel Origin UI tidak dapat dimuat melalui akses web saat pemeriksaan.

Komposisi Appshell yang dipublikasikan merujuk primitive sidebar/breadcrumb lain. InputBar lengkap memakai paket AI, ikon Tabler, attachment, dan interaksi tambahan. SuperFlow memakai React, Lucide, CSS, dan elemen HTML `dialog` yang sudah tersedia; tidak menambah paket yang tumpang tindih.

## Sistem visual

- Navigasi navy, workspace terang, aksen hijau/lime terbatas.
- Token warna, spacing, typography, radius, shadow, dan z-index dipusatkan di `apps/web/app/globals.css`.
- Home mengutamakan pertanyaan, sumber terkini menurut waktu versi disimpan, dan riwayat personal. Tidak ada KPI penghematan atau aktivitas yang dibuat-buat.
- Ask memisahkan jawaban, evidence, metadata, dan tindakan membaca sumber. `Source-grounded` adalah hasil retrieval, bukan keputusan Guard.
- Knowledge Hub memakai tabel, filter domain/status, pencarian judul, dan pengurutan lokal atas katalog yang sudah difilter backend.
- Primitive `DataTable` mengadaptasi wrapper tabel semantik Origin UI; DocumentTable tetap memetakan data API dan callback existing. Row dibuat padat; versi/status satu baris, ikon dokumen sederhana, warna status hanya untuk state versi. Tidak memasang TanStack atau primitive vendor tambahan.
- Composer terkontrol dibuat ringkas, scope retrieval dipisahkan dari form, dan rail riwayat tidak dirender ketika kosong. Detail dokumen memakai Dialog existing sebagai sheet kanan dengan header ringkas, section konten, dan versi/akses yang tidak dibungkus card berulang.
- Dialog native menyediakan fokus modal, Escape, dan pemulihan fokus. Source Panel bersifat kontekstual di desktop dan menjadi sheet modal di mobile. Navigasi mobile memakai primitive yang sama.

## Komponen yang dipertahankan

Client API terpusat, SessionProvider, upload/editor, detail dokumen, Source Panel, endpoint REST, parsing, retrieval, provider extractive, dan model PostgreSQL tetap menjadi fondasi. Handler workspace dipindahkan dari komponen Console besar ke hook khusus. Editor/detail tetap memakai operasi backend yang sama.

`AnswerCardProps`, `SourcePanelProps`, dan daftar komponen workspace memiliki kontrak bertipe. Lima nama komponen fase berikutnya hanya dicadangkan dengan status `deferred` dan tanpa payload yang dapat dirender. Slot reliability pada AnswerCard tidak diisi. Tidak ada renderer HTML dari model atau sistem Generative UI dinamis dalam pass ini.

## Batasan

Pengujian keyboard/browser tidak menggantikan audit screen reader menyeluruh. Tidak ada autentikasi produksi, OCR, vector retrieval, reliability engine, atau fitur aksi fase berikutnya. Bahasa Inggris pada berkas sumber sintetis `data/seed/*.md` dipertahankan untuk konsistensi fixture retrieval; berkas tersebut adalah input dokumen demo, bukan panduan proyek.

## Fase 2 — reliability dan evidence

MCP `search` dipakai untuk status/alert/checklist/accordion. Kandidat ditinjau melalui metadata/preview: [Notice Alert — corr](https://21st.dev/@corr/components/notice-alert), [Alert — serafimcloud](https://21st.dev/@serafimcloud/components/alert), Alert with Icon and Actions (cnippet-dev), Accordion Active Background (uiable), dan Basic Accordion (felipemenezes098). Dialog konfirmasi/destructive, warna banner besar, animasi dan dependency baru tidak cocok untuk reliability ringkas.

Permintaan `get_component` Notice Alert (19366) mengembalikan `retrieval_limit_reached` dengan reset 27 September UTC. Source/dependencies kandidat Fase 2 belum dapat diperiksa; tidak ada vendor code atau package yang diadopsi. EvidenceChecklist memakai primitive/token SuperFlow dan disclosure `<details>/<summary>` native yang sudah menjadi pola proyek. SourcePanel/Dialog existing tetap dipakai; tidak ada desain kedua atau logic Guard dari 21st.dev.

## Fase 3 — Workflow Core (26 September 2026)

MCP 21st.dev aktif: search activity timeline dan approval/task list. Kandidat yang ditinjau dari metadata:

- Activity Timeline — 7ovr, ID 28340: actor/action/time dalam rail vertikal; cocok untuk histori, metadata tidak menjadi implementation source.
- Timeline — Cubby UI, ID 28295: composable dated events/controlled step progression, kandidat paling sesuai timeline padat.
- Experience Timeline — shadcnui-blocks, ID 28329/28334: layout vertikal tetapi konten career/technology kurang sesuai Case.
- Agent Todo List — starc007, ID 28423; AI Task List — educalvolpz, ID 23793; Sprint Task Checklist — Cnippet ID 24947: metadata state/task berguna, animasi/count/reset demo tidak dibutuhkan.

`get_component(28295)` dicoba: source terkunci `retrieval_limit_reached`, dua retrieval per hari, reset 27 September 2026 00:00 UTC. Karena source/dependency tidak dapat diperiksa, tidak ada vendor baru diadopsi/diinstall. Tidak melewati kuota.

UI menggunakan primitive existing: tabel Origin UI yang sebelumnya sudah diperiksa, Dialog/SourcePanel, metadata, status badge, native details/summary dan tokens. WorkflowTimeline dibuat dengan semantic ordered list/current step/attempt disclosure; ApprovalPanel menggunakan EvidenceChecklist/source references sebelum form keputusan. Tidak ada design system kedua atau dependency baru.

## Rekonsiliasi Product Experience — PRD v2

Inspeksi existing dilakukan pada ApplicationShell, ActionLists/DataTable, ApprovalPanel, WorkflowTimeline, SourcePanel/Dialog dan token navy/lime sebelum pencarian MCP.

Pencarian MCP resmi `search`: `task inbox review queue work item list`, `compact activity progress timeline`.

| Kandidat                        | ID / sumber                                               | Penilaian                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity Timeline               | 28340, 7ovr, https://21st.dev/@7ovr/components/timeline-3 | Actor/action/time cocok untuk Activity; `get_component` terkunci `retrieval_limit_reached`, reset 27 September 00:00 UTC. Source/dependency tidak tersedia untuk inspeksi. |
| Process Timeline                | 28381, shadcnui-blocks                                    | Progress sequential/check cocok sebagai referensi metadata; source belum diambil, tidak diadopsi.                                                                          |
| Agent Todo List                 | 28423, starc007                                           | Checklist relevan, tetapi animasi/task count tidak diperlukan; tidak diadopsi.                                                                                             |
| Task Board Kanban               | 29227, 7ovr                                               | Drag-and-drop dapat menyesatkan transition authority; tidak dipilih.                                                                                                       |
| Notification Panel              | 27135, uvain                                              | Grouping inbox relevan; notification/read-state baru di luar scope. Tidak diadopsi.                                                                                        |
| Agent Activity / Agent Progress | 29318 / 29323, starc007                                   | Mengekspos tool/reasoning atau timer; kurang cocok bagi pengguna pekerjaan biasa.                                                                                          |

Tidak ada source vendor baru dipasang atau dependency ditambahkan. Origin UI DataTable existing yang sebelumnya diperiksa, semantic ordered timeline, native disclosure, metadata/badge/empty/error/loading, serta Dialog/SourcePanel dipertahankan. WorkItemRows dan HomeAttention mengadaptasi komponen existing untuk data backend actual; API/Guard/transitions tidak diambil dari referensi UI.

## Pass Generative Workspace (1 Oktober 2026)

MCP 21st.dev `search` dipakai untuk pola “enterprise command workspace split panel search”. Kandidat metadata: [Workspaces — efferd](https://21st.dev/@efferd/components/workspaces) (popover multi-tenant), [Command Menu with Global Search — ephraimduncan](https://21st.dev/@ephraimduncan/components/command-menu-04) (dialog pencarian lintas tipe), [Command Search — arihantcodes](https://21st.dev/@arihantcodes/components/command-search) (hasil grup dengan animasi), dan [Command — Origin UI](https://21st.dev/@originui/components/command) (command palette). Pola tersebut berpusat pada overlay pencarian/tenant switching, sedangkan Ask SuperFlow memerlukan rail intent yang selalu tampak dan workspace domain existing sebagai hasil utama. Tidak ada komponen 21st.dev yang diadopsi, source vendor yang diinstal, atau design system kedua. `QuestionComposer`, shell, token, `AnswerCard`, `SourcePanel`, dan komponen domain existing dipertahankan.
