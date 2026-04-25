# Geospatial Analysis Pipeline

The pipeline processes raw raster/vector data into risk metrics stored in the database. It is triggered from the Admin dashboard via `POST /api/admin/run-pipeline`.

## Pipeline Modes

| Mode | Steps Executed | Use Case |
|---|---|---|
| `full` | preprocess → zonal → analysis → etl | Full rerun from raw data |
| `preprocess` | preprocess only | Normalize new raster inputs |
| `analysis` | analysis → etl | Recompute risk from existing zonal stats |
| `web` | etl only | Re-push existing results to DB |

## Hazard Types

| Type | Description |
|---|---|
| `flood` | Fluvial flood hazard |
| `drought` | Agricultural drought hazard |
| `multi` | Combined multi-hazard index |

## Entry Point

```
backend/scripts/main.py --mode <mode> --hazard <type>
```

Flask spawns this as a subprocess. Progress is tracked in a shared status object polled by `GET /api/admin/status`.

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
- `max_value` — max pixel value
- `min_value` — min pixel value

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
├── raw/           # Uploaded raster inputs (GeoTIFF)
├── processed/     # Normalized rasters, reprojected vectors
├── zonal/         # Zonal statistics outputs (CSV/JSON)
└── analysis/      # Risk analysis outputs (CSV/JSON)
```

## Adding New Data

1. Upload raster via Admin → Upload (`POST /api/admin/upload`)
2. Trigger pipeline from Admin dashboard
3. New `run_id` appears in `GET /api/runs/latest`
4. Frontend auto-fetches new data when `run_id` changes
