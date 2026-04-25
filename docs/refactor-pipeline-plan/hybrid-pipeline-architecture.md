# Admin Local & Hybrid Pipeline Architecture (PADIS)

## Overview

Dokumen ini menjelaskan arsitektur final PADIS di mana:

* **Admin panel dan pipeline dijalankan secara lokal (private environment)**
* **Dashboard publik di-deploy ke Vercel (read-only)**
* **Backend API di Railway**
* **Database terpusat di Supabase (PostgreSQL + PostGIS)**

Tujuan utama:

* Menangani data besar (±200GB) tanpa membebani server
* Meningkatkan keamanan dengan tidak mengekspos admin ke publik
* Memastikan sistem tetap ringan, stabil, dan scalable

---

## Final Architecture

```text
[ Admin App (Local Machine) ]
   └─ login admin
   └─ upload data
   └─ run pipeline
   └─ monitoring status

                ↓ (write)

[ Supabase PostgreSQL + PostGIS ]
   └─ runs
   └─ losses
   └─ aal
   └─ zonal_kabupaten

                ↓ (read)

[ Backend API (Railway) ]
   └─ /api/layers
   └─ /api/tiles
   └─ /api/analytics
   └─ /api/report

                ↓

[ Public Dashboard (Vercel) ]
   └─ visualisasi
   └─ analisis
   └─ read-only
```

---

## Key Principles

### 1. Separation of Concerns

* Pipeline dipisahkan dari web
* Web hanya untuk visualisasi

### 2. Local Execution for Heavy Processing

* Semua proses raster & geospasial dijalankan lokal
* Tidak melalui HTTP request

### 3. Centralized Data Storage

* Semua hasil pipeline disimpan di Supabase
* Dashboard membaca data terbaru

### 4. Private Admin Access

* Admin panel tidak di-deploy ke publik
* Hanya dijalankan di environment lokal

---

## Admin Panel (Local Only)

### Konsep

Admin panel tetap menggunakan frontend yang sama (Next.js), namun:

* **Tidak di-deploy ke Vercel**
* Hanya dijalankan secara lokal

---

### Menjalankan Admin

```bash
cd frontend
npm install
npm run dev
```

Akses:

```
http://localhost:3000/admin
```

---

### Fungsi Admin

* Upload data
* Konfigurasi parameter pipeline
* Menjalankan pipeline
* Monitoring status
* Manajemen data

---

## Pipeline Execution

### Cara Menjalankan

Pipeline dijalankan dari local machine:

```bash
python backend/scripts/main.py --mode full --hazard flood --operator <nama_operator>
```

---

### Parameter

| Parameter    | Deskripsi                  |
| ------------ | -------------------------- |
| `--mode`     | full / incremental         |
| `--hazard`   | flood / drought / multi    |
| `--operator` | nama user yang menjalankan |

---

### Pipeline Steps

1. Preprocessing raster
2. Zonal statistics
3. Risk analysis
4. ETL ke database

---

## Run Tracking (Database)

### Table: `runs`

Digunakan untuk tracking eksekusi pipeline

Tambahan kolom:

* `step` — tahap pipeline
* `progress` — 0–100
* `message` — status
* `operator_name` — siapa yang menjalankan
* `source` — local

---

### Contoh Data

```
run_id: 52
status: running
step: zonal
progress: 45
operator_name: mitra_bandung
source: local
```

---

## Monitoring Flow

```text
Pipeline (Local)
↓
Update runs table
↓
Backend API
↓
Frontend Dashboard (polling)
```

---

## Backend (Railway)

### Peran

* Menyediakan API
* Mengambil data dari Supabase
* Menyediakan tiles (MVT)
* Generate report

---

### Endpoint Monitoring

```
GET /api/admin/status
```

Response:

```json
{
  "status": "running",
  "step": "zonal",
  "progress": 45,
  "message": "Processing data...",
  "operator": "mitra_bandung"
}
```

---

## Frontend (Vercel)

### Peran

* Dashboard publik
* Visualisasi data
* Analisis

---

### Karakteristik

* Read-only
* Tidak memiliki akses admin
* Tidak menjalankan pipeline

---

## Data Flow

```text
Raw Data (Local)
↓
Pipeline Processing
↓
Insert ke Supabase
↓
Backend API
↓
Dashboard
```

---

## Security Considerations

* Admin tidak diakses publik
* Pipeline hanya dijalankan oleh operator tertentu
* Database menjadi satu-satunya source of truth
* Tidak ada upload data besar melalui web

---

## Safety Mechanism

### 1. Prevent Double Run

Sebelum pipeline dijalankan:

```sql
SELECT * FROM runs WHERE status = 'running';
```

Jika ada:

* pipeline baru tidak dijalankan

---

### 2. No Overwrite Policy

* Setiap pipeline menghasilkan run baru
* Data lama tidak dihapus

---

## Advantages

* Menangani data besar tanpa limit server
* Sistem lebih stabil
* Lebih aman (admin tidak publik)
* Mudah digunakan oleh operator
* Arsitektur clean dan modular

---

## Limitations

* Pipeline harus dijalankan manual
* Bergantung pada environment lokal
* Tidak fully automated (belum ada scheduler)

---

## Future Improvements

* Worker system (auto job runner)
* Queue system (Celery / Redis)
* Dockerization pipeline
* Multi-user operator management

---

## Notes for Handover

* Jalankan pipeline dari local environment
* Pastikan dependency (GDAL, Python) terinstall
* Gunakan parameter yang sesuai
* Dashboard hanya menampilkan hasil terakhir

---

## Conclusion

Arsitektur ini mengimplementasikan:

> Hybrid Local-Execution Geospatial System

Dengan:

* local processing untuk data besar
* centralized database
* web-based visualization

Sistem ini:

* siap untuk capstone
* siap untuk diserahkan ke mitra
* mudah dikembangkan ke production system