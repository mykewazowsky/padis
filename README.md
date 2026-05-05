# PADIS — Paddy Disaster Information System

Web-GIS platform for spatial risk analysis of natural hazards (flood, drought, multi-hazard) on rice production areas in Indonesia. Integrates geospatial data pipelines, interactive map visualization, and risk analytics through a unified dashboard.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.1.7, React 19.2.3, TypeScript |
| Styling | Tailwind CSS v4 |
| Map | Leaflet 1.9.4, Leaflet.VectorGrid 1.3.0 (MVT) |
| Charts | Recharts 3.8.0 |
| Backend | Flask 3.1.3, Python 3.11 |
| Database | PostgreSQL + PostGIS (Supabase) |
| ORM | SQLAlchemy 2.x + GeoAlchemy2 |
| Geospatial | GeoPandas, Rasterio, Fiona, Shapely, PyProj |
| Auth | PyJWT (HS256, 8h expiry) |
| PDF Reports | ReportLab 4.2.0 |
| Deployment | Railway (backend) + Vercel/Railway (frontend) |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│  Next.js App (React + Leaflet + Recharts)               │
│  ├── (main)/dashboard  — map + analytics                │
│  ├── (main)/metodologi — methodology pages              │
│  ├── (admin)/admin     — pipeline management            │
│  └── (auth)/login      — authentication                 │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────────┐
│                   Flask API (Railway)                   │
│  ├── /api/auth          — login, register               │
│  ├── /api/layers/values — attribute data (JSON)         │
│  ├── /api/tiles         — MVT vector tiles              │
│  ├── /api/analytics     — summary statistics            │
│  ├── /api/report        — PDF report generation         │
│  └── /api/admin         — pipeline spawn + status + data │
└────────────────────┬────────────────────────────────────┘
                     │ SQLAlchemy + psycopg2
┌────────────────────▼────────────────────────────────────┐
│             Supabase PostgreSQL + PostGIS               │
│  regions_adm, losses, aal, zonal_kabupaten,             │
│  production, hazards, scenarios, return_periods, runs   │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL with PostGIS extension (or Supabase project)

### Local Development on Windows

Default resmi repo untuk local development di Windows adalah menjalankan PADIS dari root project dengan launcher lokal:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

`.\padis.ps1` adalah launcher lokal resmi repo untuk Windows PowerShell. Launcher ini memakai `backend\venv\Scripts\python.exe` jika tersedia, lalu fallback ke `python` dari PATH.

`.\padis.ps1 start` akan:

- menjalankan backend Flask,
- menjalankan frontend Next.js,
- membuka Admin UI di `http://localhost:3000/admin`.

`start` hanya untuk menjalankan aplikasi lokal dan Admin UI. Command ini bukan untuk menjalankan pipeline dari terminal.

### Optional PowerShell Alias

Jika ingin memakai command pendek `padis`, pasang alias lokal satu kali:

```powershell
.\install-padis-command.ps1
```

Restart PowerShell, lalu jalankan:

```powershell
padis check
padis start
```

Alias ini berlaku di komputer user tersebut melalui PowerShell profile. `padis` bukan command bawaan setelah clone repo dan bukan pengganti default resmi `.\padis.ps1`.

### Running the Pipeline

Pipeline harian sebaiknya dijalankan dari Admin UI setelah `start` berhasil. Jika perlu menjalankan pipeline dari terminal:

```powershell
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
```

Atau jika alias sudah dipasang:

```powershell
padis run --mode full --hazard flood --operator nama_operator
```

Perbedaan utama:

- `.\padis.ps1 start` / `padis start` = menjalankan backend + frontend lokal dan membuka Admin UI.
- `.\padis.ps1 run` / `padis run` = menjalankan pipeline dari terminal.

### Manual Debug

Cara manual masih bisa dipakai untuk debug backend/frontend secara terpisah:

```powershell
.\backend\venv\Scripts\Activate.ps1
python -m backend.run
```

```powershell
cd frontend
npm run dev
```

Untuk workflow operator/admin sehari-hari, gunakan `.\padis.ps1 check` dan `.\padis.ps1 start`.

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
SECRET_KEY=your-jwt-secret-key
FLASK_ENV=development
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app
```

> **Note:** `NEXT_PUBLIC_API_BASE_URL` must not point to `127.0.0.1` in production — the app throws an error if it does.

## Key Features

- **Interactive Map Dashboard** — multi-layer toggle for flood/drought intensity, economic loss, Annual Average Loss (AAL), and rice production areas
- **MVT Tiles** — vector tiles served via PostGIS `ST_AsMVTGeom`, cached in-memory for 1 hour
- **Spatial Analysis Pipeline** — pipeline dijalankan sebagai subprocess lokal oleh operator: preprocessing → zonal statistics → risk analysis → ETL to database
- **Region Selection** — click a kabupaten/kota on the map or select from dropdown; map animates to centroid
- **PDF Report Generation** — ReportLab-based tabular reports with risk statistics per region
- **CSV Export** — filtered data download from analytics endpoint
- **Admin Dashboard** — pipeline status monitoring, data management, run history

## Project Structure

```
PADIS/
├── backend/
│   ├── app/
│   │   ├── routes/          # Flask blueprints
│   │   │   ├── auth/        # Login, register
│   │   │   ├── layers/      # Attribute value endpoints
│   │   │   ├── tiles/       # MVT tile serving
│   │   │   ├── admin/       # Pipeline management
│   │   │   ├── analytics_routes.py
│   │   │   └── report_routes.py
│   │   └── db/              # SQLAlchemy session
│   ├── scripts/             # Geospatial analysis pipeline
│   │   ├── core/            # raster_engine, vector_engine, zonal_engine
│   │   ├── analysis/        # flood, drought, multihazard
│   │   ├── etl/             # Database ETL
│   │   └── pipeline/        # Orchestration
│   ├── run.py               # Flask entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── (main)/      # Public pages
│   │   │   ├── (admin)/     # Admin pages (JWT-protected)
│   │   │   └── (auth)/      # Login/register/reset
│   │   ├── components/
│   │   │   ├── map/         # MapView, MapViewClient, MapCanvas
│   │   │   ├── dashboard/   # Overlay, loading states
│   │   │   ├── charts/      # Recharts wrappers
│   │   │   ├── admin/       # Admin shell and panels
│   │   │   └── layout/      # Navigation
│   │   ├── services/        # fetchLayers.ts — API client
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── next.config.ts
├── docs/                    # Technical documentation
│   ├── architecture.md
│   ├── api.md
│   ├── database.md
│   ├── frontend.md
│   ├── pipeline.md
│   ├── pipeline-operation.md
│   ├── data-requirements.md
│   ├── deployment.md
│   └── padis-dev-commands.md
├── railway.toml             # Railway deployment config
└── README.md
```

## Documentation

### Recommended Reading Order

1. [README](README.md) - orientasi project dan workflow lokal resmi.
2. [Pipeline Operation](docs/pipeline-operation.md) - panduan operator menjalankan dan memantau pipeline.
3. [Data Requirements](docs/data-requirements.md) - standar folder, nama file, dan format data input.
4. [Deployment](docs/deployment.md) - Railway/Vercel setup dan environment production.
5. [PADIS Dev Commands](docs/padis-dev-commands.md) - command debug/developer; bukan workflow utama operator.

| Doc | Description |
|---|---|
| [Architecture](docs/architecture.md) | Desain sistem, alur data, hierarki komponen |
| [API Reference](docs/api.md) | Semua endpoint dengan parameter dan response shape |
| [Database Schema](docs/database.md) | Definisi tabel, indeks, kolom spasial |
| [Frontend](docs/frontend.md) | Struktur komponen, state management, map layers |
| [Analysis Pipeline](docs/pipeline.md) | Tahapan pemrosesan geospasial dan rantai script |
| [Pipeline Operation](docs/pipeline-operation.md) | Panduan operator menjalankan pipeline |
| [Data Requirements](docs/data-requirements.md) | Standar folder, nama file, dan format data input |
| [Deployment](docs/deployment.md) | Railway setup, konfigurasi environment, Gunicorn |
| [PADIS Dev Commands](docs/padis-dev-commands.md) | Command debug/developer dan troubleshooting lokal |

## License

Academic Capstone Project: PADIS — Teknik Geodesi dan Geomatika Institut Teknologi Bandung.
