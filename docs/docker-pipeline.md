# PADIS Docker Pipeline Runbook

Dokumen ini menjelaskan jalur opsional untuk menjalankan pipeline PADIS lewat Docker.
Workflow lokal yang sudah ada tetap berlaku:

```powershell
.\padis.ps1 check
.\padis.ps1 start
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
```

Docker disiapkan untuk operator/admin lain yang ingin menjalankan pipeline tanpa mengatur dependency geospasial Python secara manual.

## Posisi Docker dalam Sistem

Docker di repo ini hanya untuk pipeline geospasial:

```text
Dockerfile.pipeline
  -> backend/scripts/main.py
  -> backend/scripts/
  -> backend/requirements-pipeline.txt
  -> mounted backend/data
  -> DATABASE_URL
```

Docker ini tidak menjalankan:

- frontend Next.js,
- backend Flask,
- PostgreSQL/PostGIS,
- Admin UI.

Admin UI dan `.\padis.ps1` tetap bisa dipakai seperti biasa. Jalur Docker adalah opsi operator terpisah.

## Prasyarat Operator

Operator membutuhkan:

1. Docker Desktop atau Docker Engine.
2. Repo PADIS.
3. Folder data lokal di `backend/data`.
4. File `.env.pipeline` berisi `DATABASE_URL`.
5. Akses database target yang sudah memiliki schema PADIS.

## Menyiapkan Environment

Salin contoh env:

```powershell
Copy-Item env.pipeline.example .env.pipeline
```

Isi `.env.pipeline`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

File `.env.pipeline` tidak boleh di-commit karena berisi kredensial.

## Struktur Data

Data tetap berada di folder repo lokal:

```text
backend/data/
  raw/
  processed/
  output/
```

Saat container berjalan, folder itu di-mount ke:

```text
/app/backend/data
```

Artinya output pipeline tetap muncul di `backend/data/output/...` pada mesin operator.

## Build Image

Dari root project:

```powershell
docker build -f Dockerfile.pipeline -t padis-pipeline .
```

Atau gunakan helper:

```powershell
.\scripts\run-pipeline-docker.ps1 -Build -Mode full -Hazard flood -Operator nama_operator
```

## Menjalankan Pipeline

### Menggunakan Helper PowerShell

Flood:

```powershell
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard flood -Operator nama_operator
```

Drought:

```powershell
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard drought -Operator nama_operator
```

Multi-hazard:

```powershell
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard multi -Operator nama_operator
```

Load database atau ETL saja:

```powershell
.\scripts\run-pipeline-docker.ps1 -Mode web -Hazard multi -Operator nama_operator
```

### Menggunakan Docker Manual

```powershell
docker run --rm `
  --env-file .env.pipeline `
  -v "${PWD}\backend\data:/app/backend/data" `
  padis-pipeline `
  --mode full --hazard flood --operator nama_operator
```

## Urutan Operasional yang Disarankan

Jalankan:

```powershell
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard flood -Operator nama_operator
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard drought -Operator nama_operator
.\scripts\run-pipeline-docker.ps1 -Mode full -Hazard multi -Operator nama_operator
```

Setelah tiga file final tersedia, jalankan ETL:

```powershell
.\scripts\run-pipeline-docker.ps1 -Mode web -Hazard multi -Operator nama_operator
```

File final yang dibutuhkan:

```text
backend/data/output/analysis/kabkota_flood_final.geojson
backend/data/output/analysis/kabkota_drought_final.geojson
backend/data/output/analysis/kabkota_multihazard_final.geojson
```

## Mode dan Hazard

Mode:

| Mode | Fungsi |
|---|---|
| `full` | Jalankan pipeline lengkap sesuai hazard. |
| `preprocess` | Jalankan preprocess. |
| `analysis` | Jalankan analisis tanpa preprocess penuh. |
| `web` | Jalankan ETL/load database saja. |

Hazard:

| Hazard | Fungsi |
|---|---|
| `flood` | Analisis banjir. |
| `drought` | Analisis kekeringan. |
| `multi` | Analisis multi-hazard dari output flood dan drought. |

## Checklist Sebelum Run

Pastikan:

- `docker --version` berhasil.
- `Dockerfile.pipeline` ada di root project.
- `backend/data` tersedia.
- `.env.pipeline` tersedia dan berisi `DATABASE_URL`.
- Input raw pipeline sudah lengkap.
- Database target bisa diakses dari container.
- Tidak ada run pipeline lain yang sedang berjalan untuk database target yang sama.

## Troubleshooting

### Docker CLI tidak ditemukan

Install Docker Desktop, jalankan Docker Desktop, lalu buka terminal baru.

### Folder data tidak ditemukan

Pastikan folder ini ada:

```text
backend/data
```

### Database tidak bisa diakses

Cek `DATABASE_URL`. Jika database berada di localhost host Windows, container biasanya tidak bisa memakai `localhost` yang sama. Gunakan host yang dapat diakses container, misalnya host database publik, IP LAN, atau konfigurasi Docker Desktop yang sesuai.

### Image belum ada

Build ulang:

```powershell
docker build -f Dockerfile.pipeline -t padis-pipeline .
```

### Multi-hazard gagal

Jalankan `full + flood` dan `full + drought` terlebih dahulu. Multi-hazard membutuhkan output final dari keduanya.

## Catatan Desain

Docker pipeline ini sengaja tidak memakai Docker Compose karena saat ini hanya pipeline yang perlu dicontainerize. Compose baru diperlukan jika PADIS ingin menjalankan backend, frontend, database, dan worker pipeline sebagai satu stack.
