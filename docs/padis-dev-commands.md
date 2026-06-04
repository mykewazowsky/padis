# Runbook Command Developer PADIS

Dokumen ini berisi command teknis untuk developer dan operator teknis. Untuk orientasi umum, mulai dari `README.md`.

## Workflow Resmi Lokal

Jalankan dari root project:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

Makna command:

| Command | Fungsi |
|---|---|
| `.\padis.ps1 check` | Cek kesiapan dasar backend/frontend. |
| `.\padis.ps1 start` | Jalankan backend dan frontend lokal, lalu buka Admin UI. |
| `.\padis.ps1 run` | Jalankan pipeline dari terminal. |
| `.\padis.ps1 install` | Setup dependency sesuai dukungan CLI. |

Admin UI lokal:

```text
http://localhost:3000/admin
```

## Alias Opsional

Pasang alias `padis` di PowerShell profile:

```powershell
.\install-padis-command.ps1
```

Restart PowerShell, lalu:

```powershell
padis check
padis start
padis run --mode full --hazard flood --operator nama_operator
```

Alias ini opsional. Dokumentasi dan workflow resmi tetap memakai `.\padis.ps1`.

## Menjalankan Pipeline dari CLI

Urutan analisis lengkap:

```powershell
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
.\padis.ps1 run --mode full --hazard drought --operator nama_operator
.\padis.ps1 run --mode full --hazard multi --operator nama_operator
```

Load database saja:

```powershell
.\padis.ps1 run --mode web --hazard multi --operator nama_operator
```

Catatan:

- `full` tidak menjalankan ETL.
- `web` menjalankan ETL saja.
- `multi` membutuhkan file final flood dan drought.
- Untuk operator, tombol "Muat ke Database Saja" di Admin UI lebih aman karena mengecek tiga file final.

## Opsi Pipeline Docker

Workflow lokal resmi tetap `.\padis.ps1`. Docker tersedia sebagai jalur opsional untuk operator/admin yang ingin menjalankan pipeline dengan dependency geospasial yang sudah dipaketkan.

Setup awal:

```powershell
Copy-Item env.pipeline.example .env.pipeline
```

Build dan run:

```powershell
.\scripts\run-pipeline-docker.ps1 -Build -Mode full -Hazard flood -Operator nama_operator
```

Run berikutnya:

```powershell
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard drought -Operator nama_operator
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard multi -Operator nama_operator
.\scripts\run-pipeline-docker.ps1 -Mode web -Hazard multi -Operator nama_operator
```

Panduan lengkap: `docs/docker-pipeline.md`.

## Command Internal CLI

`.\padis.ps1` meneruskan argumen ke CLI internal:

```powershell
python -m backend.scripts.cli.padis check
python -m backend.scripts.cli.padis start
python -m backend.scripts.cli.padis run --mode full --hazard flood --operator nama_operator
```

Gunakan command internal hanya untuk debug.

## Debug Backend Manual

```powershell
.\backend\venv\Scripts\Activate.ps1
python -m backend.run
```

Backend lokal biasanya berjalan di:

```text
http://127.0.0.1:5000
```

Log debug:

```powershell
$env:LOG_LEVEL="DEBUG"
python -m backend.run
```

Reset env:

```powershell
Remove-Item Env:LOG_LEVEL
```

Menampilkan daftar route saat startup:

```powershell
$env:SHOW_ROUTES="1"
$env:LOG_LEVEL="DEBUG"
python -m backend.run
```

Reset:

```powershell
Remove-Item Env:SHOW_ROUTES
Remove-Item Env:LOG_LEVEL
```

## Debug Frontend Manual

```powershell
cd frontend
npm install
npm run dev
```

Pastikan `frontend/.env.local` berisi:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Frontend lokal biasanya berjalan di:

```text
http://localhost:3000
```

## Validasi dan Build

Compile backend:

```powershell
python -m compileall backend\app backend\scripts
```

Lint frontend:

```powershell
cd frontend
npm run lint
```

Build frontend:

```powershell
cd frontend
npm run build
```

## Graphify

Update graph frontend:

```powershell
python -m graphify update frontend
```

Update graph backend:

```powershell
python -m graphify update backend
```

Output:

```text
frontend/graphify-out/
backend/graphify-out/
```

Graphify update kode tidak membutuhkan LLM API key.

## Database

Jalankan migration SQL dari `db/migrations/` sesuai urutan di database target.

Cek PostGIS:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Menandai run lama sebagai failed jika proses mati tetapi status masih running:

```sql
UPDATE runs
SET status = 'failed'
WHERE status = 'running' AND source = 'local';
```

## Git

Cek status:

```powershell
git status
```

Ringkasan perubahan:

```powershell
git diff --stat
```

Detail perubahan:

```powershell
git diff
```

Stage dan commit:

```powershell
git add <file>
git commit -m "docs: perbarui dokumentasi padis"
```

Push:

```powershell
git push origin main
```

## Pipeline dengan Raster di Luar `backend/data/`

Jika raster sudah tersedia di folder eksternal (misal disk terpisah) dan tidak bisa dipindahkan karena kapasitas, gunakan script khusus:

```powershell
# Aktifkan venv terlebih dahulu
.\backend\venv\Scripts\Activate.ps1

# Step 1: Flood (termasuk re-generate intersection sawah jika perlu)
python -m backend.scripts.tools.run_pipeline_external_raster `
    --hazard flood `
    --raster-dir "E:\CAPSTONE\data" `
    --rerun-vector `
    --operator nama_operator

# Step 2: Drought
python -m backend.scripts.tools.run_pipeline_external_raster `
    --hazard drought `
    --raster-dir "E:\CAPSTONE\data" `
    --operator nama_operator

# Step 3: Multihazard
python -m backend.scripts.tools.run_pipeline_external_raster --hazard multi

# Step 4: ETL
python -m backend.scripts.tools.run_pipeline_external_raster --hazard etl
```

Flag tersedia:

| Flag | Keterangan |
|---|---|
| `--hazard` | `flood` \| `drought` \| `multi` \| `etl` |
| `--raster-dir` | Path folder raster eksternal. Wajib untuk `flood`/`drought`. |
| `--rerun-vector` | Paksa regenerasi `sawah_admin_intersection.geojson` meski sudah ada. |
| `--operator` | Nama operator untuk log. |

Script ini tidak memindahkan atau menyalin file raster. Raster dibaca langsung dari lokasi aslinya.

## Tools QC (Quality Control)

Membandingkan hasil DB dengan perhitungan QGIS (XLSX):

```powershell
# Generate laporan CSV QC (flood, drought, multihazard)
python backend\scripts\tools\generate_qc_report.py

# Generate laporan HTML interaktif
python backend\scripts\tools\generate_qc_html.py
```

Output tersimpan di:

```text
backend/data/output/QC/
|-- QC_Flood_run49.csv
|-- QC_Flood_summary_run49.csv
|-- QC_Drought_run49.csv
|-- QC_Drought_summary_run49.csv
|-- QC_Multihazard_run49.csv
|-- QC_Multihazard_summary_run49.csv
```

HTML report tersimpan di `C:\Users\...\Downloads\QC_Report_run49.html` dan dapat dibuka langsung di browser.

Untuk mengubah `RUN_ID` atau path XLSX target, edit konstanta di baris awal masing-masing script.

## Troubleshooting Singkat

### Backend tidak start

```powershell
.\padis.ps1 check
.\backend\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python -m backend.run
```

### Frontend tidak start

```powershell
cd frontend
npm install
npm run dev
```

### Port sudah dipakai

Hentikan proses lama yang memakai port `5000` atau `3000`, lalu jalankan ulang.

### Pipeline tidak bisa dimulai

Cek Pipeline Monitor. Jika ada run `running` yang sebenarnya sudah mati, tandai sebagai failed di database.

### Load database tidak bisa jalan

Cek status file final di Process Control. Tiga file final harus ada:

```text
kabkota_flood_final.geojson
kabkota_drought_final.geojson
kabkota_multihazard_final.geojson
```

## Ringkasan Command

```powershell
# Lokal resmi
.\padis.ps1 check
.\padis.ps1 start

# Pipeline
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
.\padis.ps1 run --mode full --hazard drought --operator nama_operator
.\padis.ps1 run --mode full --hazard multi --operator nama_operator
.\padis.ps1 run --mode web --hazard multi --operator nama_operator

# Pipeline Docker opsional
.\scripts\run-pipeline-docker.ps1 -Build -Mode full -Hazard flood -Operator nama_operator
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard drought -Operator nama_operator
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard multi -Operator nama_operator
.\scripts\run-pipeline-docker.ps1 -Mode web -Hazard multi -Operator nama_operator

# Backend manual
.\backend\venv\Scripts\Activate.ps1
python -m backend.run

# Frontend manual
cd frontend
npm run dev

# Validasi
python -m compileall backend\app backend\scripts
cd frontend
npm run lint

# Graphify
python -m graphify update frontend
python -m graphify update backend
```
