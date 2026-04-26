# Geospatial Analysis Pipeline

Pipeline memproses data raster/vector mentah menjadi metrik risiko yang disimpan di database. Pipeline dijalankan sebagai subprocess Python lokal oleh operator melalui Admin UI (`POST /api/admin/start-pipeline`) atau langsung via CLI.

> Pipeline tidak dijalankan di dalam proses Flask. Subprocess berjalan secara fire-and-forget; progress dilaporkan ke tabel `runs` di database.

## Pipeline Modes

| Mode | Steps Executed | Use Case |
|---|---|---|
| `full` | preprocess → zonal → analysis → etl | Full rerun from raw data |
| `preprocess` | preprocess only | Normalize new raster inputs |
| `analysis` | analysis only | Recompute risk from existing zonal stats (does not write to DB) |
| `web` | etl only | Re-push existing results to DB |

> **Catatan `full + multi`:** Mode `full` dengan hazard `multi` melewati tahap preprocess dan zonal — ia menggunakan output flood dan drought yang sudah ada. Jalankan `full flood` dan `full drought` terlebih dahulu sebelum `full multi`.

## Hazard Types

| Type | Description |
|---|---|
| `flood` | Fluvial flood hazard |
| `drought` | Agricultural drought hazard |
| `multi` | Combined multi-hazard index |

## Entry Point

```bash
python backend/scripts/main.py --mode <mode> --hazard <hazard> --operator <name>
```

Flask men-spawn ini sebagai subprocess. Progress dilaporkan langsung ke tabel `runs` di database dan dapat dipantau via `GET /api/admin/run-status`.

## Script Chain

### 1. Preprocessing — `run_preprocess.py`

Calls `scripts/core/raster_engine.py` and `scripts/core/vector_engine.py`.

**Raster preprocessing (`raster_engine.py`):**
- Reads raw hazard raster (GeoTIFF) via Rasterio
- Reprojects to EPSG:4326 if needed
- Normalizes values to 0–1 range
  - Flood: dynamic min/max normalization
  - Drought: fixed threshold normalization (`-6.5` to `-2.0`, P1-based)
- Clips to study area extent
- Writes preprocessed raster to `data/processed/`

**Vector preprocessing (`vector_engine.py`):**
- Reads administrative boundary shapefile via Fiona/GeoPandas
- Validates and repairs geometries with Shapely
- Standardizes `id_kabkota` codes
- Writes to `data/processed/`

### 2. Zonal Statistics — `run_zonal.py`

Calls `scripts/core/zonal_engine.py`.

For each kabupaten polygon, computes statistics from the preprocessed hazard raster:
- `mean_value` — mean pixel value within polygon

Uses Rasterio's `mask` module for pixel extraction. Results written to `data/zonal/`.

### 3. Risk Analysis

Three separate scripts, each calling hazard-specific analysis modules:

#### Flood — `run_analysis_flood.py` → `scripts/analysis/flood/`
- Loads zonal hazard statistics
- Joins with production data to get exposed asset value
- Applies flood damage function (depth-damage curve)
- Computes loss per return period per kabupaten
- Integrates across return periods for AAL (trapezoidal integration)

#### Drought — `run_analysis_drought.py` → `scripts/analysis/drought/`
- Loads normalized SPEI/SPI raster zonal statistics
- Applies drought exposure index to production value
- Computes production loss per scenario
- Integrates for AAL

#### Multi-hazard — `run_analysis_multi.py` → `scripts/analysis/multihazard/`
- Combines flood and drought risk indices
- Weighted aggregation by hazard weight parameters
- Produces composite risk index per kabupaten

### 4. ETL — `run_etl.py` → `scripts/etl/`

Loads analysis output files and writes to Supabase:
- Creates a new record in `runs` table → gets `run_id`
- Upserts rows into `losses` (hazard × scenario × rp × run_id)
- Upserts rows into `aal`
- Upserts rows into `zonal_kabupaten`
- Upserts rows into `production` (if new production data was processed)

Uses SQLAlchemy bulk insert with conflict resolution (`ON CONFLICT DO UPDATE`).

## Configuration

Pipeline parameters are in `scripts/config/`:
- Hazard weight coefficients for multi-hazard index
- Damage function parameters
- Return period integration weights (25, 50, 100, 250 years)
- Input/output data paths

## Data Directories

```
backend/data/
├── raw/
│   ├── administrasi/   # regions.gpkg
│   ├── exposure/       # sawah_selected.gpkg, totalproduksipadi.csv
│   └── hazard/         # flood_r*.tif, drought_r*.tif (16 file total)
├── processed/          # Raster ternormalisasi, vector terproyeksi ulang
├── zonal/              # Output zonal statistics (CSV/JSON)
└── output/
    └── analysis/       # Output pipeline final (GPKG, CSV) — dibaca Admin UI Outputs
```

Lihat `docs/data-requirements.md` untuk daftar lengkap nama file dan format yang dibutuhkan.

## Menjalankan Pipeline

1. Tempatkan semua file data input di folder `raw/` sesuai standar
2. Buka Admin UI → Process Control → pilih hazard dan mode → klik Jalankan
3. Pantau progress di Admin UI → Pipeline Monitor
4. Hasil tersedia di Admin UI → Outputs setelah ETL selesai
5. `run_id` baru muncul via `GET /api/runs/latest`; frontend otomatis refetch data
