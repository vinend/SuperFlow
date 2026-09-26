# Penyempurnaan Frontend SuperFlow

## Ruang lingkup

Pass 26 September 2026 hanya memperbaiki presentasi dan komposisi Fase 0/1. Model, endpoint, retrieval, akses role, seed, dan persistence backend dipertahankan. Tidak ada fitur produk baru atau implementasi Fase 2.

## Temuan sebelum perubahan

Inspeksi aplikasi produksi dilakukan pada Home, Ask, Knowledge Hub, detail dokumen, serta viewport 375–1440 px. Screenshot awal disimpan lokal di `.runtime/screenshots/refinement-before`.

1. Greeting Home mengambil hierarki utama yang lebih tepat digunakan untuk konteks pekerjaan.
2. Composer Ask menumpuk input, filter, checkbox, dan footer sehingga terlalu tinggi sebelum ada hasil.
3. Placeholder jawaban mengulang instruksi dan meninggalkan ruang kosong besar.
4. Riwayat panjang di kanan menentukan tinggi seluruh halaman; panel tetap memakai ruang ketika tidak ada riwayat.
5. Row repository terlalu tinggi, sementara metadata dan header terlalu kecil; status versi menambah satu baris.
6. Header detail dokumen menyisakan ruang kosong, dan versi/akses banyak memakai container berulang.
7. Label uppercase dan ikon dekoratif berulang bersaing dengan informasi utama.

## Referensi dan keputusan

MCP 21st.dev dipakai langsung melalui protokol HTTP untuk `search` dan `get_component`. Tidak ada CLI installer atau theme generator yang dijalankan.

| Kandidat                                                                                | Pemeriksaan                                                                                                                                                                                                                           | Keputusan                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Origin UI — Table with filters, demo 98                                                 | Source primitive dan demo via MCP. Primitive React; demo memakai TanStack, Lucide, checkbox/input/label/select shadcn dan `cn`.                                                                                                       | Adaptasi tabel semantik, filter di atas tabel, header tenang, dan row padat. State filter/sort existing tetap dipakai; TanStack dan paket shadcn baru tidak diperlukan.                               |
| Basic Data Table — Preet Suthar, demo 2750                                              | Source dan demo via MCP. React/Lucide/`cn`; menggunakan `any`, index sebagai key, sort melalui klik header, dan state filter/pagination internal.                                                                                     | Tidak diadopsi. Duplikasi state, akses keyboard header, radius besar, dan pagination di luar scope memerlukan perubahan lebih banyak.                                                                 |
| Records Table — Shane Levine, demo 23604                                                | Metadata dan preview ditinjau. Permintaan source MCP mengembalikan `retrieval_limit_reached` setelah dua retrieval gratis.                                                                                                            | Tidak diadopsi; source/dependencies belum dapat diperiksa. Tag CRM, connection indicator, dan calculations footer tidak diperlukan.                                                                   |
| Command Search; AI Prompt Input; Prompt Composer; Forge AI Command Bar                  | Metadata hasil pencarian MCP.                                                                                                                                                                                                         | Tidak diadopsi: animasi query, model picker, attachments, atau glassmorphism tidak diperlukan. Source belum diambil karena kuota.                                                                     |
| InputBar — Agent Elements                                                               | Source publik resmi `21st-dev/agent-elements/lib/agent-ui/components/input-bar.tsx` diperiksa. Controlled input, resize maksimal, keyboard, dan toolbar; dependensi penuh mencakup AI types, Tabler dan komponen attachment/question. | Adaptasi prinsip input ringkas dan resize; QuestionComposer existing tetap dipakai tanpa dependencies tambahan atau alur chat.                                                                        |
| Sheet with Scrollable Content; Sheet (Different Directions); Information Drawer; Drawer | Metadata beberapa kandidat diperiksa melalui MCP.                                                                                                                                                                                     | Native Dialog/SourcePanel existing dipertahankan. Source kandidat tidak diambil karena kuota habis; tidak memasang Radix/GSAP/drag-to-dismiss. Detail diperbaiki sebagai komposisi komponen existing. |

Seluruh adaptasi memakai token SuperFlow di `globals.css`. Tidak ada sistem warna atau library komponen kedua.

Tautan kandidat: [Origin UI Table](https://21st.dev/@originui/components/table), [Basic Data Table](https://21st.dev/@preetsuthar17/components/basic-data-table), [Records Table](https://21st.dev/@theshanelevine/components/records-table), [Input Bar](https://21st.dev/@serafimcloud/components/input-bar), [source resmi InputBar](https://github.com/21st-dev/agent-elements/blob/main/lib/agent-ui/components/input-bar.tsx), dan [Sheet with Scrollable Content](https://21st.dev/@shadcnspace/components/sheet-02).

## Perubahan yang diterapkan

- Home memakai header pekerjaan, Ask sebagai entry point, source updates, konteks role yang ringkas, dan riwayat personal. Counts bukan KPI utama.
- QuestionComposer tetap terkontrol: minimum desktop 52 px untuk textarea, maksimum 140 px; form terukur 105 px. Scope domain/source/historical berada di bawah form, dengan keyboard Enter/Shift+Enter tetap berfungsi.
- Rail Ask tidak dirender ketika riwayat kosong. Riwayat panjang menggulir dalam area terbatas; tidak menentukan tinggi seluruh workspace.
- DataTable menormalisasi wrapper semantik/gulir lokal; DocumentTable mempertahankan metadata, callback open, dan filter/sort existing. Row title lebih jelas, ikon tanpa kotak dekoratif, serta versi/status satu baris. Tinggi row desktop terukur 59,5 px.
- AnswerCard tetap memisahkan jawaban, evidence, metadata, dan next action. Slot reliability kosong; tidak ada label Verified atau Guard palsu.
- SourcePanel lebih ringkas, tanpa ikon file besar/domain pill. DocumentDetail memakai native Dialog existing sebagai sheet kanan, dengan identitas, source content, versi historis, metadata, akses, dan relasi yang terpisah.
- Label uppercase, pill status/akses berulang, dan copy implementation-detail di repository/footer jawaban dikurangi.

## Komponen yang dipertahankan

ApplicationShell, SessionProvider, hook workspace, API client, QuestionComposer, AnswerCard, SourcePanel, DocumentDetail, DocumentEditor, Dialog, serta primitive header/metadata/loading/error/empty tetap menjadi dasar. Perubahan presentation tidak memindahkan state bisnis ke frontend atau menambahkan payload model/HTML.

## Verifikasi

| Pemeriksaan       | Hasil pass frontend                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Formatter         | Prettier write/check lulus                                                                                                         |
| Lint / TypeScript | Lulus                                                                                                                              |
| Frontend unit     | 3 lulus                                                                                                                            |
| E2E Chromium      | 9 lulus; delapan journey existing dan satu pemeriksaan komposisi/filter/detail baru                                                |
| Production build  | Lulus; frontend pada port 3000, API existing pada 8000, PostgreSQL pada 5432                                                       |
| Inspeksi produksi | Home, Ask kosong/berjawaban/citation, Knowledge Hub, detail active/historical, reload, dan role switch; nol browser runtime errors |
| Responsive        | Lebar dokumen tidak melebihi viewport 375, 390, 768, 1024, 1280, atau 1440 px                                                      |
| Contrast token    | Enam pasangan teks/surface, termasuk status semantik, memiliki rasio 5,14–13,25; seluruhnya di atas 4,5                            |

Screenshot sebelum/sesudah disimpan di `.runtime/screenshots/refinement-before` dan `refinement-after`; tidak dimasukkan ke Git. Backend unit tests tidak diulang karena tidak ada perubahan backend. E2E tetap menggunakan PostgreSQL test terisolasi dan API nyata.

## Batasan yang tetap dipertahankan

Mock role/auth, provider extractive, retrieval, citations, metadata/versi, persistence URL dan PostgreSQL tetap memakai implementasi yang sama. Tidak ada Guard, workflow, Cases, keputusan, analytics, regulasi/investasi, atau modul Fase 2+. Tidak ada fitur selection/bulk action/pagination baru dari demo vendor. Review keyboard/browser tidak menggantikan audit screen reader menyeluruh.
