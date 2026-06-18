# Dokumentasi Database

PADIS memakai PostgreSQL + PostGIS. Database menyimpan batas administrasi, wilayah sawah, produksi padi, hasil analisis hazard, metadata run, dan user aplikasi.

## Tabel Referensi

### `hazards`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `name` | varchar | `flood`, `drought`, `multihazard`. |

Lookup yang dipakai aplikasi:

```text
flood = 1
drought = 2
multihazard = 3
```

### `scenarios`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `name` | varchar | `nonclimate` atau `climate`. |

### `return_periods`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `rp` | integer | 25, 50, 100, 250. |

## Tabel Spasial dan Produksi

### `regions_adm`

Batas administrasi kabupaten/kota.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id_kabkota` | varchar | Kode wilayah, contoh `32.01`. |
| `kab_kota` | varchar | Nama kabupaten/kota. |
| `prov` | varchar | Nama provinsi. |
| `geom` | geometry | MultiPolygon EPSG:4326. |

Tabel ini menjadi basis join untuk tile, values, report, dan analitik.

### `regions_sawah`

Wilayah sawah hasil proses vector atau agregasi exposure.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id_kabkota` | varchar | Kode wilayah. |
| `geom` | geometry | Geometri sawah/agregasi sawah. |

### `production`

Produksi padi per wilayah.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `id_kabkota` | varchar | Kode wilayah. |
| `total_prod` | float | Total produksi padi. |
| `year` | integer | Tahun data jika tersedia. |

Endpoint production melakukan agregasi per `id_kabkota`.

## Tabel Hasil Analisis

### `losses`

Nilai kerugian ekonomi per wilayah, hazard, scenario, return period, dan run.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `id_kabkota` | varchar | Kode wilayah. |
| `hazard_id` | integer | FK ke `hazards`. |
| `scenario_id` | integer | FK ke `scenarios`. |
| `rp_id` | integer | FK ke `return_periods`. |
| `run_id` | integer | FK ke `runs`. |
| `loss` | float | Nilai kerugian. |

Unique constraint:

```text
(id_kabkota, hazard_id, scenario_id, rp_id, run_id)
```

### `aal`

Average Annual Loss per wilayah, hazard, scenario, dan run.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `id_kabkota` | varchar | Kode wilayah. |
| `hazard_id` | integer | FK ke `hazards`. |
| `scenario_id` | integer | FK ke `scenarios`. |
| `run_id` | integer | FK ke `runs`. |
| `aal` | float | Nilai Average Annual Loss. |

Unique constraint:

```text
(id_kabkota, hazard_id, scenario_id, run_id)
```

### `zonal_kabupaten`

Statistik zonal hazard per wilayah, hazard, scenario, return period, dan run.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `id_kabkota` | varchar | Kode wilayah. |
| `hazard_id` | integer | FK ke `hazards`. |
| `scenario_id` | integer | FK ke `scenarios`. |
| `rp_id` | integer | FK ke `return_periods`. |
| `run_id` | integer | FK ke `runs`. |
| `mean_value` | float | Nilai rata-rata hazard. |
| `max_value` | float | Nilai maksimum jika tersedia. |
| `min_value` | float | Nilai minimum jika tersedia. |

Unique constraint:

```text
(id_kabkota, hazard_id, scenario_id, rp_id, run_id)
```

## Tabel Run

### `runs`

Metadata eksekusi pipeline.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | integer | Primary key. |
| `run_name` | varchar | Nama run. |
| `created_at` | timestamptz | Waktu mulai. |
| `finished_at` | timestamp | Waktu selesai. |
| `status` | varchar | `running`, `success`, `failed`, `stopped`, atau status backfill metadata jika relevan. |
| `is_active` | boolean | Run yang dipakai dashboard. |
| `step` | varchar | Tahap aktif. |
| `progress` | integer | Progres 0-100. |
| `message` | text | Pesan status terakhir. |
| `operator_name` | varchar | Nama operator. |
| `source` | varchar | `local` untuk run operator, `etl` untuk ETL standalone jika ada. |

Satu run aktif dipilih melalui `is_active=true`. Migration `004_runs_active_management.sql` menambahkan `finished_at` dan index partial untuk run aktif.

### `run_metadata`

Manifest metadata per run. Tabel ini ditambahkan oleh migration `006_add_run_metadata.sql`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | serial | Primary key. |
| `run_id` | integer unique | FK ke `runs(id)`. |
| `hazard` | text | Hazard yang direkam, misalnya `flood`, `drought`, atau `multi`. |
| `status` | text | Status metadata/run saat metadata disinkronkan. |
| `metadata_version` | text | Versi skema metadata manifest. |
| `metadata_status` | text | `complete`, `partial`, atau `backfilled_partial`. |
| `metadata_path` | text | Lokasi file JSON lokal jika tersedia. |
| `metadata` | jsonb | Isi lengkap file `run_<id>_metadata.json`. |
| `created_at` | timestamp | Waktu baris dibuat. |
| `updated_at` | timestamp | Waktu metadata terakhir diperbarui. |

Kolom `metadata` menyimpan JSON lengkap untuk audit dan unduhan. Kolom ringkasan dipakai agar Admin/API dapat melakukan query cepat tanpa membongkar seluruh JSON.

## Tabel User

### `app_users`

Akun aplikasi.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid/integer sesuai schema aktif | Primary key. |
| `email` | varchar | Email unik. |
| `name` | varchar | Nama user. |
| `password_hash` | varchar | Hash password. |
| `role` | varchar | `admin` atau `user`. |
| `status` | varchar | Status user jika kolom tersedia. |
| `created_at` | timestamp | Waktu dibuat. |

### `password_reset_tokens`

Token reset password.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | Primary key. |
| `user_id` | uuid | FK ke user. |
| `token_hash` | text | SHA-256 hex digest dari raw JWT reset. Nilai plaintext tidak disimpan. |
| `created_at` | timestamptz | Waktu dibuat. |
| `expires_at` | timestamptz | Waktu kedaluwarsa. |
| `used_at` | timestamptz | Waktu dipakai. |

### `admin_audit_log`

Log aksi admin. Dibuat otomatis oleh backend saat startup.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | Primary key, default `gen_random_uuid()`. |
| `admin_id` | text | ID admin yang melakukan aksi. |
| `admin_email` | text | Email admin. |
| `action` | text | Nama aksi, contoh `role_changed`, `status_changed`, `password_reset_completed`. |
| `target_type` | text | Tipe objek yang diubah, contoh `user`. |
| `target_id` | text | ID objek yang diubah. |
| `detail` | text | JSON string berisi detail perubahan. |
| `ip_address` | text | IP address request. |
| `created_at` | timestamptz | Waktu aksi, default `NOW()`. |

Tabel ini tidak memerlukan migration manual. Backend membuat tabel ini dengan `CREATE TABLE IF NOT EXISTS` saat startup.

## Pola Query Utama

### Tile MVT

Endpoint tile melakukan join `regions_adm` dengan tabel analisis, lalu membentuk MVT memakai PostGIS:

```sql
SELECT ST_AsMVT(q, 'layer', 4096, 'geom')
FROM (
  SELECT
    r.id_kabkota,
    r.kab_kota,
    r.prov,
    COALESCE(l.loss, 0) AS loss,
    (l.id_kabkota IS NOT NULL) AS has_data,
    ST_AsMVTGeom(r.geom, ST_TileEnvelope(:z, :x, :y), 4096, 64, true) AS geom
  FROM regions_adm r
  LEFT JOIN losses l ON ...
  WHERE r.geom && ST_TileEnvelope(:z, :x, :y)
) q;
```

### Data Bounds

Backend menghitung extent wilayah yang punya data untuk fitur Fit to Data:

```sql
SELECT
  ST_XMin(ST_Extent(r.geom)) AS min_lng,
  ST_YMin(ST_Extent(r.geom)) AS min_lat,
  ST_XMax(ST_Extent(r.geom)) AS max_lng,
  ST_YMax(ST_Extent(r.geom)) AS max_lat
FROM regions_adm r
JOIN losses l ON ...
```

## Migration

File migration manual ada di:

```text
backend/migrations/
```

Migration penting:

- `001_mvt_indexes.sql`: index untuk tile MVT.
- `002_runs_tracking_columns.sql`: kolom tracking run.
- `003_runs_created_at_index.sql`: index waktu run.
- `004_runs_active_management.sql`: `finished_at` dan index run aktif.
- `005_password_reset_tokens.sql`: tabel token reset password.
- `006_add_run_metadata.sql`: tabel `run_metadata` dan index metadata JSONB.

Tabel `admin_audit_log` tidak memerlukan migration file. Backend membuatnya otomatis saat startup.

Jalankan migration sesuai kebutuhan environment database.
