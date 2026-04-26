# API Reference

Base URL: `NEXT_PUBLIC_API_BASE_URL` (configured per environment)

All endpoints return JSON. Errors return `{"error": "<message>"}` with an appropriate HTTP status code.

---

## Authentication

### POST /api/auth/login
Authenticate a user and receive a JWT token.

**Request body:**
```json
{ "email": "user@example.com", "password": "password123" }
```

**Response:**
```json
{ "token": "<jwt>", "role": "admin" | "user" }
```

Token is HS256, expires in 8 hours. Store in `localStorage` and send as `Authorization: Bearer <token>`.

### POST /api/auth/register
Register a new user account.

**Request body:**
```json
{ "email": "user@example.com", "password": "password123", "name": "Full Name" }
```

### POST /api/auth/forgot-password
Send a password reset email.

**Request body:**
```json
{ "email": "user@example.com" }
```

### POST /api/auth/reset-password
Reset password using token from email.

**Request body:**
```json
{ "token": "<reset-token>", "password": "newpassword123" }
```

---

## Runs

### GET /api/runs/latest
Returns the most recent pipeline run ID.

**Response:**
```json
{ "run_id": 42 }
```

---

## Layer Values (geometry-free)

All layer value endpoints return attribute data without geometry. Used by the frontend for classification and overlay card display. Actual map rendering uses MVT tiles (see below).

### GET /api/layers/values/loss

**Query params:**

| Param | Required | Example | Description |
|---|---|---|---|
| `hazard` | yes | `flood` | `flood`, `drought`, `multihazard` |
| `scenario` | yes | `rp100` | Return period: `rp25`, `rp50`, `rp100`, `rp250` |
| `climate` | yes | `nonclimate` | `nonclimate` or `climate` |
| `run_id` | yes | `42` | Pipeline run ID |

**Response:**
```json
{
  "data": [
    { "id_kabkota": "32.01", "kab_kota": "Kab. Bogor", "prov": "Jawa Barat",
      "loss": 125000000.0, "has_data": true }
  ],
  "data_bounds": { "min_lng": 106.0, "min_lat": -7.5, "max_lng": 108.0, "max_lat": -6.0 }
}
```

`has_data: false` when the region has no data for the current filter combination. `data_bounds` is the spatial extent of data-bearing regions (used by frontend for map `fitBounds`).

### GET /api/layers/values/aal

**Query params:**

| Param | Required | Example |
|---|---|---|
| `hazard` | yes | `flood` |
| `climate` | yes | `nonclimate` |

**Response:**
```json
{
  "data": [
    { "id_kabkota": "32.01", "kab_kota": "Kab. Bogor", "prov": "Jawa Barat",
      "aal": 45000000.0, "has_data": true }
  ],
  "data_bounds": { ... }
}
```

### GET /api/layers/values/hazard

> **Note on param naming:** `scenario` param carries the climate value; `rp` param carries the return period. This matches the database column semantics for `zonal_kabupaten`.

**Query params:**

| Param | Required | Example | Description |
|---|---|---|---|
| `hazard` | yes | `flood` | Hazard type |
| `scenario` | yes | `nonclimate` | Climate scenario (nonclimate/climate) |
| `rp` | yes | `rp100` | Return period |
| `run_id` | yes | `42` | Run ID |

**Response:**
```json
{
  "data": [
    { "id_kabkota": "32.01", "kab_kota": "Kab. Bogor", "prov": "Jawa Barat",
      "mean_value": 1.23, "has_data": true }
  ],
  "data_bounds": { ... }
}
```

### GET /api/layers/values/production
No query params. Returns aggregated rice production totals + region centroids.

**Response:**
```json
{
  "data": [
    { "id_kabkota": "32.01", "kab_kota": "Kab. Bogor", "prov": "Jawa Barat",
      "total_prod": 185000.0, "centroid_lng": 106.82, "centroid_lat": -6.53 }
  ]
}
```

### GET /api/layers/values/regions
Returns all kabupaten/kota names and provinces (no geometry).

---

## MVT Tiles

MVT tiles are served as binary Protocol Buffer data. Leaflet.VectorGrid fetches these automatically using the tile URL template.

### GET /api/tiles/{layer}/{z}/{x}/{y}

**Path params:**

| Param | Values |
|---|---|
| `layer` | `loss`, `aal`, `hazard`, `production`, `regions` |
| `z`, `x`, `y` | Standard tile coordinates |

**Query params:** Same as corresponding `/values/` endpoint (hazard, scenario, climate, run_id).

**Response:** `Content-Type: application/x-protobuf`, binary MVT data.

Tiles include all region polygons. Regions without data for the current filter have `has_data=false` in the tile properties — the frontend styles these gray.

Tile URL template used by frontend:
```
{BASE_URL}/api/tiles/{layer}/{z}/{x}/{y}?hazard=...&scenario=...&climate=...&run_id=...
```

---

## Analytics

### GET /api/analytics/summary

Returns aggregate statistics for the current filter combination.

**Query params:** `hazard`, `scenario`, `climate`, `run_id`

**Response:**
```json
{
  "total_loss": 5200000000.0,
  "total_aal": 980000000.0,
  "total_production": 45000000.0,
  "region_count": 198
}
```

### GET /api/analytics/top-regions

Returns top kabupaten/kota by loss value.

**Query params:** `hazard`, `scenario`, `climate`, `run_id`, `limit` (default 5)

### GET /api/analytics/download-csv

Returns a CSV file with all region data for the current filter.

**Query params:** `hazard`, `scenario`, `climate`, `run_id`

**Response:** `Content-Type: text/csv`, file download.

---

## Reports

### POST /api/report/generate

Generates a PDF report using ReportLab.

**Request body:**
```json
{
  "hazard": "flood",
  "scenario": "rp100",
  "climate": "nonclimate",
  "run_id": 42
}
```

**Response:** `Content-Type: application/pdf`, binary PDF file.

---

## Admin (JWT required, admin role)

Semua endpoint admin membutuhkan `Authorization: Bearer <token>` dengan token yang diterbitkan untuk user ber-role `admin`.

> **Catatan arsitektur:** Pipeline tidak dijalankan via HTTP request ke Flask. `POST /api/admin/start-pipeline` men-spawn subprocess Python secara fire-and-forget. Progress pipeline dibaca dari tabel `runs` di database, bukan dari state in-memory Flask.

### GET /api/admin/run-status
Status pipeline terbaru (read dari tabel `runs`).

**Response:**
```json
{
  "run": {
    "id": 5,
    "run_name": "multi_full_20250427_operator",
    "created_at": "2025-04-27T08:30:00+00:00",
    "status": "running",
    "is_active": true,
    "step": "zonal",
    "progress": 42,
    "message": "Zonal statistics flood selesai",
    "operator_name": "operator",
    "source": "local"
  }
}
```

`run: null` jika belum ada run.

### GET /api/admin/process-status
Status pipeline dalam format lama (backward compat). Shape berbeda dari `run-status`.

**Response:**
```json
{
  "status": "running" | "success" | "failed" | "idle",
  "message": "...",
  "progress_percent": 42,
  "current_script": "zonal",
  "hazard": "multi"
}
```

### GET /api/admin/runs
Daftar monitoring run terbaru (hanya `source='local'`).

**Query params:**

| Param | Default | Deskripsi |
|---|---|---|
| `limit` | `10` | Jumlah run (max 50) |
| `operator_name` | — | Filter exact match |
| `hazard` | — | Filter: `flood`, `drought`, `multi` |

**Response:**
```json
{ "runs": [...], "count": 5, "limit": 10 }
```

### POST /api/admin/start-pipeline
Jalankan pipeline sebagai subprocess lokal (fire-and-forget).

**Request body:**
```json
{
  "mode": "full" | "preprocess" | "analysis" | "web",
  "hazard": "flood" | "drought" | "multi",
  "operator": "nama_operator"
}
```

**Response:**
- `202` — pipeline berhasil di-spawn, berisi `pid`, `mode`, `hazard`, `operator`
- `409` — ada pipeline yang sedang berjalan (belum stale), berisi `active_run`
- `400` — parameter tidak valid
- `500` — gagal spawn subprocess

### GET /api/admin/dependencies
Cek ketersediaan file output per hazard.

**Query params:** `hazard` (`flood`, `drought`, `multi`)

**Response:**
```json
{
  "hazard": "multi",
  "all_ok": true,
  "checks": [
    { "type": "output", "label": "Flood AAL", "exists": true },
    ...
  ]
}
```

### GET /api/admin/outputs
Daftar file di folder output pipeline.

### GET /api/admin/outputs/preview
Preview isi file output (GeoJSON atau CSV).

**Query params:** `filename`

### GET /api/admin/outputs/download
Download file output.

**Query params:** `filename`

### GET /api/admin/data
Ringkasan data untuk admin dashboard.

### GET /api/admin/users
Daftar semua user terdaftar.

### PATCH /api/admin/users/{id}
Update role atau status user.

### ~~POST /api/admin/run-analysis~~ (410 Gone)
### ~~POST /api/admin/finish-analysis~~ (410 Gone)

Kedua endpoint ini sudah dihapus. Gunakan `start-pipeline` dan baca status via `run-status`.
