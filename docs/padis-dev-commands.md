# PADIS Developer Debug Runbook

Dokumen ini adalah runbook command untuk developer dan operator teknis PADIS. Entry point utama untuk user baru tetap `README.md`; file ini dipakai saat perlu debug, cek readiness, menjalankan command teknis, atau menelusuri masalah lokal.

Workflow lokal resmi untuk Windows adalah `.\padis.ps1` dari root project. Command manual seperti `python -m backend.run` dan `npm run dev` tetap berguna, tetapi hanya sebagai debug manual ketika backend atau frontend perlu dijalankan terpisah.

---

## 1. PADIS CLI Resmi

Jalankan semua command dari root project:

```powershell
cd "D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS"
```

Default resmi repo untuk local development di Windows:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

Makna command utama:

- `.\padis.ps1 check` = readiness check dasar project.
- `.\padis.ps1 start` = menjalankan backend + frontend lokal dan membuka Admin UI.
- `.\padis.ps1 run` = menjalankan pipeline dari terminal.

Setelah `start` berhasil, Admin UI akan dibuka otomatis di:

```text
http://localhost:3000/admin
```

`start` bukan command untuk menjalankan pipeline. Pipeline harian sebaiknya dijalankan dari Admin UI setelah backend dan frontend aktif.

---

## 2. Optional PowerShell Alias

Jika ingin memakai command pendek `padis`, pasang alias lokal satu kali:

```powershell
.\install-padis-command.ps1
```

Restart PowerShell, lalu jalankan:

```powershell
padis check
padis start
```

`padis` adalah alias opsional di PowerShell profile komputer user tersebut. Alias ini bukan command bawaan setelah clone repo, bukan installer global, dan tidak otomatis berlaku untuk semua clone atau semua komputer.

Contoh pipeline via alias:

```powershell
padis run --mode full --hazard flood --operator nama_operator
```

---

## 3. Command PADIS yang Sering Dipakai

Shortcut lokal Windows PowerShell:

```powershell
.\padis.ps1 check
.\padis.ps1 start
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
```

Optional alias setelah `.\install-padis-command.ps1` dan restart PowerShell:

```powershell
padis check
padis start
padis run --mode full --hazard flood --operator nama_operator
```

Command tambahan untuk setup atau mode teknis:

```powershell
.\padis.ps1 install
.\padis.ps1 start --no-open
.\padis.ps1 start --backend-only --no-open
.\padis.ps1 start --frontend-only
```

Catatan:

- `npm` harus tersedia di `PATH` agar frontend bisa dijalankan oleh `start`.
- Gunakan `CTRL + C` untuk menghentikan dev server yang dijalankan oleh `start`.
- Jika proses backend/frontend masih hidup setelah `CTRL + C`, tutup terminal atau hentikan proses secara manual.
- Mode `full + multi` perlu hati-hati karena memakai output flood/drought yang sudah ada.

---

## 4. Command Internal CLI

Command internal ini adalah detail implementasi/debug. Untuk workflow normal, gunakan `.\padis.ps1`.

```powershell
python -m backend.scripts.cli.padis check
python -m backend.scripts.cli.padis start
python -m backend.scripts.cli.padis run --mode full --hazard flood --operator nama_operator
```

`.\padis.ps1` meneruskan argumen ke command internal tersebut dan memakai Python venv project jika tersedia.

---

## 5. Graphify Workflow

Project memakai graph terpisah untuk backend dan frontend.

Update graph setelah perubahan kode backend:

```powershell
graphify update backend
```

Update graph setelah perubahan kode frontend:

```powershell
graphify update frontend
```

Lokasi output resmi:

```text
backend/graphify-out/
frontend/graphify-out/
```

Catatan penting:

- Jangan gunakan root-level `graphify-out/` sebagai sumber kebenaran jika masih ada.
- Untuk dokumentasi Markdown, baca file Markdown langsung.
- Jangan menjalankan Graphify docs extraction tanpa LLM API key karena proses semantic extraction membutuhkan API key.
- Graphify update code path tidak membutuhkan API key untuk rebuild struktur kode.

---

## 6. Debug Manual Backend

Gunakan ini hanya jika ingin menjalankan backend terpisah dari PADIS launcher.

Aktifkan virtual environment backend:

```powershell
.\backend\venv\Scripts\Activate.ps1
```

Jalankan backend:

```powershell
python -m backend.run
```

Jika berhasil, backend berjalan di:

```text
http://127.0.0.1:5000
```

atau pada alamat lokal jaringan, misalnya:

```text
http://192.168.x.x:5000
```

Untuk menghentikan backend:

```powershell
CTRL + C
```

### Debug Log Backend

Gunakan `LOG_LEVEL=DEBUG` jika ingin melihat detail backend seperti parameter layer, tile, cache, atau proses internal.

```powershell
$env:LOG_LEVEL="DEBUG"
python -m backend.run
```

Reset setelah selesai:

```powershell
Remove-Item Env:LOG_LEVEL
```

### Menampilkan Daftar Routes Backend

```powershell
$env:SHOW_ROUTES="1"
$env:LOG_LEVEL="DEBUG"
python -m backend.run
```

Reset setelah selesai:

```powershell
Remove-Item Env:SHOW_ROUTES
Remove-Item Env:LOG_LEVEL
```

Jika hanya ingin mengembalikan log ke mode normal tanpa menutup terminal:

```powershell
$env:LOG_LEVEL="INFO"
$env:SHOW_ROUTES=""
```

---

## 7. Debug Manual Frontend

Gunakan ini hanya jika ingin menjalankan frontend terpisah dari backend launcher.

```powershell
cd frontend
npm install
npm run dev
```

Frontend biasanya berjalan di:

```text
http://localhost:3000
```

Jika port 3000 sedang dipakai, Next.js bisa memakai port lain, misalnya:

```text
http://localhost:3001
```

Pastikan `frontend/.env.local` mengarah ke backend lokal ketika debug manual:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

---

## 8. Cek Backend dan Frontend

Compile check backend:

```powershell
python -m compileall backend\app backend\main.py
```

Compile check file tertentu:

```powershell
python -m compileall backend\app\routes\tiles\tile_routes.py backend\app\routes\admin\data_routes.py
```

Lint frontend:

```powershell
cd frontend
npm run lint
```

Lint file tertentu:

```powershell
npx eslint src/components/map/config/layers.ts
```

---

## 9. Environment Lokal

Backend env lokal:

```text
backend/.env
```

Frontend env lokal:

```text
frontend/.env.local
```

File `.env` dan `.env.local` jangan di-commit ke GitHub.

---

## 10. Git Check Sebelum Commit

Cek status perubahan:

```powershell
git status
```

Lihat ringkasan perubahan:

```powershell
git diff --stat
```

Lihat detail perubahan:

```powershell
git diff
```

Stage file yang berubah:

```powershell
git add <path-file>
```

Commit:

```powershell
git commit -m "chore: describe change here"
```

Push:

```powershell
git push origin main
```

Target akhir:

```text
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

---

## 11. Troubleshooting Singkat

### Log masih menampilkan DEBUG atau daftar routes

Reset environment variable:

```powershell
Remove-Item Env:LOG_LEVEL
Remove-Item Env:SHOW_ROUTES
```

Lalu jalankan ulang lewat workflow resmi:

```powershell
.\padis.ps1 start
```

### Backend tidak bisa start

Jalankan readiness check:

```powershell
.\padis.ps1 check
```

Jika sedang debug manual, pastikan venv dan dependency backend tersedia:

```powershell
.\backend\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

### Frontend tidak bisa start

Pastikan `npm` tersedia di `PATH`, lalu gunakan workflow resmi:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

Jika sedang debug manual:

```powershell
cd frontend
npm install
npm run dev
```

### Port sudah dipakai

Jika port backend `5000` atau frontend `3000` sudah dipakai, hentikan proses lama atau gunakan terminal baru setelah proses lama dimatikan.

---

## 12. Ringkasan Command Debug

```powershell
# Workflow resmi
.\padis.ps1 check
.\padis.ps1 start
.\padis.ps1 run --mode full --hazard flood --operator nama_operator

# Optional alias
.\install-padis-command.ps1
padis check
padis start

# Backend debug manual
.\backend\venv\Scripts\Activate.ps1
python -m backend.run

# Backend debug log
$env:LOG_LEVEL="DEBUG"
python -m backend.run

# Backend show routes
$env:SHOW_ROUTES="1"
$env:LOG_LEVEL="DEBUG"
python -m backend.run

# Reset debug env
Remove-Item Env:LOG_LEVEL
Remove-Item Env:SHOW_ROUTES

# Frontend debug manual
cd frontend
npm run dev

# Graphify code graph
graphify update backend
graphify update frontend

# Compile backend
python -m compileall backend\app backend\main.py

# Git
git status
git diff --stat
git add <file>
git commit -m "message"
git push origin main
```
