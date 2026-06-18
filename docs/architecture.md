# Arsitektur PADIS

Dokumen ini menjelaskan bentuk sistem PADIS saat ini: frontend Next.js, backend Flask, database PostGIS, dan pipeline geospasial lokal.

## Gambaran Besar

PADIS terdiri dari tiga jalur utama:

1. Jalur baca dashboard: frontend meminta data ke backend, backend membaca database.
2. Jalur peta: frontend mengambil vector tile MVT dari endpoint tile backend.
3. Jalur pipeline: operator menjalankan subprocess Python untuk menghasilkan file final dan memuatnya ke database.

```
Frontend Next.js
  -> Flask API
      -> PostgreSQL + PostGIS

Admin UI / PADIS CLI
  -> backend/scripts/main.py
      -> preprocess
      -> zonal
      -> analysis
      -> output final GeoJSON
      -> ETL/load database saat diminta terpisah
```

Pipeline tidak berjalan di thread request Flask. Endpoint admin hanya men-spawn subprocess dan statusnya dibaca dari tabel `runs`.

## Struktur Backend

```
backend/
|-- app/
|   |-- __init__.py              # create_app, CORS, registrasi blueprint
|   |-- routes/
|   |   |-- auth/                # login, register, reset password
|   |   |-- layers/              # data atribut layer dan endpoint lama
|   |   |-- tiles/               # MVT tile endpoint
|   |   |-- admin/               # data, process, output, user admin
|   |   |-- analytics_routes.py  # ringkasan dan chart data
|   |   `-- report_routes.py     # CSV, XLSX, report
|   |-- services/                # email service, audit log
|   `-- utils/report/            # renderer report, chart, peta
|-- scripts/
|   |-- main.py                  # entry point pipeline
|   |-- cli/padis.py             # PADIS CLI
|   |-- pipeline/                # orchestrator pipeline
|   |-- core/                    # raster, vector, zonal engine
|   |-- analysis/                # flood, drought, multihazard
|   |-- etl/                     # load_regions, load_losses, load_aal, dll.
|   `-- config/                  # path, hazard, settings, registry
`-- data/
    |-- raw/
    |-- processed/
    `-- output/analysis/
```

Blueprint utama didaftarkan di `backend/app/__init__.py`:

- `/api/auth/*`
- `/api/runs/latest`
- `/api/aal-summary*`, `/api/loss-summary*`, `/api/top-regions`, `/api/hazard-breakdown`
- `/api/layers/*`
- `/api/tiles/*`
- `/api/admin/*`
- `/api/download-csv`
- `/api/generate-report-v2`

## Struktur Frontend

```
frontend/src/
|-- app/
|   |-- (main)/                  # landing, dashboard, about, metodologi
|   |-- (admin)/admin/           # admin dashboard dan tools operator
|   |-- (auth)/                  # login, register, forgot/reset password
|   |-- layout.tsx
|   `-- globals.css
|-- components/
|   |-- map/                     # MapView, MapCanvas, VectorTileLayer
|   |-- dashboard/               # filter, overlay, loading/empty state
|   |-- charts/                  # AdvancedCharts, ComparisonCharts
|   |-- admin/                   # AdminShell, AdminGuard
|   |-- report/                  # Report preview dan document
|   `-- layout/
|-- lib/                         # API/auth/fetch helper
|-- services/fetchLayers.ts
`-- types/map.ts
```

State dashboard utama berada di `frontend/src/app/(main)/dashboard/page.tsx`. Komponen peta dibuat client-side karena Leaflet membutuhkan browser API.

## Jalur Baca Dashboard

```
User memilih filter
  -> dashboard/page.tsx menyimpan state hazard, scenario, climate, runId
  -> fetchAllLayers() memanggil endpoint values
  -> MapView menghitung metrik turunan dan selectedFeature
  -> MapViewClient menghitung klasifikasi warna
  -> MapCanvas merender MVT layer dari /api/tiles
```

Endpoint values mengembalikan atribut tanpa geometri. Geometri peta tetap diambil dari vector tile agar dashboard ringan.

Endpoint values utama:

- `GET /api/layers/values/loss`
- `GET /api/layers/values/aal`
- `GET /api/layers/values/hazard`
- `GET /api/layers/values/production`

Endpoint tile utama:

- `GET /api/tiles/loss/{z}/{x}/{y}`
- `GET /api/tiles/aal/{z}/{x}/{y}`
- `GET /api/tiles/hazard/{z}/{x}/{y}`
- `GET /api/tiles/production/{z}/{x}/{y}`
- `GET /api/tiles/regions/{z}/{x}/{y}`

## Jalur Pipeline Terbaru

Pipeline sekarang memisahkan analisis hazard dari ETL/load database.

```
Jalankan Pipeline Penuh
  -> POST /api/admin/start-pipeline
  -> scripts/main.py --mode full --hazard <hazard>
  -> menghasilkan file final sesuai hazard
  -> TIDAK menjalankan ETL

Muat ke Database Saja
  -> GET /api/admin/final-analysis-status
  -> POST /api/admin/load-database
  -> scripts/main.py --mode web --hazard multi
  -> ETL ketiga file final ke database
```

File final yang wajib ada sebelum ETL:

```text
backend/data/output/analysis/kabkota_flood_final.geojson
backend/data/output/analysis/kabkota_drought_final.geojson
backend/data/output/analysis/kabkota_multihazard_final.geojson
```

`POST /api/admin/load-database` tidak menerima hazard dari frontend. Endpoint ini selalu memuat semua hazard sekaligus.

## Status Run dan Aktivasi

Pipeline membuat atau memperbarui baris di tabel `runs`. Kolom penting:

- `status`: `running`, `success`, atau `failed`.
- `step`: tahap aktif, misalnya `preprocess`, `zonal`, `analysis`, `etl`.
- `progress`: persentase progres.
- `is_active`: run yang sedang dipakai dashboard.
- `source`: `local` untuk run yang dijalankan operator.

Admin UI membaca status melalui:

- `GET /api/admin/run-status`
- `GET /api/admin/process-status`
- `GET /api/admin/runs`
- `GET /api/admin/runs/active`

Aktivasi run dilakukan melalui:

```text
PATCH /api/admin/runs/{run_id}/activate
```

## Database

Database utama adalah PostgreSQL + PostGIS. Tabel yang paling sering dipakai:

- `regions_adm`: batas administrasi kabupaten/kota.
- `regions_sawah`: wilayah sawah hasil agregasi.
- `production`: produksi padi per wilayah.
- `losses`: nilai kerugian per hazard, scenario, return period, dan run.
- `aal`: Average Annual Loss per hazard, scenario, dan run.
- `zonal_kabupaten`: statistik zonal hazard per wilayah.
- `runs`: metadata eksekusi pipeline.
- `app_users`: akun aplikasi.
- `password_reset_tokens`: token reset password.
- `admin_audit_log`: log aksi admin (role/status change, password reset).

## Keamanan

### Rate Limiting

Backend memakai Flask-Limiter dengan storage in-memory per worker. Batas per endpoint:

| Endpoint | Limit |
|---|---|
| `POST /api/register` | 10 per jam |
| `POST /api/login` | 20 per menit, 100 per jam |
| `POST /api/forgot-password` | 5 per jam |
| `POST /api/reset-password` | 10 per jam |

### Security Headers

Backend menyertakan header keamanan pada setiap response:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`

### Token Reset Password

Raw JWT reset password dikirim ke email user. Backend hanya menyimpan SHA-256 hex digest dari token tersebut di kolom `token_hash`. Nilai plaintext tidak pernah tersimpan di database.

### Audit Log

Setiap aksi admin (ubah role, ubah status, reset password selesai) dicatat ke tabel `admin_audit_log` beserta IP address, waktu, dan detail perubahan.

### Pipeline Spawn Guard

Endpoint `POST /api/admin/start-pipeline` dan `POST /api/admin/load-database` mengembalikan `503` jika env var `PIPELINE_SPAWN_DISABLED=true`. Ini dipakai untuk deployment production di mana pipeline dijalankan manual oleh operator.

### Bootstrap Admin

`seed_default_users()` hanya berjalan jika `BOOTSTRAP_DEFAULT_ADMIN=true`. Seeding memakai `ON CONFLICT DO NOTHING` sehingga tidak menimpa password yang sudah diubah operator.

## CORS dan Auth

Backend memakai Flask-CORS dengan origin dari `FRONTEND_ORIGINS` atau `FRONTEND_ORIGIN`. Jika env tidak diisi, default lokal adalah:

```text
http://localhost:3000
http://127.0.0.1:3000
```

Auth memakai JWT. Endpoint admin dilindungi oleh decorator `admin_required`.

## Cache Tile

Tile MVT memakai cache in-memory di backend. Cache ini mempercepat request berulang, tetapi akan hilang saat proses backend restart.

Endpoint utilitas:

- `GET /api/tiles/cache/stats`
- `POST /api/tiles/cache/clear`

## Prinsip Desain

- Frontend tidak menyimpan state global besar; state dashboard disimpan di page.
- Backend web hanya melayani API dan spawn subprocess, bukan menjalankan komputasi berat di request.
- Pipeline menghasilkan artefak final dahulu, lalu ETL dijalankan sebagai langkah terpisah.
- Dashboard membaca data dari run aktif agar hasil yang tampil konsisten lintas layer.
