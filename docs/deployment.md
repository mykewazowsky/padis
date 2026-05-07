# Panduan Deploy PADIS

Dokumen ini menjelaskan deployment backend, frontend, environment variable, dan catatan khusus pipeline.

## Ringkasan Deploy

PADIS dapat dijalankan sebagai dua service:

1. Backend Flask di Railway.
2. Frontend Next.js di Vercel atau Railway.

Database berada di Supabase PostgreSQL + PostGIS.

Pipeline geospasial berat tetap disarankan berjalan di environment lokal/operator atau container pipeline khusus, bukan di request Flask production.

## Backend di Railway

File konfigurasi root:

```text
railway.toml
```

Konfigurasi utama:

```toml
[phases.setup]
nixPkgs = ["python311", "python311Packages.pip"]

[phases.build]
cmds = [
  "python -m venv /app/.venv",
  ". /app/.venv/bin/activate",
  "pip install -r backend/requirements.txt"
]

[start]
cmd = "cd backend && gunicorn run:app"
```

Backend entry point:

```text
backend/run.py
```

`run.py` membuat Flask app dari `create_app()`.

## Environment Backend

Isi di dashboard Railway:

| Variable | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string Supabase/Postgres. |
| `SECRET_KEY` | Secret Flask. Wajib kuat di production. |
| `JWT_SECRET_KEY` | Secret JWT. Wajib kuat di production. |
| `FLASK_ENV` | Set `production` agar startup memvalidasi secret. |
| `FRONTEND_ORIGINS` | Daftar origin frontend dipisahkan koma. |
| `BOOTSTRAP_DEFAULT_ADMIN` | `true` untuk membuat admin default saat startup. Set `false` di production setelah admin dibuat. |
| `DEFAULT_ADMIN_EMAIL` | Email admin default. Hanya dipakai jika `BOOTSTRAP_DEFAULT_ADMIN=true`. |
| `DEFAULT_ADMIN_PASSWORD` | Password admin default. Hanya dipakai jika `BOOTSTRAP_DEFAULT_ADMIN=true`. |
| `PIPELINE_SPAWN_DISABLED` | `true` untuk menonaktifkan spawn pipeline dari web. Disarankan untuk deployment production. |
| `LOG_LEVEL` | Opsional: `INFO`, `DEBUG`, dll. |

Contoh:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=secret-kuat-panjang-acak
JWT_SECRET_KEY=secret-jwt-kuat-panjang-acak
FLASK_ENV=production
FRONTEND_ORIGINS=https://padis-frontend.vercel.app,http://localhost:3000
BOOTSTRAP_DEFAULT_ADMIN=false
PIPELINE_SPAWN_DISABLED=true
LOG_LEVEL=INFO
```

## Frontend di Vercel

Langkah:

1. Import repository ke Vercel.
2. Set root directory ke `frontend`.
3. Tambahkan environment variable.
4. Deploy.

Environment frontend:

```env
NEXT_PUBLIC_API_BASE_URL=https://url-backend-production
```

Jangan memakai localhost atau `127.0.0.1` untuk production.

## Frontend di Railway

Jika memakai Railway untuk frontend, buat service terpisah dengan root `frontend`.

Command build/start mengikuti Next.js:

```bash
npm install
npm run build
npm start
```

## Database Supabase

Pastikan PostGIS aktif:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Migration manual tersedia di:

```text
db/migrations/
```

Jalankan migration sesuai urutan:

1. `001_mvt_indexes.sql`
2. `002_runs_tracking_columns.sql`
3. `003_runs_created_at_index.sql`
4. `004_runs_active_management.sql`
5. `005_password_reset_tokens.sql`

Tabel `admin_audit_log` dibuat otomatis oleh backend saat startup via `CREATE TABLE IF NOT EXISTS`. Tidak ada migration manual yang dibutuhkan untuk tabel ini.

## CORS

Backend membaca origin dari:

- `FRONTEND_ORIGINS`
- fallback `FRONTEND_ORIGIN`

Jika tidak diisi, backend mengizinkan origin lokal:

```text
http://localhost:3000
http://127.0.0.1:3000
```

Untuk production, isi `FRONTEND_ORIGINS` dengan URL frontend production.

## Pipeline dan Production

Endpoint admin dapat men-spawn subprocess pipeline. Namun proses geospasial bisa berat, sehingga untuk production sebaiknya:

- jalankan pipeline dari mesin operator yang punya data lokal lengkap, atau
- gunakan container pipeline khusus berbasis `Dockerfile.pipeline`, atau
- jalankan hanya proses baca dashboard di backend production.

Pipeline menulis output ke:

```text
backend/data/output/analysis/
```

Load database membutuhkan tiga file:

```text
kabkota_flood_final.geojson
kabkota_drought_final.geojson
kabkota_multihazard_final.geojson
```

## Health Check

Backend memiliki endpoint:

```text
GET /health
```

Response:

```json
{ "status": "ok" }
```

Gunakan endpoint ini untuk health check platform.

## Local Development

Workflow Windows dari root project:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

Manual debug backend:

```powershell
.\backend\venv\Scripts\Activate.ps1
python -m backend.run
```

Manual debug frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Checklist Deploy

- `DATABASE_URL` sudah benar.
- PostGIS sudah aktif.
- Migration SQL sudah dijalankan (001–005).
- `JWT_SECRET_KEY` dan `SECRET_KEY` kuat dan panjang.
- `FLASK_ENV=production` diset agar startup memvalidasi secret.
- `FRONTEND_ORIGINS` berisi URL frontend.
- `NEXT_PUBLIC_API_BASE_URL` berisi URL backend.
- `BOOTSTRAP_DEFAULT_ADMIN=false` setelah admin pertama dibuat (atau `true` dengan password kuat untuk bootstrap awal).
- `PIPELINE_SPAWN_DISABLED=true` jika pipeline tidak dijalankan dari web.
- Admin user tersedia.
- Tabel `admin_audit_log` terbuat otomatis — cek log startup backend.
- Endpoint `/health` mengembalikan status ok.
- Dashboard dapat membaca `/api/runs/latest`.
- Tile endpoint `/api/tiles/regions/0/0/0` tidak error fatal.
