# PADIS System Architecture

Dokumen ini menjelaskan arsitektur sistem PADIS secara menyeluruh, mencakup:
- Backend (API & Admin)
- Pipeline geospasial
- Manajemen data
- Interaksi frontend

---

# 1. Gambaran Arsitektur

PADIS menggunakan arsitektur modular dengan pemisahan jelas antara:

- API Layer (Flask backend)
- Processing Layer (pipeline geospasial)
- Data Layer (file-based storage)
- Frontend (Next.js admin & viewer)

## Diagram konseptual

```text
          ┌──────────────────────┐
          │      Frontend        │
          │  (Next.js Admin UI)  │
          └─────────┬────────────┘
                    │ HTTP API
                    ▼
          ┌──────────────────────┐
          │       Backend        │
          │   (Flask API)        │
          └─────────┬────────────┘
                    │ trigger pipeline
                    ▼
          ┌──────────────────────┐
          │   Pipeline Scripts   │
          │ (GeoPandas, Raster)  │
          └─────────┬────────────┘
                    │ read/write
                    ▼
          ┌──────────────────────┐
          │       Data Layer     │
          │ (raw/processed/output)
          └──────────────────────┘


---

2. Backend Architecture

Entry Point

backend/run.py

Backend dijalankan dengan:

python run.py


---

Flask Application

Lokasi:

backend/app/__init__.py

Fungsi:

inisialisasi Flask app

register blueprint

konfigurasi CORS



---

Struktur Routes

app/routes/
  auth_routes.py
  admin/
    admin_utils.py
    process_routes.py
    output_routes.py
    data_routes.py


---

Domain Routing

1. Auth Routes

auth_routes.py

Fungsi:

autentikasi user

middleware auth (require_auth)



---

2. Admin Routes (modular)

a. Process Routes

process_routes.py

Fungsi:

menjalankan pipeline

monitoring progress

logging

dependencies check


Endpoint utama:

/api/admin/run-analysis

/api/admin/process-status

/api/admin/dependencies



---

b. Output Routes

output_routes.py

Fungsi:

list output files

preview output

download output



---

c. Data Routes

data_routes.py

Fungsi:

data registry

upload data

delete data

set active dataset

preview metadata



---

d. Admin Utils

admin_utils.py

Berisi:

PIPELINE_REGISTRY

PROCESS_STATE

helper function

path constants



---

3. Pipeline Architecture

Pipeline PADIS bersifat:

modular

sequential

file-based


Struktur pipeline

scripts/
  preprocess/
  zonal/
  analysis/
  prepare/
  legacy/


---

Layer Pipeline

1. Preprocess Layer

Fungsi:

reprojection raster

cleaning vector

intersection


Output:

data/processed/*



---

2. Zonal Statistics Layer

Fungsi:

ekstraksi nilai raster ke polygon


Tools:

rasterstats

geopandas



---

3. Analysis Layer

Fungsi:

agregasi wilayah

DI / LOP

loss calculation

AAL calculation



---

4. Prepare Layer

Fungsi:

generate web-ready GeoJSON

simplify geometry

split scenario (rp25, rp50, dst)

inject AAL



---

Execution Model

Pipeline dijalankan oleh backend menggunakan:

subprocess.run(...)

Karakteristik:

synchronous per script

asynchronous via threading (API tidak blocking)

logging per step



---

4. Data Architecture

PADIS menggunakan pendekatan file-based data management.

Struktur folder data

data/
  raw/
  processed/
  output/
  _admin/


---

Penjelasan

1. Raw Data

data/raw/

Isi:

shapefile admin

shapefile sawah

raster flood

raster drought

CSV produksi



---

2. Processed Data

data/processed/

Isi:

cleaned vector

intersection layer

reprojected raster



---

3. Output Data

data/output/

Isi:

hasil analysis (GPKG)

AAL (CSV)

web layer (GeoJSON)



---

4. Admin Metadata

data/_admin/active_sources.json

Fungsi:

menentukan dataset aktif

override default raw data



---

5. Pipeline Registry

Pipeline registry disimpan di backend:

PIPELINE_REGISTRY = {
  hazard → mode → list of scripts
}


---

Hazard

flood

drought

multi



---

Mode

full

preprocess

analysis

web



---

6. Process State Management

Backend menyimpan state pipeline:

PROCESS_STATE = {
  status,
  progress,
  logs,
  current_script,
  updated_outputs
}


---

Fungsi utama

monitoring progress

logging error

tracking output terbaru



---

7. Frontend Interaction

Frontend (Next.js) berinteraksi dengan backend melalui:

/api/admin/*


---

Halaman utama admin

1. /admin/process

run pipeline

monitor progress

lihat logs



---

2. /admin/data

kelola raw & processed data

upload dataset

set active source

dataset registry



---

3. /admin/output

lihat hasil pipeline

preview output

download file



---

8. Data Flow End-to-End

User upload data
        ↓
Raw Data (data/raw)
        ↓
Preprocess
        ↓
Processed Data (data/processed)
        ↓
Zonal + Analysis
        ↓
Output Data (data/output)
        ↓
Prepare Web Layer
        ↓
Frontend Visualization


---

9. Design Principles

1. Separation of Concerns

API ≠ pipeline ≠ data


2. Modular Pipeline

setiap step = 1 script


3. File-based System

tanpa database (saat ini)


4. Reproducibility

pipeline bisa dijalankan ulang


5. Transparency

semua output terlihat di folder



---

10. Current Limitations

belum menggunakan database

belum ada queue system (Celery/RQ)

file management masih manual

belum ada versioning dataset

concurrency masih terbatas



---

11. Future Improvements

integrasi database (PostGIS)

job queue (Celery / Redis)

dataset versioning

metadata catalog

storage abstraction (S3 / cloud)

pipeline orchestration (Airflow)



---

12. Status Sistem

Backend API: ✅ stabil

Pipeline flood: ✅ stabil

Pipeline drought: ✅ stabil

Pipeline multi: ✅ stabil

Admin panel: ✅ aktif

Data management: 🚧 berkembang


---