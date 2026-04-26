# Database Schema

PostgreSQL 15+ with PostGIS extension. Hosted on Supabase.

## Tables

### regions_adm
Administrative boundary polygons for all kabupaten/kota.

| Column | Type | Description |
|---|---|---|
| `id_kabkota` | `varchar` PK | e.g. `"32.01"` — province.kabupaten code |
| `kab_kota` | `varchar` | Display name, e.g. `"Kab. Bogor"` |
| `prov` | `varchar` | Province name |
| `geom` | `geometry(MultiPolygon, 4326)` | Administrative boundary |

Spatial index on `geom`. This table is the join base for all analytical layers.

### hazards

| Column | Type | Values |
|---|---|---|
| `id` | `integer` PK | |
| `name` | `varchar` | `flood`, `drought`, `multihazard` |

Lookup: flood=1, drought=2, multihazard=3.

### scenarios

| Column | Type | Values |
|---|---|---|
| `id` | `integer` PK | |
| `name` | `varchar` | `nonclimate`, `climate` |

Lookup: nonclimate=1, climate=2.

### return_periods

| Column | Type | Values |
|---|---|---|
| `id` | `integer` PK | |
| `rp` | `integer` | 25, 50, 100, 250 |

Lookup: 25→1, 50→2, 100→3, 250→4.

### runs
Rekaman eksekusi pipeline.

| Column | Type | Description |
|---|---|---|
| `id` | `integer` PK (serial) | Run ID |
| `run_name` | `varchar` | Nama run, e.g. `multi_full_20250427_operator` |
| `created_at` | `timestamp with time zone` | Waktu pipeline dimulai |
| `status` | `varchar` | `running`, `success`, `failed` |
| `is_active` | `boolean` | Apakah run sedang aktif |
| `step` | `varchar` | Tahap saat ini: `preprocess`, `zonal`, `analysis`, `etl` |
| `progress` | `integer` | Persentase kemajuan (0–100) |
| `message` | `text` | Pesan status terakhir dari pipeline |
| `operator_name` | `varchar` | Nama operator yang menjalankan |
| `source` | `varchar` | `local` untuk monitoring run, `NULL` untuk ETL run |

Filter `source = 'local'` digunakan untuk memisahkan monitoring run dari ETL run internal.

### losses
Economic loss per kabupaten per scenario.

| Column | Type | Description |
|---|---|---|
| `id` | `integer` PK (serial) | |
| `id_kabkota` | `varchar` FK | References regions_adm |
| `hazard_id` | `integer` FK | |
| `scenario_id` | `integer` FK | Climate scenario |
| `rp_id` | `integer` FK | Return period |
| `run_id` | `integer` FK | |
| `loss` | `float` | Economic loss in IDR |

Unique constraint on `(id_kabkota, hazard_id, scenario_id, rp_id, run_id)`.

### aal
Annual Average Loss per kabupaten.

| Column | Type | Description |
|---|---|---|
| `id` | `integer` PK (serial) | |
| `id_kabkota` | `varchar` FK | |
| `hazard_id` | `integer` FK | |
| `scenario_id` | `integer` FK | |
| `aal` | `float` | Annual Average Loss in IDR |

Note: AAL does not have a `run_id` or `rp_id` — it is an integrated metric across return periods.

### zonal_kabupaten
Zonal statistics of hazard intensity per kabupaten.

| Column | Type | Description |
|---|---|---|
| `id` | `integer` PK (serial) | |
| `id_kabkota` | `varchar` FK | |
| `hazard_id` | `integer` FK | |
| `scenario_id` | `integer` FK | |
| `rp_id` | `integer` FK | |
| `run_id` | `integer` FK | |
| `mean_value` | `float` | Mean hazard intensity (normalized 0–1) |
| `max_value` | `float` | Max hazard intensity |
| `min_value` | `float` | Min hazard intensity |

### production
Rice production per kabupaten (aggregated across crop types/seasons).

| Column | Type | Description |
|---|---|---|
| `id` | `integer` PK (serial) | |
| `id_kabkota` | `varchar` FK | |
| `total_prod` | `float` | Rice production in tons |
| `year` | `integer` | Data year |

The production endpoint aggregates `SUM(total_prod) GROUP BY id_kabkota`.

### app_users
Application user accounts.

| Column | Type | Description |
|---|---|---|
| `id` | `integer` PK (serial) | |
| `email` | `varchar` UNIQUE | |
| `name` | `varchar` | |
| `password_hash` | `varchar` | bcrypt hash |
| `role` | `varchar` | `user` or `admin` |
| `created_at` | `timestamp` | |
| `reset_token` | `varchar` NULLABLE | Password reset token |
| `reset_token_expiry` | `timestamp` NULLABLE | |

## Key Spatial Operations

### MVT Generation (tiles endpoint)
```sql
SELECT ST_AsMVT(q, 'layer', 4096, 'geom') FROM (
  SELECT
    r.id_kabkota, r.kab_kota, r.prov,
    COALESCE(l.loss, 0) AS loss,
    (l.id_kabkota IS NOT NULL) AS has_data,
    ST_AsMVTGeom(r.geom, ST_TileEnvelope(:z, :x, :y), 4096, 64, true) AS geom
  FROM regions_adm r
  LEFT JOIN losses l ON r.id_kabkota = l.id_kabkota AND ...
  WHERE r.geom && ST_TileEnvelope(:z, :x, :y)
) q
```

### Data Bounds (auto-fit map)
```sql
SELECT
  ST_XMin(ST_Extent(r.geom)) AS min_lng,
  ST_YMin(ST_Extent(r.geom)) AS min_lat,
  ST_XMax(ST_Extent(r.geom)) AS max_lng,
  ST_YMax(ST_Extent(r.geom)) AS max_lat
FROM regions_adm r
INNER JOIN losses l ON r.id_kabkota = l.id_kabkota AND ...
```

### Region Centroids (dropdown zoom)
```sql
SELECT
  ST_X(ST_Centroid(r.geom)) AS centroid_lng,
  ST_Y(ST_Centroid(r.geom)) AS centroid_lat
FROM regions_adm r
```

## Indexes

- `regions_adm.geom` — GIST spatial index (used by `&&` tile envelope filter)
- `losses(id_kabkota, hazard_id, scenario_id, rp_id, run_id)` — composite for filter queries
- `aal(id_kabkota, hazard_id, scenario_id)` — composite
- `zonal_kabupaten(id_kabkota, hazard_id, scenario_id, rp_id, run_id)` — composite
