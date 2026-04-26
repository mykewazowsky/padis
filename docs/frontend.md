# Frontend Reference

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| Next.js | 16.1.7 | App Router, SSR, routing |
| React | 19.2.3 | UI framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| Leaflet | 1.9.4 | Interactive map |
| react-leaflet | 5.0.0 | React bindings for Leaflet |
| Leaflet.VectorGrid | 1.3.0 | MVT tile rendering |
| Recharts | 3.8.0 | Charts |
| simple-statistics | 7.8.9 | Jenks natural breaks classification |
| chroma-js | 3.2.0 | Color interpolation |
| react-select | 5.10.2 | Kabupaten dropdown |
| lucide-react | 1.7.0 | Icons |

---

## Route Structure

```
(main)/
  page.tsx                       ← Landing page
  dashboard/page.tsx             ← Main GIS dashboard (semua state ada di sini)
  about/page.tsx
  cara-kerja/page.tsx
  metodologi/page.tsx

(admin)/                         ← Seluruh grup ini membutuhkan JWT role=admin
  admin/page.tsx                 ← Overview dashboard
  admin/data-management/         ← Cek ketersediaan file data input
  admin/process-control/         ← Trigger pipeline, pilih hazard dan mode
  admin/pipeline-monitor/        ← Monitor progress pipeline via DB
  admin/outputs/                 ← Preview dan download hasil pipeline
  admin/users/                   ← Kelola akun pengguna
  admin/guide/                   ← Panduan operator

(auth)/
  login/page.tsx
  register/page.tsx
  forgot-password/page.tsx
  reset-password/page.tsx
```

---

## Dashboard State (`dashboard/page.tsx`)

The dashboard page is the single source of truth for all map and analytics state.

```typescript
const [scenario, setScenario]     = useState("rp100");
const [hazard, setHazard]         = useState("flood");
const [climate, setClimate]       = useState("nonclimate");
const [runId, setRunId]           = useState(0);
const [selectedRegion, setSelectedRegion] = useState("");
const [layers, setLayers]         = useState({ regions, production, loss, aal, hazard });
const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({ ... });
const [regionCentroids, setRegionCentroids] = useState<Record<string, [number, number]>>({});
const [resetViewSignal, setResetViewSignal] = useState(0);
```

### Data Fetching

On mount and whenever `scenario`, `hazard`, `climate`, or `runId` changes:

```typescript
useEffect(() => {
  fetchAllLayers({ hazard, scenario, climate, runId }).then(setLayers);
}, [hazard, scenario, climate, runId]);
```

`regionCentroids` is extracted from the production layer response (which includes `centroid_lng`, `centroid_lat` from PostGIS).

---

## Map Components

### MapView (`components/map/MapView.tsx`)

Server-safe wrapper. Performs all derived computations from the layer data:

- `selectedFeature` — merges properties from all four layers for the selected region
- `totalLoss` / `totalAal` — sum across all features
- `selectedRegionShare` / `selectedRegionAalShare` — percentage of selected vs. total
- `dataBounds` — spatial extent for Fit-to-Data (from `data_bounds` in API response)
- `isTopRegion` — whether selected region is in top 5 by loss

Renders: `<MapViewClient>` + `<DashboardMapOverlay>`.

### MapViewClient (`components/map/MapViewClient.tsx`)

Dynamic-imported with `ssr: false`. Handles classification:

- Extracts numeric values from FeatureCollections
- Computes Jenks natural breaks via `simple-statistics` (`jenks(values, 5)`)
- Generates color palette using `chroma-js` (5-class sequential)
- Passes `breaks` and `palette` down to MapCanvas

Layer types: `loss`, `aal`, `hazard` use classification. `production` uses flat color.

### MapCanvas (`components/map/core/MapCanvas.tsx`)

The Leaflet `MapContainer` with all child components:

#### VectorGrid Layers

Each active analytical layer mounts a `VectorGrid.Protobuf` pointing to `/api/tiles/{layer}`.

The `vectorTileLayerStyles` function receives feature properties and returns Leaflet path styles:
```typescript
function getColor(value: number, breaks: number[], palette: string[]): string { ... }
```

Selected region is highlighted with a distinct `fillColor` and `weight`.

#### Internal Components

| Component | Purpose |
|---|---|
| `FitBounds` | Fires `map.fitBounds(all_regions)` once on initial mount |
| `ResetViewController` | Handles reset button + Fit-to-Data using `dataBounds` |
| `ZoomToRegion` | Watches `selectedRegion` from dropdown → `map.flyTo(centroid, 9)` |
| `Marker[]` | Kabupaten name labels, visible at zoom ≥ 7 with adaptive font size |
| `MapLegendPanel` | Rendered only when analysis layer is active with data |

#### zoomSourceRef Pattern

Prevents double-zoom when user clicks directly on the map:

```typescript
const zoomSourceRef = useRef<"click" | null>(null);

// In VT click handler:
zoomSourceRef.current = "click";
onRegionSelect(name);
map.flyTo(ev.latlng, 9);

// In ZoomToRegion effect:
if (zoomSourceRef.current === "click") {
  zoomSourceRef.current = null;
  return; // skip — map click already zoomed
}
map.flyTo(centroid, 9);
```

#### Kabupaten Labels

Appear at zoom ≥ 7 when any tile layer is active, or zoom ≥ 8 for regions-only.

Font size and opacity scale with zoom level:
```typescript
const fontSize = zoom < 8 ? 7 : zoom < 9 ? 8 : zoom < 10 ? 9 : 10;
const opacity  = zoom < 8 ? 0.6 : zoom < 9 ? 0.75 : zoom < 10 ? 0.9 : 1.0;
```

Labels use a `DivIcon` with multi-layer `text-shadow` for a halo effect on dark backgrounds.

---

## Layer Control

### MapLayerControlPanel (`components/map/core/MapLayerControlPanel.tsx`)

Toggle panel for layer visibility. `LayerKey` type:

```typescript
type LayerKey = "regions" | "production" | "loss" | "aal" | "hazard";
```

`activeLayers` is `Record<LayerKey, boolean>`. Parent state in `dashboard/page.tsx`.

### MapLegendPanel (`components/map/core/MapLegendPanel.tsx`)

Rendered only when `hasAnalysisLayer && legendItems.length > 0`.

Props:
- `legendItems: { color: string; label: string }[]`
- `title: string` — dynamic, matches active layer
- `showTop5Indicator: boolean` — shown only when loss layer is active

---

## Overlay

### DashboardMapOverlay (`components/dashboard/DashboardMapOverlay.tsx`)

Floating card over the map. Contains:
- Reset View / Fit to Data buttons
- "Wilayah Terpilih" card (visible when region selected)
  - Shows: kab_kota, province, loss (IDR), aal (IDR), mean_value, region share %
  - Production value intentionally excluded
- Download CSV button
- Generate Report button

Buttons collapse to icon-only on mobile (`<span className="hidden sm:inline">`).

---

## Services

### fetchLayers.ts (`services/fetchLayers.ts`)

| Export | Description |
|---|---|
| `fetchLatestRunId()` | GET /api/runs/latest → `run_id: number` |
| `fetchAllLayers(params)` | Parallel fetch of all 4 layer value endpoints |
| `buildTileUrl(layer, ...)` | Constructs Leaflet tile URL template string |
| `BASE_URL` | `process.env.NEXT_PUBLIC_API_BASE_URL` (throws if missing or localhost) |

`fetchAllLayers` returns `{ regions: null, production, loss, aal, hazard }` as FeatureCollections with `geometry: null`.

---

## Types

### `types/map.ts`

```typescript
type DataBounds = {
  min_lng: number; min_lat: number;
  max_lng: number; max_lat: number;
};

type GeoJsonData = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: null;
    properties: LayerItem;
  }>;
  data_bounds?: DataBounds | null;
};
```

---

## Styling Conventions

- Tailwind CSS v4 utility classes throughout
- Responsive breakpoints used: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)
- Map container uses `h-full w-full` — height is set by parent grid row in dashboard layout
- Mobile: overlay buttons icon-only, filter grid single-column, summary cards 1-column
