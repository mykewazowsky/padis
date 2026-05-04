 # Catatan Menjalankan PADIS

Dokumen ini berisi catatan singkat untuk menjalankan **backend**, **frontend**, dan mode **debug** PADIS di local development.

---

## 1. Lokasi Project

Contoh lokasi project lokal:

```powershell
D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS
```

Masuk ke folder project:

```powershell
cd "D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS"
```

---

## 2. Menjalankan Backend

Aktifkan virtual environment backend:

```powershell
.\backend\venv\Scripts\Activate.ps1
```

Jalankan backend:

```powershell
python -m backend.run
```

Jika berhasil, backend akan berjalan di:

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

---

## 3. Menjalankan Frontend

Buka terminal baru, lalu masuk ke folder frontend:

```powershell
cd "D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\frontend"
```

Jalankan frontend:

```powershell
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

---

## 4. Menjalankan Backend dengan Log Normal

Mode normal cukup menjalankan:

```powershell
python -m backend.run
```

Log normal seharusnya hanya menampilkan informasi penting, seperti:

```text
CORS allowed origins
Default users enforced during seed
Flask server running
```

---

## 5. Menjalankan Backend dengan Debug Log

Gunakan `LOG_LEVEL=DEBUG` jika ingin melihat detail debug backend.

```powershell
$env:LOG_LEVEL="DEBUG"
python -m backend.run
```

Mode ini berguna untuk melihat detail seperti parameter layer, tile, cache, atau proses internal lain yang sengaja disimpan di level debug.

Setelah selesai, hapus environment variable agar log kembali normal:

```powershell
Remove-Item Env:LOG_LEVEL
```

---

## 6. Menampilkan Daftar Routes Backend

Untuk menampilkan daftar route Flask yang terdaftar:

```powershell
$env:SHOW_ROUTES="1"
$env:LOG_LEVEL="DEBUG"
python -m backend.run
```

Ini akan menampilkan route seperti:

```text
/api/login
/api/layers/regions
/api/tiles/<layer>/<z>/<x>/<y>
/api/admin/data
/api/generate-report-v2
```

Setelah selesai, reset environment variable:

```powershell
Remove-Item Env:SHOW_ROUTES
Remove-Item Env:LOG_LEVEL
```

Jika hanya ingin mengembalikan log ke mode normal tanpa menghapus terminal:

```powershell
$env:LOG_LEVEL="INFO"
$env:SHOW_ROUTES=""
```

---

## 7. Cek Backend Compile

Sebelum commit, jalankan compile check:

```powershell
python -m compileall backend\app backend\main.py
```

Jika hanya mengecek file tertentu:

```powershell
python -m compileall backend\app\routes\tiles\tile_routes.py backend\app\routes\admin\data_routes.py
```

---

## 8. Cek Frontend Lint

Masuk ke folder frontend:

```powershell
cd frontend
```

Jalankan lint:

```powershell
npm run lint
```

Atau cek file tertentu:

```powershell
npx eslint src/components/map/config/layers.ts
```

---

## 9. Cek Git Sebelum Commit

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

---

## 10. Commit dan Push

Stage file yang berubah:

```powershell
git add <path-file>
```

Contoh:

```powershell
git add backend/app/routes/admin/data_routes.py backend/app/routes/tiles/tile_routes.py
```

Commit:

```powershell
git commit -m "chore: describe change here"
```

Push ke GitHub:

```powershell
git push origin main
```

Cek hasil akhir:

```powershell
git status
```

Target akhir:

```text
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

---

## 11. Catatan Environment Variable Penting

### Backend

Contoh file lokal:

```text
backend/.env
```

File `.env` jangan di-commit ke GitHub.

### Frontend

Contoh file lokal:

```text
frontend/.env.local
```

File `.env.local` juga jangan di-commit ke GitHub.

---

## 12. PADIS CLI

PADIS CLI adalah command helper untuk setup, readiness check, menjalankan local development server, dan menjalankan pipeline dari terminal.

### Status Saat Ini

Command resmi saat ini masih menggunakan:

```powershell
python -m backend.scripts.cli.padis
```

Untuk Windows PowerShell, tersedia shortcut lokal dari root project:

```powershell
.\padis.ps1
```

Belum ada launcher global seperti:

```powershell
padis
```

Command internal resmi tetap `python -m backend.scripts.cli.padis <command>`. File `.\padis.ps1` hanya shortcut lokal Windows yang meneruskan argumen ke command internal tersebut.

### Perbedaan Command

- `install` = setup folder dasar, cek environment, dan cek dependency awal.
- `check` = readiness check dasar project.
- `start` = menjalankan backend + frontend lokal dan membuka Admin UI.
- `run` = menjalankan pipeline dari terminal.

### Contoh Command

Jalankan dari root project:

```powershell
python -m backend.scripts.cli.padis install
python -m backend.scripts.cli.padis install --with-deps
python -m backend.scripts.cli.padis check
python -m backend.scripts.cli.padis start
python -m backend.scripts.cli.padis start --no-open
python -m backend.scripts.cli.padis start --backend-only --no-open
python -m backend.scripts.cli.padis start --frontend-only
python -m backend.scripts.cli.padis run --mode full --hazard flood --operator nama_operator
```

Shortcut lokal Windows PowerShell:

```powershell
.\padis.ps1 install
.\padis.ps1 check
.\padis.ps1 start
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
```

### Workflow Operator/Admin

Urutan kerja yang disarankan:

```powershell
# 1. Clone repo
git clone <repo-url>
cd PADIS

# 2. Aktifkan virtual environment jika perlu
.\backend\venv\Scripts\Activate.ps1

# 3. Setup folder/env/dependency check awal
.\padis.ps1 install

# 4. Cek kesiapan project
.\padis.ps1 check

# 5. Jalankan backend + frontend lokal
.\padis.ps1 start
```

Setelah `start` berhasil, Admin UI akan dibuka otomatis di:

```text
http://localhost:3000/admin
```

Pipeline harian untuk operator/admin sebaiknya dijalankan dari Admin UI setelah backend dan frontend aktif.

### Catatan Penting

- `padis start` bukan untuk menjalankan pipeline.
- `padis run` digunakan jika pipeline ingin dijalankan dari terminal.
- `.\padis.ps1` adalah shortcut lokal Windows, bukan installer global.
- Gunakan `CTRL + C` untuk menghentikan backend/frontend dev server yang dijalankan oleh `padis start`.
- `npm` harus tersedia di `PATH` agar frontend bisa dijalankan.
- Mode `full + multi` perlu hati-hati karena memakai output flood/drought yang sudah ada.
- Jika proses frontend/backend masih hidup setelah `CTRL + C`, tutup terminal atau hentikan process secara manual.

---

## 13. Troubleshooting Singkat

### Log masih menampilkan DEBUG atau daftar routes

Kemungkinan `LOG_LEVEL` atau `SHOW_ROUTES` masih aktif di PowerShell.

Reset dengan:

```powershell
Remove-Item Env:LOG_LEVEL
Remove-Item Env:SHOW_ROUTES
```

Lalu jalankan ulang:

```powershell
python -m backend.run
```

### Backend tidak bisa start

Cek virtual environment sudah aktif:

```powershell
.\backend\venv\Scripts\Activate.ps1
```

Cek dependency:

```powershell
pip install -r requirements.txt
```

atau jika ada requirements backend khusus:

```powershell
pip install -r backend\requirements.txt
```

### Frontend tidak bisa start

Masuk ke folder frontend dan install dependency:

```powershell
cd frontend
npm install
npm run dev
```

### Port sudah dipakai

Jika port backend `5000` atau frontend `3000` sudah dipakai, hentikan proses lama atau gunakan terminal baru setelah proses lama dimatikan.

---

## 14. Urutan Kerja Harian yang Disarankan

```powershell
# Terminal 1 - Backend
cd "D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS"
.\backend\venv\Scripts\Activate.ps1
python -m backend.run
```

```powershell
# Terminal 2 - Frontend
cd "D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\frontend"
npm run dev
```

Lalu buka:

```text
http://localhost:3000
```

---

## 15. Ringkasan Command Penting

```powershell
# Backend normal
python -m backend.run

# Backend debug
$env:LOG_LEVEL="DEBUG"
python -m backend.run

# Backend show routes
$env:SHOW_ROUTES="1"
$env:LOG_LEVEL="DEBUG"
python -m backend.run

# Reset debug env
Remove-Item Env:LOG_LEVEL
Remove-Item Env:SHOW_ROUTES

# Frontend
cd frontend
npm run dev

# Compile backend
python -m compileall backend\app backend\main.py

# Git
 git status
 git diff --stat
 git add <file>
 git commit -m "message"
 git push origin main
```
