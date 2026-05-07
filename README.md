# PADIS - Paddy Disaster Information System

PADIS adalah platform Web-GIS untuk analisis risiko bencana terhadap produksi padi di Indonesia. Sistem ini menggabungkan pipeline geospasial, database PostGIS, peta interaktif, grafik analitik, laporan, dan panel admin untuk mengelola proses analisis.

Hazard yang didukung:

- `flood`: analisis banjir.
- `drought`: analisis kekeringan.
- `multi`: analisis multi-hazard dari hasil flood dan drought.

## Ringkasan Sistem

```
Browser
  -> Frontend Next.js
      -> Flask API
          -> PostgreSQL + PostGIS

Operator lokal
  -> Admin UI / PADIS CLI
      -> subprocess pipeline Python
          -> backend/data/output/analysis/*.geojson
          -> ETL ke database setelah 3 file final lengkap
```

Frontend membaca data dari API backend. Backend membaca data analitik dari database. Pipeline analisis berjalan sebagai subprocess lokal dan melaporkan progres ke tabel `runs`.

## Stack Utama

| Lapisan | Teknologi |
|---|---|
| Frontend | Next.js 16.1.7, React 19.2.3, TypeScript |
| Styling | Tailwind CSS 4 |
| Peta | Leaflet, React Leaflet, Leaflet.VectorGrid |
| Grafik | Recharts |
| Backend | Flask 3.1.3, Python 3.11 |
| Database | PostgreSQL + PostGIS, Supabase |
| Geospasial | GeoPandas, Rasterio, Fiona, Shapely, PyProj |
| Auth | JWT, role `admin` dan `user` |
| Laporan | HTML report, XLSX/CSV export, peta dan grafik render server-side |
| Deploy | Railway untuk backend, Vercel/Railway untuk frontend |

## Struktur Project

```
PADIS/
|-- backend/
|   |-- app/
|   |   |-- routes/              # Blueprint Flask: auth, layers, tiles, admin, report
|   |   |-- services/            # Service eksternal seperti GeoServer/email
|   |   `-- utils/               # Helper report dan utilitas backend
|   |-- data/
|   |   |-- raw/                 # Input operator
|   |   |-- processed/           # Hasil preprocess
|   |   `-- output/analysis/     # File final analisis
|   |-- scripts/
|   |   |-- pipeline/            # Orkestrasi preprocess, zonal, analysis, ETL
|   |   |-- analysis/            # Modul flood, drought, multihazard
|   |   |-- etl/                 # Load hasil final ke database
|   |   |-- core/                # Raster, vector, zonal engine
|   |   `-- cli/                 # PADIS CLI
|   `-- run.py
|-- frontend/
|   |-- src/app/                 # Next.js App Router
|   |-- src/components/          # Map, dashboard, admin, chart, report
|   |-- src/lib/                 # API/auth helper
|   `-- src/services/            # Client data layer
|-- docs/                        # Dokumentasi teknis Indonesia
|-- scripts/                     # Helper operasional opsional
|-- db/migrations/               # Migration SQL manual
|-- padis.ps1                    # Launcher lokal Windows
|-- install-padis-command.ps1    # Installer alias opsional
|-- Dockerfile.pipeline          # Image opsional untuk pipeline operator
`-- README.md
```

## Mulai Cepat Lokal Windows

Jalankan dari root project:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

`check` memeriksa kesiapan dasar project. `start` menjalankan backend dan frontend lokal, lalu membuka Admin UI di:

```text
http://localhost:3000/admin
```

Jika ingin memakai command pendek `padis`, pasang alias opsional:

```powershell
.\install-padis-command.ps1
```

Restart PowerShell, lalu gunakan:

```powershell
padis check
padis start
```

Alias `padis` hanya convenience di komputer user tersebut. Workflow resmi repo tetap `.\padis.ps1`.

## Environment Lokal

Backend membaca konfigurasi dari `backend/.env`.

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
SECRET_KEY=isi-dengan-secret-kuat
JWT_SECRET_KEY=isi-dengan-secret-jwt-kuat
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Frontend membaca konfigurasi dari `frontend/.env.local`.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Untuk production, `NEXT_PUBLIC_API_BASE_URL` harus mengarah ke URL backend publik, bukan localhost.

## Workflow Pipeline Terbaru

Pipeline analisis dan load database sengaja dipisahkan.

1. Jalankan pipeline penuh untuk hazard yang dibutuhkan.
2. Pastikan tiga file final tersedia.
3. Jalankan "Muat ke Database Saja" untuk ETL ketiga file final sekaligus.
4. Aktifkan run yang sukses dari Pipeline Monitor jika diperlukan.

Tiga file final wajib:

```text
backend/data/output/analysis/kabkota_flood_final.geojson
backend/data/output/analysis/kabkota_drought_final.geojson
backend/data/output/analysis/kabkota_multihazard_final.geojson
```

Perilaku tombol di Admin UI:

| Tombol | Perilaku |
|---|---|
| Jalankan Pipeline Penuh | Mengikuti hazard terpilih dan menghasilkan satu file final sesuai hazard. Tidak menjalankan ETL. |
| Muat ke Database Saja | Tidak memakai hazard terpilih. Hanya berjalan jika tiga file final lengkap. |

Mode CLI:

| Mode | Perilaku |
|---|---|
| `full + flood` | Preprocess, zonal, analysis flood. Output: `kabkota_flood_final.geojson`. |
| `full + drought` | Preprocess, zonal, analysis drought. Output: `kabkota_drought_final.geojson`. |
| `full + multi` | Analysis multihazard saja. Output: `kabkota_multihazard_final.geojson`. |
| `analysis + flood/drought` | Zonal dan analysis hazard terpilih tanpa preprocess. |
| `analysis + multi` | Analysis multihazard dari file flood dan drought final yang sudah ada. |
| `web` | ETL/load database saja untuk ketiga file final. |

Contoh CLI:

```powershell
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
.\padis.ps1 run --mode full --hazard drought --operator nama_operator
.\padis.ps1 run --mode full --hazard multi --operator nama_operator
```

Untuk operator, cara yang disarankan tetap melalui Admin UI.

## Opsi Docker Pipeline

Workflow lokal tetap memakai `.\padis.ps1` dan Admin UI. Docker disiapkan sebagai jalur opsional untuk operator/admin lain yang ingin menjalankan pipeline tanpa mengatur dependency geospasial Python secara manual.

Ringkas:

```powershell
Copy-Item env.pipeline.example .env.pipeline
.\scripts\run-pipeline-docker.ps1 -Build -Mode full -Hazard flood -Operator nama_operator
```

Panduan lengkap ada di [docs/docker-pipeline.md](docs/docker-pipeline.md).

## Fitur Utama

- Dashboard Web-GIS untuk melihat loss, AAL, hazard index, produksi, dan batas administrasi.
- Vector tile MVT dari PostGIS untuk rendering peta yang lebih ringan.
- Filter hazard, return period, climate scenario, run aktif, dan wilayah.
- Chart perbandingan hazard, loss, AAL, dan distribusi risiko.
- Report preview dan export data.
- Admin UI untuk data management, process control, pipeline monitor, outputs, dan manajemen user.
- Auth berbasis JWT dengan role `admin` dan `user`.
- Pipeline geospasial terpisah dari backend web agar proses berat tidak memblokir Flask.

## Dokumentasi

Urutan baca yang disarankan:

1. [docs/architecture.md](docs/architecture.md) - gambaran arsitektur backend, frontend, database, dan pipeline.
2. [docs/pipeline-operation.md](docs/pipeline-operation.md) - panduan operator menjalankan pipeline terbaru.
3. [docs/pipeline.md](docs/pipeline.md) - detail teknis pipeline geospasial.
4. [docs/api.md](docs/api.md) - referensi endpoint backend.
5. [docs/frontend.md](docs/frontend.md) - struktur frontend, state dashboard, dan komponen UI.
6. [docs/database.md](docs/database.md) - skema database dan tabel utama.
7. [docs/data-requirements.md](docs/data-requirements.md) - standar file input pipeline.
8. [docs/deployment.md](docs/deployment.md) - panduan deployment.
9. [docs/docker-pipeline.md](docs/docker-pipeline.md) - jalur opsional menjalankan pipeline lewat Docker.
10. [docs/padis-dev-commands.md](docs/padis-dev-commands.md) - runbook command developer.

## Graphify

Project memakai graphify untuk memetakan struktur kode backend dan frontend.

```powershell
python -m graphify update frontend
python -m graphify update backend
```

Output graph berada di:

```text
frontend/graphify-out/
backend/graphify-out/
```

## Lisensi

Academic Capstone Project PADIS - Teknik Geodesi dan Geomatika, Institut Teknologi Bandung.
