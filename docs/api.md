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

All admin endpoints require `Authorization: Bearer <token>` where the token was issued for a user with `role = "admin"`.

### GET /api/admin/runs
List all pipeline run records.

### GET /api/admin/status
Get the current pipeline execution status.

**Response:**
```json
{ "status": "running" | "idle" | "error", "current_step": "zonal", "run_id": 42 }
```

### POST /api/admin/run-pipeline
Trigger a new pipeline run.

**Request body:**
```json
{
  "mode": "full" | "preprocess" | "analysis" | "web",
  "hazard": "flood" | "drought" | "multi"
}
```

### POST /api/admin/upload
Upload raster or shapefile data.

**Request:** `multipart/form-data` with file field.

### GET /api/admin/users
List all registered users.

### DELETE /api/admin/users/{id}
Delete a user account.
