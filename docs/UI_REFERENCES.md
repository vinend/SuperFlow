# Referensi UI SuperFlow — Fase 0/1

## Akses 21st.dev

Pada pass rekonsiliasi 26 September 2026, tool MCP, skill, dan CLI 21st.dev tidak terkonfigurasi dalam sesi ini. Katalog publik 21st.dev dapat dibaca melalui web. Kandidat diperiksa setelah komponen repo, termasuk contoh kode, antarmuka props, dan dependensi yang tersedia pada halaman referensi.

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
- Dialog native menyediakan fokus modal, Escape, dan pemulihan fokus. Source Panel bersifat kontekstual di desktop dan menjadi sheet modal di mobile. Navigasi mobile memakai primitive yang sama.

## Komponen yang dipertahankan

Client API terpusat, SessionProvider, upload/editor, detail dokumen, Source Panel, endpoint REST, parsing, retrieval, provider extractive, dan model PostgreSQL tetap menjadi fondasi. Handler workspace dipindahkan dari komponen Console besar ke hook khusus. Editor/detail tetap memakai operasi backend yang sama.

`AnswerCardProps`, `SourcePanelProps`, dan daftar komponen workspace memiliki kontrak bertipe. Lima nama komponen fase berikutnya hanya dicadangkan dengan status `deferred` dan tanpa payload yang dapat dirender. Slot reliability pada AnswerCard tidak diisi. Tidak ada renderer HTML dari model atau sistem Generative UI dinamis dalam pass ini.

## Batasan

Pengujian keyboard/browser tidak menggantikan audit screen reader menyeluruh. Tidak ada autentikasi produksi, OCR, vector retrieval, reliability engine, atau fitur aksi fase berikutnya. Bahasa Inggris pada berkas sumber sintetis `data/seed/*.md` dipertahankan untuk konsistensi fixture retrieval; berkas tersebut adalah input dokumen demo, bukan panduan proyek.
