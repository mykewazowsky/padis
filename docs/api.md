# Referensi API PADIS

Base URL backend di frontend diatur melalui:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Semua endpoint admin membutuhkan token JWT admin. Token dikirim dengan header:

```http
Authorization: Bearer <token>
```

## Auth

### POST `/api/register`

Mendaftarkan user baru.

Rate limit: **10 per jam** per IP.

Body:

```json
{
  "email": "user@example.com",
  "password": "password",
  "name": "Nama User"
}
```

### POST `/api/login`

Login dan menerima token JWT.

Rate limit: **20 per menit, 100 per jam** per IP.

Body:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response berisi token, data user, dan role.

### GET `/api/me`

Mengambil user saat ini dari token. Membutuhkan JWT.

### POST `/api/logout`

Logout sisi client. Backend mengembalikan status sukses. Membutuhkan JWT.

### POST `/api/forgot-password`

Meminta email reset password.

Rate limit: **5 per jam** per IP.

### POST `/api/reset-password`

Mengganti password memakai token reset.

Rate limit: **10 per jam** per IP.

Token yang dikirim adalah raw JWT yang diterima user dari email. Backend memverifikasi dengan membandingkan SHA-256 hash dari token tersebut.

## Run Aktif dan Analitik

### GET `/api/runs/latest`

Mengembalikan `run_id` aktif yang dipakai dashboard. Backend memprioritaskan run aktif (`is_active=true`) dan fallback ke run terbaru jika diperlukan.

### GET `/api/aal-summary`

Ringkasan AAL untuk hazard dan run tertentu.

Query umum:

| Param | Contoh |
|---|---|
| `hazard` | `flood`, `drought`, `multihazard` |
| `run_id` | `12` |

### GET `/api/aal-summary-all-hazards`

Ringkasan AAL lintas hazard untuk chart perbandingan.

### GET `/api/loss-summary`

Ringkasan loss untuk hazard, scenario, climate, dan run.

### GET `/api/loss-summary-compare-climate`

Membandingkan total loss non-climate dan climate untuk hazard terpilih.

### GET `/api/top-regions`

Daftar wilayah dengan loss tertinggi.

Query umum:

| Param | Contoh |
|---|---|
| `hazard` | `flood` |
| `scenario` | `rp100` |
| `climate` | `nonclimate` |
| `run_id` | `12` |
| `limit` | `10` |

### GET `/api/hazard-breakdown`

Breakdown nilai hazard/loss untuk kebutuhan analitik.

## Layer Values

Endpoint values mengembalikan atribut tanpa geometri. Frontend memakai data ini untuk klasifikasi warna, overlay, chart, dan dropdown. Geometri peta tetap diambil dari endpoint tile.

Response dikembalikan dengan gzip-encoding (level 1) dan header caching:

```http
Content-Type: application/json
Content-Encoding: gzip
Cache-Control: public, max-age=300
X-Cache: HIT | MISS
```

Backend menyimpan hasil di in-memory LRU cache (500 entry, TTL 1 jam). `X-Cache: HIT` berarti respons dari cache tanpa query ke database.

### GET `/api/layers/values/loss`

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `hazard` | Ya | `flood` |
| `scenario` | Ya | `rp100` |
| `climate` | Ya | `nonclimate` |
| `run_id` | Ya | `12` |

Response ringkas:

```json
{
  "data": [
    {
      "id_kabkota": "32.01",
      "kab_kota": "Kab. Bogor",
      "prov": "Jawa Barat",
      "loss": 125000000,
      "has_data": true
    }
  ],
  "data_bounds": {
    "min_lng": 106.0,
    "min_lat": -7.5,
    "max_lng": 108.0,
    "max_lat": -6.0
  }
}
```

### GET `/api/layers/values/aal`

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `hazard` | Ya | `flood` |
| `climate` | Ya | `nonclimate` |
| `run_id` | Disarankan | `12` |

### GET `/api/layers/values/hazard`

Query:

| Param | Wajib | Contoh | Catatan |
|---|---|---|---|
| `hazard` | Ya | `flood` | Hazard target. |
| `scenario` | Ya | `nonclimate` | Di endpoint ini berarti climate scenario. |
| `rp` | Ya | `rp100` | Return period. |
| `run_id` | Ya | `12` | Run aktif. |

Response memakai kolom `mean_value`.

### GET `/api/layers/values/production`

Mengembalikan produksi padi dan centroid wilayah untuk zoom dropdown.

### GET `/api/layers/values/regions`

Mengembalikan daftar wilayah administrasi tanpa geometri.

## Vector Tile

### GET `/api/tiles/{layer}/{z}/{x}/{y}`

Layer yang didukung:

- `loss`
- `aal`
- `hazard`
- `production`
- `regions`

Response berupa MVT binary:

```http
Content-Type: application/x-protobuf
```

Query mengikuti layer terkait. Untuk layer analisis biasanya memakai:

```text
hazard=flood&scenario=rp100&climate=nonclimate&run_id=12
```

Endpoint utilitas tile:

- `GET /api/tiles/cache/stats`
- `POST /api/tiles/cache/clear`
- `GET /api/tiles/debug/losses`

## Report dan Download

### GET `/api/download-csv`

Mengunduh CSV untuk filter dashboard.

Query:

```text
hazard=flood&scenario=rp100&climate=nonclimate&run_id=12
```

### GET `/api/generate-report-v2`

Menghasilkan report berdasarkan filter. Response berupa file report dari backend.

Query umum:

| Param | Contoh |
|---|---|
| `hazard` | `flood` |
| `scenario` | `rp100` |
| `climate` | `nonclimate` |
| `run_id` | `12` |
| `region` | `Kab. Bogor` |

## Admin - Status Pipeline

### GET `/api/admin/run-status`

Mengembalikan run monitoring terbaru dari tabel `runs`.

Response:

```json
{
  "run": {
    "id": 12,
    "run_name": "flood_full_operator",
    "created_at": "2026-05-06T01:00:00+00:00",
    "finished_at": null,
    "status": "running",
    "is_active": false,
    "step": "analysis",
    "progress": 55,
    "message": "Analysis dimulai (flood)",
    "operator_name": "operator",
    "source": "local"
  }
}
```

### GET `/api/admin/process-status`

Endpoint kompatibilitas untuk UI lama. Bentuk response lebih sederhana:

```json
{
  "status": "running",
  "message": "Analysis dimulai",
  "progress_percent": 55,
  "current_script": "analysis",
  "hazard": "flood"
}
```

### GET `/api/admin/runs`

Daftar run monitoring terbaru.

Query:

| Param | Default | Keterangan |
|---|---|---|
| `limit` | `10` | Maksimum 50. |
| `operator_name` | kosong | Filter nama operator. |
| `hazard` | kosong | `flood`, `drought`, atau `multi`. |

### GET `/api/admin/runs/active`

Mengembalikan run yang sedang aktif (`is_active=true`).

### GET `/api/admin/runs/{run_id}/validate`

Memeriksa kelengkapan data run pada tabel:

- `aal`
- `losses`
- `zonal_kabupaten`

Response menyertakan `all_hazards_present` dan `complete`.

### PATCH `/api/admin/runs/{run_id}/activate`

Mengaktifkan run tertentu sebagai sumber data dashboard.

Body opsional:

```json
{ "force": false }
```

### PATCH `/api/admin/runs/{run_id}`

Mengubah metadata run: `run_name` dan/atau `operator_name`. Minimal satu field harus ada di body.

Body (semua opsional, minimal satu):

```json
{ "run_name": "flood_fix_v2", "operator_name": "admin" }
```

Set ke `null` untuk menghapus field tersebut:

```json
{ "run_name": null }
```

Response `200`:

```json
{ "run_id": 12, "run_name": "flood_fix_v2", "operator_name": "admin" }
```

### PATCH `/api/admin/runs/{run_id}/data-year`

Menyimpan atau menghapus keterangan tahun model data untuk sebuah run (misalnya tahun data iklim yang dipakai).

Body:

```json
{ "data_year": 2022 }
```

Set ke `null` untuk menghapus:

```json
{ "data_year": null }
```

`data_year` harus berupa integer antara 1990 dan 2100 jika diisi.

Response `200`:

```json
{ "run_id": 12, "data_year": 2022 }
```

### DELETE `/api/admin/runs/{run_id}`

Menghapus run dan data turunannya dari `zonal_kabupaten`, `losses`, dan `aal`. Tidak boleh menghapus run aktif atau run yang masih running.

## Admin - Process Control

### POST `/api/admin/start-pipeline`

Menjalankan pipeline analisis sebagai subprocess.

Body:

```json
{
  "mode": "full",
  "hazard": "flood",
  "operator": "nama_operator"
}
```

Mode yang didukung:

- `full`
- `analysis`
- `preprocess`
- `web`

Catatan penting:

- `full` tidak menjalankan ETL.
- Untuk load database dari UI, gunakan `/api/admin/load-database`, bukan `start-pipeline` mode `web`.
- Backend menolak run baru jika masih ada run non-stale yang running.
- Jika env var `PIPELINE_SPAWN_DISABLED=true`, endpoint mengembalikan `503`. Dipakai untuk deployment production di mana pipeline dijalankan manual oleh operator.

### GET `/api/admin/final-analysis-status`

Memeriksa kesiapan tiga file final:

```text
kabkota_flood_final.geojson
kabkota_drought_final.geojson
kabkota_multihazard_final.geojson
```

Response:

```json
{
  "ready": false,
  "missing": ["kabkota_multihazard_final.geojson"],
  "files": [
    {
      "hazard": "flood",
      "filename": "kabkota_flood_final.geojson",
      "path": "backend/data/output/analysis/kabkota_flood_final.geojson",
      "exists": true,
      "size_bytes": 169801922,
      "modified_at": "2026-05-01T02:44:00+00:00"
    }
  ]
}
```

### POST `/api/admin/load-database`

Menjalankan ETL/load database untuk tiga file final. Endpoint ini tidak menerima hazard.

Jika env var `PIPELINE_SPAWN_DISABLED=true`, endpoint mengembalikan `503`.

Body:

```json
{
  "operator": "nama_operator"
}
```

Response sukses:

```json
{
  "message": "Load database berhasil dimulai.",
  "pid": 12345,
  "mode": "web",
  "operator": "nama_operator",
  "files": []
}
```

Jika file belum lengkap, response `409`:

```json
{
  "error": "Belum semua file final analisis tersedia.",
  "missing": ["kabkota_drought_final.geojson"],
  "files": []
}
```

### GET `/api/admin/dependencies`

Endpoint legacy untuk cek output tertentu per hazard. Untuk kesiapan ETL terbaru, gunakan `/api/admin/final-analysis-status`.

## Admin - Data dan Output

### GET `/api/admin/data/readiness`

Memeriksa kesiapan file input raw.

### GET `/api/admin/data`

Ringkasan dataset raw, processed, dan output.

### GET `/api/admin/data/preview`

Preview file data dari folder yang diizinkan.

### POST `/api/admin/upload-data`

Upload data admin jika UI mengaktifkan flow tersebut.

### POST `/api/admin/data/delete`

Menghapus file data dari folder yang diizinkan.

### POST `/api/admin/data/set-active`

Menandai data raw tertentu sebagai aktif.

### GET `/api/admin/outputs`

Daftar file di `backend/data/output/analysis`.

### GET `/api/admin/outputs/preview`

Preview file output.

### GET `/api/admin/outputs/download`

Download file output.

## Admin - User

### GET `/api/admin/users`

Daftar user.

### PATCH `/api/admin/users/{user_id}/role`

Mengubah role user.

### PATCH `/api/admin/users/{user_id}/status`

Mengubah status user.

## Endpoint Lama yang Sudah Tidak Dipakai

Endpoint berikut masih ada tetapi mengembalikan `410 Gone`:

- `POST /api/admin/run-analysis`
- `POST /api/admin/finish-analysis`

Gunakan `POST /api/admin/start-pipeline`, `GET /api/admin/run-status`, dan `POST /api/admin/load-database`.
