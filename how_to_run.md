# Cara Menjalankan SuperFlow

## macOS / Linux

Dependencies sudah dipasang pada mesin ini (`node_modules`, `.venv`, `.env` dengan `PYTHON`, Chromium untuk E2E). Untuk checkout baru ikuti setup macOS/Linux di [README.md](README.md).

```bash
cd /path/to/SuperFlow

# Terminal 1 — database (biarkan terbuka)
npm run db:local

# Terminal 2 — backend
npm run db:migrate
npm run db:seed
npm run dev:api

# Terminal 3 — frontend
npm run dev
```

Aplikasi: http://127.0.0.1:3000 · API docs: http://127.0.0.1:8000/docs. Hentikan dengan `Ctrl+C` di tiap terminal.

## Windows (PowerShell)

Buka PowerShell di folder project:

```powershell
cd C:\Life\Superthon\SuperFlow
```

Jika dependencies belum terpasang, ikuti bagian setup di [README.md](README.md).

## 1. Jalankan database

Terminal pertama:

```powershell
npm.cmd run db:local
```

Biarkan terminal terbuka. Lewati langkah ini jika PostgreSQL project sudah berjalan.

## 2. Jalankan backend

Terminal kedua, dari folder project:

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev:api
```

## 3. Jalankan frontend

Terminal ketiga, dari folder project:

```powershell
npm.cmd run dev
```

## 4. Buka aplikasi

- Aplikasi: http://127.0.0.1:3000
- Dokumentasi API: http://127.0.0.1:8000/docs

Untuk menghentikan program, tekan `Ctrl+C` di masing-masing terminal.
