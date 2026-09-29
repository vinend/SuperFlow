# Inference AI Lokal melalui Docker

SuperFlow dapat memakai Ollama di Docker sebagai provider inference lokal untuk **Ask SuperFlow**. Konfigurasi default tetap deterministik agar aplikasi tetap dapat didemokan tanpa model. Provider Ollama hanya aktif jika `LLM_PROVIDER=ollama`.

## Arsitektur

```text
Pengguna
  → permission filter backend
  → retrieval sumber yang diizinkan
  → Ollama/Qwen di Docker
  → structured output Pydantic
  → validasi citation ID
  → SuperFlow Guard
  → AnswerCard dan evidence
```

Model tidak menerima sumber yang ditolak permission. Model juga tidak menentukan permission, status versi, reliability final, kalkulasi keuangan, workflow transition, atau approval authority.

Jawaban hasil model selalu `REVIEW_REQUIRED` karena validasi saat ini dapat membuktikan bahwa setiap paragraf menunjuk citation yang diizinkan, tetapi belum membuktikan semantic entailment setiap klaim. Citation yang hilang/tidak dikenal membuat hasil `BLOCKED`.

## Prasyarat Windows

- Docker Desktop memakai backend WSL 2.
- Driver NVIDIA dan kernel WSL terbaru.
- Port host `11434` tersedia, atau pilih port loopback lain melalui `OLLAMA_PORT`.
- Ruang disk sekitar 11 GB untuk image Ollama dan model default `qwen3.5:9b`.

Compose memakai satu GPU NVIDIA, menyimpan model dalam volume `superflow_ollama`, dan hanya memublikasikan API ke loopback host. Default-nya `127.0.0.1:11434`.

Jika port tersebut sudah dipakai runtime Ollama lain, gunakan port alternatif yang sama pada Compose dan FastAPI, misalnya:

```env
OLLAMA_PORT=11435
OLLAMA_BASE_URL=http://127.0.0.1:11435
```

## Menjalankan runtime dan mengambil model

```powershell
npm.cmd run ai:up
npm.cmd run ai:pull
```

`ai:pull` mengambil model pada `OLLAMA_MODEL`; default-nya `qwen3.5:9b`. Model tetap tersimpan setelah container dihentikan.

Periksa runtime dari Windows:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

Uji inference langsung:

```powershell
$body = @{
  model = "qwen3.5:9b"
  messages = @(@{ role = "user"; content = "Answer in one sentence: what is SuperFlow?" })
  stream = $false
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:11434/api/chat `
  -ContentType application/json `
  -Body $body
```

## Mengaktifkan untuk SuperFlow

Salin `.env.example` menjadi `.env`, lalu ubah:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:9b
OLLAMA_NUM_CTX=8192
OLLAMA_NUM_PREDICT=512
OLLAMA_TEMPERATURE=0.1
OLLAMA_TIMEOUT_SECONDS=120
```

Restart API setelah mengubah provider. `GET /api/health` menampilkan `inference_provider` dan `inference_model` aktif.

Jika FastAPI kelak dijalankan di Compose yang sama, gunakan `OLLAMA_BASE_URL=http://ollama:11434`. URL `127.0.0.1` digunakan ketika FastAPI berjalan langsung di Windows.

## Operasi

```powershell
npm.cmd run ai:logs
npm.cmd run ai:down
```

`ai:down` menghentikan runtime tetapi tidak menghapus volume model. Jangan memakai `docker compose down --volumes` jika model masih ingin dipertahankan.

## Fail-safe

- Runtime/model tidak tersedia atau structured output invalid → API Ask mengembalikan 503 dan tidak menyimpan jawaban setengah jadi.
- Thinking model dinonaktifkan untuk respons aplikasi dan output dibatasi 512 token agar structured response berhenti secara terukur.
- Citation di luar context authorized → response ditolak.
- Tidak ada evidence → model tidak dipanggil.
- Model output tidak dapat melakukan action atau mengubah state workflow.
- Provider deterministik tetap tersedia dengan `LLM_PROVIDER=deterministic`.

## Scope saat ini

Inference nyata dipakai untuk sintesis jawaban Ask. Retrieval masih keyword/concept deterministik. ImpactComposer, regulatory analyzer, dan investment assumption extractor tetap deterministik; integrasi model untuk modul tersebut harus memakai structured contract dan human authority yang sama.
