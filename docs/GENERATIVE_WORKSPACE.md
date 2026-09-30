# Generative Workspace — CopilotKit V2 / AG-UI

## Tujuan

Ask SuperFlow menangkap kebutuhan pengguna lalu membuka pengalaman yang sesuai. Integrasi ini berada **setelah Fase 7 dan sebelum Fase 8**. CopilotKit adalah lapisan interaksi, bukan sumber kebenaran bisnis. Seluruh data demo sintetis.

## Arsitektur

```text
AskComposer (UI SuperFlow)
  → CopilotKitProvider V2 + useAgent (headless)
  → POST /api/copilotkit/agent/workspace/run (AG-UI)
  → SuperFlowWorkspaceAgent (adapter Next.js)
  → POST /api/workspace-intent (FastAPI)
  → klasifikasi deterministik / Ollama opsional + otorisasi
  → AG-UI STATE_SNAPSHOT
  → useFrontendTool: showSuperFlowWorkspace
  → GenerativeWorkspace (catalog bertipe)
  → komponen domain existing → FastAPI/PostgreSQL
```

Paket terkunci: `@copilotkit/react-core@1.75.2`, `@copilotkit/runtime@1.75.2`, `@ag-ui/client@0.0.59`, `@ag-ui/core@0.0.59`, `rxjs@7.8.1`. Versi AG-UI mengikuti dependency kompatibel CopilotKit. Provider berada pada route Ask dan di-key oleh identitas demo. Runtime Next.js berada di `apps/web/app/api/copilotkit/[[...slug]]/route.ts`; agent AG-UI di `apps/web/lib/workspace-agent.ts`; klasifikasi FastAPI di `apps/api/superflow/workspace_intent.py`.

## Kontrak intent dan katalog UI

Tujuh intent yang diizinkan: `knowledge_answer`, `regulatory_review`, `investment_analysis`, `investigation_review`, `impact`, `my_work`, `reviews`. View terbatas per intent; investigasi hanya menerima ID UUID dan referensi `AML-YYYY-NNN` yang diotorisasi. Payload lain ditolak oleh Pydantic dan Zod. Agent mengirim identifier dan intent, tidak mengirim angka keuangan, status Guard, status evidence, judul rahasia, route bebas, HTML, atau JavaScript.

`GenerativeWorkspace` merender `AnswerCard`, `RegulatoryReview`, `InvestmentAnalysis`, `InvestigationConsole`, `ControlledImpactWorkspace`, atau `ActionLists` yang sudah tersedia. Unknown intent, view, atau komponen gagal aman. Hanya satu tool frontend, `showSuperFlowWorkspace`, yang memanggil katalog ini. Tidak ada tool untuk approve, submit, override, atau mutation lain.

## Otorisasi dan keputusan manusia

FastAPI memeriksa identitas pada setiap klasifikasi; referensi alert diperiksa terhadap `Case` yang dapat diakses. Semua data workspace diminta ulang lewat API domain existing, sehingga pemeriksaan permission berlaku lagi. Penolakan hanya berisi pesan umum. Perubahan role membuat provider, agent thread, serta workspace terpilih di-mount ulang.

Knowledge tetap memakai retrieval, citation, Source Panel, dan SuperFlow Guard. Regulatory Review memakai perbandingan/keputusan Fase 4. Investment Analysis memakai asumsi sumber dan rumus Python deterministik Fase 5. Impact tetap memakai `ImpactComposer` Fase 6. Investigation Review tetap memakai agent evidence berbatas Fase 7. My Work dan Reviews memakai agregasi backend yang sudah ada. Persetujuan dan keputusan material hanya dapat dilakukan melalui kontrol UI domain dengan otorisasi, revision, idempotency, dan audit existing.

## Mode dan kegagalan

- **Deterministik (default):** pola intent yang eksplisit memilih workspace tanpa model. Prompt Knowledge tetap masuk ke Ask source-grounded.
- **Ollama (`LLM_PROVIDER=ollama`):** Qwen dapat mengusulkan intent/view melalui structured JSON. Kata kunci domain terlindungi tetap diprioritaskan oleh router deterministik; output malformed, intent/view tak dikenal, atau nilai tambahan ditolak. FastAPI tetap memeriksa role/ID.
- **AG-UI gagal:** Ask memanggil endpoint intent FastAPI langsung. Jika API juga gagal, tampil pesan aman dan navigasi domain langsung tetap berfungsi. State bisnis tidak disimpan dalam thread AG-UI.

Runtime mendukung `SUPERFLOW_API_URL` untuk koneksi server Next.js → FastAPI dan memakai `NEXT_PUBLIC_API_URL` jika tidak disetel. Aplikasi mematikan inspector serta telemetry CopilotKit untuk demo.

## Prompt demo

| Role | Prompt | Hasil |
| --- | --- | --- |
| Employee | How many annual leave days do I get? | Jawaban Knowledge, citation, Guard, Source Panel |
| Compliance | What changed in the latest regulation? | Regulatory Review dan perbandingan sumber |
| Compliance | Show me what needs remediation. | Regulatory Review dengan konteks remediation |
| Finance | Analyze proposal A. | Investment Analysis dan asumsi sumber |
| Finance | What assumptions are in proposal A? | Investment Analysis, asumsi |
| Compliance | Investigate alert AML-2026-001. | Investigation Review persisten |
| Compliance | Show me the evidence for AML-2026-003. | Tab evidence Investigation Review |
| Manager | Where does reliability need attention? | Impact Quality |
| Manager | How much capacity could be released? | Impact Capacity |
| Manager | What is slowing delivery? | Impact Delivery |
| Employee | What do I need to do? | My Work |
| Manager | What needs my approval? | Reviews / Approvals |

Finance yang meminta investigasi dan Employee yang meminta Impact hanya melihat pesan penolakan tanpa data domain. Permintaan seperti “Approve this investment” membuka Reviews saja; keputusan tidak dieksekusi oleh agent.

## Pengujian dan bukti visual

Jalankan `npm.cmd run test:api`, `npm.cmd run test:web`, `npm.cmd run test:e2e`, `npm.cmd run lint`, `npm.cmd run typecheck`, dan `npm.cmd run build` dari root repo. Uji browser Generative Workspace berada di `tests/generative-workspace.spec.ts`. PNG hasil Playwright berada di `artifacts/screenshots/generative-workspace/`.

## Batasan

Klasifikasi deterministik memakai pola kata untuk prompt demo berbahasa Inggris. Proposal yang dibuka otomatis dari Ask baru Proposal A; proposal lain dapat dipilih melalui halaman Investment Analysis. Thread CopilotKit berada di memori dan memakai mock role switcher, sehingga belum cocok untuk autentikasi/percakapan produksi. Tidak ada sumber pelanggan nyata atau model yang dapat menciptakan tools baru.
