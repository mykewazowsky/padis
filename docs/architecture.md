# Architecture

## System Overview

PADIS is split into two independently deployed services — a Flask REST API (backend) and a Next.js frontend — both backed by a single Supabase PostgreSQL+PostGIS database.

```
Browser
  └── Next.js (Vercel / Railway)
        ├── API requests  ──→  Flask API (Railway)
        │                          └── SQLAlchemy ──→ Supabase PostgreSQL+PostGIS
        └── MVT tiles     ──→  Flask /api/tiles/{layer}
```

## Data Flow

### Map Rendering (read path)

```
1. User selects hazard / scenario / climate / return period filters
2. dashboard/page.tsx calls fetchAllLayers() in parallel:
     GET /api/layers/values/loss?...
     GET /api/layers/values/aal?...
     GET /api/layers/values/hazard?...
     GET /api/layers/values/production
3. Responses: FeatureCollections with geometry: null (attribute data only)
4. MapViewClient builds Jenks/quantile classification breaks from these values
5. MapCanvas mounts Leaflet.VectorGrid TileLayer for each active layer:
     GET /api/tiles/{layer}/{z}/{x}/{y}?...
6. Each tile request: Flask queries PostGIS ST_AsMVTGeom, returns binary MVT
7. VectorGrid renders tiles; MapCanvas style function colors each feature using
   breaks computed in step 4
```

### Region Selection Flow

```
1a. User clicks polygon on map:
    VT click handler fires → zoomSourceRef.current = "click" → onRegionSelect(name)
    map.flyTo(ev.latlng, 9)  (immediate zoom, no ZoomToRegion effect)

1b. User picks from kabupaten dropdown:
    handleRegionChange(name) → setSelectedRegion(name)
    ZoomToRegion useEffect fires → zoomSourceRef.current is null →
    reads regionCentroids[name] → map.flyTo(centroid, 9)

2. selectedRegion propagates to MapView:
   - selectedFeature computed from all layer FeatureCollections (merged properties)
   - DashboardMapOverlay renders the selected region info card
   - MapCanvas highlights the selected polygon via VT style function
```

### Admin Pipeline Flow

```
1. Admin uploads raster/shapefile via POST /api/admin/upload
2. Admin triggers pipeline via POST /api/admin/run-pipeline
3. Flask spawns subprocess: python scripts/main.py --mode <mode> --hazard <type>
4. Pipeline stages:
   preprocess → zonal → analysis → etl
5. ETL writes results to: losses, aal, zonal_kabupaten, production tables
6. Admin polls GET /api/admin/status for progress
7. New run_id becomes available via GET /api/runs/latest
8. Frontend refetches all layers with new run_id
```

## Backend Architecture

### Flask App Factory

```
backend/
├── run.py              # Entry point: from app import create_app; app = create_app()
└── app/
    ├── __init__.py     # create_app() — registers blueprints, CORS
    ├── db/
    │   └── session.py  # SQLAlchemy SessionLocal factory
    └── routes/
        ├── auth/       # Blueprint: /api/auth
        ├── layers/     # Blueprint: /api/layers
        ├── tiles/      # Blueprint: /api/tiles
        ├── admin/      # Blueprint: /api/admin
        ├── analytics_routes.py   # Blueprint: /api/analytics
        └── report_routes.py      # Blueprint: /api/report
```

### Blueprint Registration

Each blueprint is registered with a URL prefix. The `layers` blueprint contains multiple sub-modules (loss, aal, hazard, production, regions, values) imported via `__init__.py`.

### MVT Tile Cache

Tiles are cached in-process using a Python `dict` keyed by `(layer, z, x, y, hazard, scenario, climate, run_id)`. Cache entries expire after 3600 seconds. The cache resets on server restart.

```python
# tile_cache.py
_cache: dict[tuple, tuple[bytes, float]] = {}
CACHE_TTL = 3600
```

## Frontend Architecture

### Next.js App Router Structure

```
src/app/
├── layout.tsx           # Root layout (fonts, global CSS)
├── (main)/              # Route group — no shared layout prefix
│   ├── layout.tsx       # Main layout with Navbar
│   ├── page.tsx         # Landing page
│   ├── dashboard/       # Main GIS dashboard
│   ├── about/           # About page
│   ├── cara-kerja/      # How-it-works page
│   └── metodologi/      # Methodology page
├── (admin)/             # Route group — admin layout
│   ├── layout.tsx       # Admin shell wrapper
│   └── admin/           # Admin dashboard
└── (auth)/              # Route group — auth layout
    ├── login/
    ├── register/
    ├── forgot-password/
    └── reset-password/
```

### State Management

All dashboard state lives in `dashboard/page.tsx` as React `useState` hooks. There is no global state library.

| State | Type | Purpose |
|---|---|---|
| `scenario` | `string` | Selected return period (rp25/rp50/rp100/rp250) |
| `hazard` | `string` | Selected hazard type |
| `climate` | `string` | Climate scenario (nonclimate/climate) |
| `runId` | `number` | Latest pipeline run ID |
| `selectedRegion` | `string` | Lowercase kabupaten name |
| `layers` | `object` | GeoJSON-like FeatureCollections per layer |
| `activeLayers` | `Record<LayerKey, boolean>` | Layer visibility toggles |
| `regionCentroids` | `Record<string, [lat, lng]>` | Centroid lookup for dropdown zoom |

### Map Component Hierarchy

```
MapView (server-safe wrapper)
└── MapViewClient (dynamic import, SSR disabled)
    ├── computes classification breaks (Jenks via simple-statistics)
    └── MapCanvas (react-leaflet MapContainer)
        ├── TileLayer (basemap — OpenStreetMap)
        ├── VectorGrid (analysis layers: loss, aal, hazard)
        ├── VectorGrid (regions/batas administrasi)
        ├── VectorGrid (production/sawah)
        ├── FitBounds (one-shot initial fitBounds)
        ├── ResetViewController (handles reset + fit-to-data)
        ├── ZoomToRegion (handles dropdown → centroid zoom)
        ├── Marker[] (kabupaten labels at zoom ≥ 7)
        └── MapLegendPanel (conditional: analysis layers only)
```

### Layer Priority Rules

When multiple layers are active simultaneously, these rules apply:

1. **Legend and formatting**: `hazard > loss > aal > production`
   - Production is always flat-colored (no classification, no legend)
2. **Tooltip values** (else-if chain in `createTooltipHtml`):
   - hazard → `mean_value`
   - loss → `loss`
   - aal → `aal`
   - production → `total_prod`
3. **Map fitBounds priority**: `loss > aal > hazard`
   - Uses `data_bounds` from API response (spatial extent of data-bearing regions)
