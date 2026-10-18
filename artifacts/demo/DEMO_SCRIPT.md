# Naskah Presenter SuperFlow

Video nyata: `artifacts/demo/superflow-demo.webm` (1440×900, 4:03 menit). Tampilan berasal dari aplikasi lokal dengan PostgreSQL, Qwen, OCR, Chromium dan CopilotKit aktif. Rekaman mendahului penyederhanaan navigasi; pada build terkini, presenter membuka `/impact` langsung karena tidak ada menu INSIGHTS. Panduan operator lengkap ada di `docs/DEMO_PLAYBOOK.md`. Waktu setiap adegan adalah perkiraan.

| Waktu | Aksi pengguna | Yang muncul di layar | Kemampuan | Narasi satu kalimat |
| --- | --- | --- | --- | --- |
| 0:00–0:18 | Buka Home → Ask | Ruang kerja Employee | Produk berorientasi pekerjaan | “SuperFlow dimulai dari kebutuhan pengguna: memahami dan menindaklanjuti.” |
| 0:18–0:42 | Tanyakan hak cuti, buka citation | Jawaban Qwen, Annual Leave Policy v2.0, reliabilitas | RAG lokal dan bukti internal | “Jawaban merujuk langsung pada kebijakan yang dapat diperiksa.” |
| 0:42–1:08 | Tanyakan POJK 21/2023 | Pasal 9 halaman 5 dan kartu sumber OJK | Corpus resmi, asal bukti | “Sumber regulator terlihat terpisah dari sintesis AI dan memerlukan review.” |
| 1:08–1:23 | Tanyakan perubahan regulasi | Perbandingan yang dipilih runtime | CopilotKit Generative UI | “Tampilan menyesuaikan maksud pengguna dalam katalog komponen yang dikontrol.” |
| 1:23–1:48 | Unggah gambar scan; tanyakan tenggat kuitansi | OCR terindeks, jawaban dan kutipan scan | Pemahaman dokumen hasil pindai | “Bahkan teks pada gambar dapat dicari, dengan asal OCR yang jelas.” |
| 1:48–2:20 | Tangkap `example.com`, lihat vision, simpan draft, aktifkan | Screenshot, observasi visual, status sumber | Website capture, Qwen vision, governance | “Sumber web ditinjau dahulu sebelum menjadi pengetahuan yang dapat dikutip.” |
| 2:20–2:48 | WebSearch URL terpilih | Progres hidup, jawaban dan label Internet | Public grounding, aktivitas Ask | “Bukti Internet untuk pertanyaan ini tetap terpisah dari koleksi internal.” |
| 2:48–3:08 | Coba Google dan pertanyaan tanpa bukti | HTTP 429; lalu `BLOCKED` | Kegagalan transparan, Guard | “Ketika sumber tak tersedia, SuperFlow tidak mengarangnya.” |
| 3:08–3:45 | Buka My Work, Regulatory Review, Investment, Reviews | Progres, gap, perhitungan, review manusia | Tindakan terkontrol | “Pengetahuan berlanjut ke remediasi dan keputusan manusia yang terlacak.” |
| 3:45–4:03 | Buka Knowledge dan Impact | Referensi publik dan `Illustrative simulation` | Pengukuran lintas fungsi | “Akhirnya dampak terlihat, dengan simulasi diberi label apa adanya.” |

**Penutup:** “SuperFlow mengambil bukti, menunjukkan asalnya, menyajikannya sesuai konteks, dan berhenti saat kepastian belum cukup.”

Catatan: Google discovery yang terkena HTTP 429 ditampilkan sebagai kegagalan nyata. Qwen kecil, OCR, pengamatan visual dan kutipan OJK tetap perlu peninjauan manusia. **Viewing as** adalah identitas sintetis untuk prototype.
