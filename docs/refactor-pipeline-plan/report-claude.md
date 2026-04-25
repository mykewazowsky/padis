  PADIS Refactor Audit Report                                                                                                                    
                                                                                                                                                 
  1. Current System Overview                                                                                                                     
                                                                                                                                                 
  1.1 Pipeline Execution

  The pipeline is not running locally or in Docker. It runs as a child subprocess of the Flask API server (Railway), triggered via an HTTP
  request.

  Flow:
  Admin Browser → POST /api/admin/run-analysis (Railway)
                         ↓
                threading.Thread spawned
                         ↓
       subprocess.run([sys.executable, script_path])
                         ↓
           PROCESS_STATE (in-memory dict, thread-safe Lock)

  The scripts run_preprocess.py, run_zonal.py, run_analysis_*.py, and run_etl.py all execute on the Railway container's filesystem, reading
  raster/vector data from backend/data/raw/ and writing outputs to backend/data/output/.

  There is a second entrypoint at backend/scripts/main.py that calls orchestrator.py → run_padis_pipeline() directly, but it has no CLI argument
  parsing (no --mode, --hazard, --operator), and ETL is a separate step not integrated into it.

  1.2 Admin Panel

  The admin panel (/admin) is part of the same Next.js app deployed to Vercel. It is protected by JWT auth + AdminGuard, but it is publicly
  reachable at the Vercel domain. It communicates with the Railway Flask API for all operations:

  - GET /api/admin/data — dataset status check (reads local filesystem on Railway)
  - POST /api/admin/upload-data — uploads raster/vector files to Railway's backend/data/raw/
  - POST /api/admin/run-analysis — triggers pipeline via Flask subprocess+thread
  - GET /api/admin/process-status — polls in-memory PROCESS_STATE

  1.3 Status Tracking

  Status is tracked entirely in-memory via the global PROCESS_STATE dict in admin_utils.py:

  PROCESS_STATE = {
      "status": "idle",
      "logs": [],
      "current_script": None,
      "progress_percent": 0,
      ...
  }

  This means:
  - Status is lost on every Railway container restart
  - Status is only visible to the one Railway instance that ran the pipeline (problematic if Railway scales horizontally)
  - No historical run visibility — only the last pipeline run is in memory
  - The ETL step does write to the runs DB table, but this is disconnected from the in-memory PROCESS_STATE; the frontend polls Flask state, not
  the DB

  1.4 Run Storage and Usage

  The runs table in Supabase exists and is used correctly for data association — losses, aal, zonal, and production rows all carry a run_id FK.
  The frontend and API use is_active = TRUE to filter to the current active run.

  Current schema:

  ┌────────────┬───────────┬───────────────────────┐
  │   Column   │   Type    │        Purpose        │
  ├────────────┼───────────┼───────────────────────┤
  │ id         │ integer   │ PK                    │
  ├────────────┼───────────┼───────────────────────┤
  │ run_name   │ text      │ label                 │
  ├────────────┼───────────┼───────────────────────┤
  │ created_at │ timestamp │ when created          │
  ├────────────┼───────────┼───────────────────────┤
  │ status     │ text      │ 'running' / 'success' │
  ├────────────┼───────────┼───────────────────────┤
  │ is_active  │ boolean   │ active flag           │
  └────────────┴───────────┴───────────────────────┘

  1.5 Backend–Pipeline Interaction

  The Flask backend (Railway) is responsible for:
  - Triggering pipeline via subprocess.run()
  - Tracking progress in-memory
  - Storing data to local filesystem on Railway
  - Running ETL to Supabase
  - Serving API to frontend

  Because of this, railway.toml installs all geospatial dependencies (GDAL, rasterio, fiona, geopandas, numpy) and even playwright, making the
  Railway image extremely heavy — all for pipeline execution that is not supposed to happen there.

  1.6 Frontend Structure

  frontend/src/app/
    (admin)/         ← admin layout + routes (deployed to Vercel)
    (auth)/          ← login, register, etc.
    (main)/          ← public dashboard (deployed to Vercel)

  No route isolation mechanism exists. Admin routes are in the same Next.js build. There's no NEXT_PUBLIC_ENABLE_ADMIN flag or build-time
  separation.

  ---
  2. Target Architecture Summary

  ┌─────────────────────┬────────────────────────┬─────────────────────────────────────┐
  │        Layer        │        Location        │                Role                 │
  ├─────────────────────┼────────────────────────┼─────────────────────────────────────┤
  │ Pipeline            │ Local machine (Docker) │ Heavy processing, writes to DB      │
  ├─────────────────────┼────────────────────────┼─────────────────────────────────────┤
  │ Admin Panel         │ Local machine only     │ Config, monitoring, data management │
  ├─────────────────────┼────────────────────────┼─────────────────────────────────────┤
  │ Backend (Railway)   │ Cloud                  │ API-only, reads from DB             │
  ├─────────────────────┼────────────────────────┼─────────────────────────────────────┤
  │ Database (Supabase) │ Cloud                  │ Single source of truth              │
  ├─────────────────────┼────────────────────────┼─────────────────────────────────────┤
  │ Frontend (Vercel)   │ Cloud                  │ Read-only dashboard                 │
  └─────────────────────┴────────────────────────┴─────────────────────────────────────┘

  Key principles:
  - Pipeline runs from CLI via Docker with volume-mounted local data
  - Pipeline writes progress + results directly to Supabase
  - Backend has no subprocess/pipeline code
  - Admin panel is never deployed to Vercel
  - Data files never travel through HTTP

  ---
  3. Gap Analysis

  Gap 1 — Pipeline runs inside Flask, not as standalone Docker process

  ┌──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                           Detail                                                           │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ POST /api/admin/run-analysis triggers subprocess.run() inside a threading.Thread on Railway                                │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ docker run padis-pipeline python scripts/main.py --mode full --hazard flood --operator X runs locally, writing to Supabase │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ HIGH — This is the core architectural mismatch. Everything else flows from this.                                           │
  └──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 2 — Pipeline status is in-memory, not in Supabase

  ┌──────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                Detail                                                │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ PROCESS_STATE dict in Railway process memory; frontend polls GET /api/admin/process-status           │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ Pipeline writes step, progress, message, operator_name directly to runs table; backend reads from DB │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ HIGH — Progress is invisible if pipeline runs locally without a running Flask connection.            │
  └──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 3 — runs table is missing columns required by target design

  ┌──────────┬──────────────────────────────────────────────────────────────────────────────┐
  │          │                                    Detail                                    │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ Table has: id, run_name, created_at, status, is_active                       │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ Target design requires: step, progress, message, operator_name, source added │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ HIGH — Without these, DB-based monitoring flow is impossible.                │
  └──────────┴──────────────────────────────────────────────────────────────────────────────┘

  Gap 4 — No Dockerfile exists

  ┌──────────┬──────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                            Detail                                            │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ No Dockerfile anywhere in the project. Pipeline runs in system Python via venv.              │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ A Dockerfile that installs GDAL/Python deps and exposes python scripts/main.py as entrypoint │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ HIGH — Docker execution is the entire basis of the local pipeline design.                    │
  └──────────┴──────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 5 — scripts/main.py has no CLI argument parsing

  ┌──────────┬──────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                        Detail                                        │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ main() calls run_padis_pipeline() with hardcoded True, True, True flags; no argparse │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ python scripts/main.py --mode full --hazard flood --operator mitra_bandung           │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ HIGH — Without args, the Docker run command described in the design docs won't work. │
  └──────────┴──────────────────────────────────────────────────────────────────────────────────────┘

  Gap 6 — Admin panel is deployed to Vercel (same build as public dashboard)

  ┌──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                             Detail                                                             │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ /admin routes exist in the same Next.js app deployed to Vercel. Auth guard protects them, but the code and routes are public.  │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ Admin panel only accessible locally, never deployed to Vercel                                                                  │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ MEDIUM — Security concern; the admin route bundle is public even if auth-guarded. Upload endpoint on Railway makes it          │
  │          │ reachable from anywhere.                                                                                                       │
  └──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 7 — File upload route saves to Railway ephemeral filesystem

  ┌──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                       Detail                                                       │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ POST /api/admin/upload-data accepts raster/vector files and saves to backend/data/raw/ on the Railway container.   │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ Data files live only on local operator machine. No web upload path.                                                │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ HIGH — Railway's filesystem is ephemeral (lost on redeploy). Also fundamentally incompatible with ±200GB datasets. │
  └──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 8 — Data status check endpoints read local filesystem on Railway

  ┌──────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                    Detail                                                     │
  ├──────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ GET /api/admin/data calls os.path.exists() on Railway's local paths (backend/data/raw/, backend/data/output/) │
  ├──────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ Data status comes from DB or is checked locally in the admin panel (not via Railway)                          │
  ├──────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ MEDIUM — These paths will always be empty/missing on Railway after refactor.                                  │
  └──────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 9 — Backend carries all geospatial dependencies on Railway

  ┌──────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                            Detail                                                            │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ requirements.txt + railway.toml install: rasterio, fiona, geopandas, numpy, shapely, pyproj, playwright, gdal (via rasterio) │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ Railway only needs: flask, psycopg2, sqlalchemy, gunicorn, reportlab, etc. (API-only)                                        │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ MEDIUM — Bloats Railway build time and image size, increases cost, and creates unnecessary security surface.                 │
  └──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 10 — No GET /api/admin/status endpoint reading from DB

  ┌──────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                Detail                                                │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ GET /api/admin/process-status returns in-memory PROCESS_STATE                                        │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ GET /api/admin/status reads latest run from runs table and returns step, progress, message, operator │
  ├──────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ MEDIUM — Frontend monitoring from Vercel will not work after removing in-memory tracking.            │
  └──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 11 — ETL is a separate step, not integrated into pipeline CLI

  ┌──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                                             Detail                                                             │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ run_etl.py is listed in PIPELINE_REGISTRY["flood"]["web"] but orchestrator.py does not call ETL — these are two parallel       │
  │          │ pipeline systems                                                                                                               │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ One unified pipeline CLI: preprocess → zonal → analysis → ETL, all in one python scripts/main.py invocation                    │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ MEDIUM — Two pipeline paths (Flask-subprocess and orchestrator) creates confusion and divergence risk.                         │
  └──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Gap 12 — No double-run guard using DB

  ┌──────────┬────────────────────────────────────────────────────────────────────────────────────────┐
  │          │                                         Detail                                         │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────┤
  │ Current  │ PROCESS_LOCK mutex prevents concurrent pipeline runs per Flask process instance        │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────┤
  │ Expected │ SELECT * FROM runs WHERE status = 'running' check before starting                      │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────┤
  │ Impact   │ LOW — The in-memory lock works, but is instance-local and not durable across restarts. │
  └──────────┴────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  4. Risk Analysis

  Risk 1 — Data Loss on Railway Filesystem (HIGH)

  Scenario: If refactor removes file upload from Railway API, but operators still try to upload small datasets through admin panel, they will get
   errors. More critically, any raster data already saved to Railway's ephemeral disk is lost on every redeploy. This is already a silent failure
   mode.

  Risk 2 — Breaking the Live API While Refactoring process_routes.py (HIGH)

  process_routes.py is registered in admin_bp, which is part of the main Flask app. Removing or modifying it incorrectly will affect the running
  Railway API. The other admin routes (data_routes, output_routes) must continue to work during transition, so the cleanup must be surgical.

  Risk 3 — runs Table Migration Breaking Existing API Queries (MEDIUM)

  All layer routes query runs WHERE is_active = TRUE to get the current run_id. Adding columns (step, progress, etc.) is backward-safe. Renaming
  or removing columns would break the API. This risk is low if only new columns are added.

  Risk 4 — In-Memory Status Lost Mid-Refactor (MEDIUM)

  If the frontend admin panel is still calling /api/admin/process-status while the refactor introduces DB-based tracking, there will be a window
  where the frontend shows stale/missing status. Both endpoints may need to coexist during transition.

  Risk 5 — Docker Build Fails Due to GDAL Dependencies (MEDIUM)

  GDAL installation in Docker is notoriously fragile across platforms. On the developer's Windows machine, the venv uses binary wheels. In Docker
   (Linux-based), building GDAL from source or using the right base image (osgeo/gdal, ghcr.io/osgeo/gdal) requires validation. A wrong base
  image will cause hours of debugging.

  Risk 6 — Admin Panel Isolation Breaking Auth Flow (LOW)

  If admin routes are removed from the Vercel build, the login flow (which uses JWT from the same Flask backend) still works. But if admin panel
  runs locally against localhost:5000 while the Flask backend is on Railway, CORS must allow localhost:3000 as an origin for admin-only calls.
  Currently Railway allows only Vercel origins.

  Risk 7 — Pipeline ETL Duplication Causing Dirty Data (HIGH)

  There are currently two ETL paths:
  1. run_etl.py inside PIPELINE_REGISTRY (run via Flask subprocess)
  2. scripts/etl/run_all.py called from orchestrator.py (via CLI)

  If during refactor one path is decommissioned while the other is still used by the frontend admin, ETL could be skipped, leaving the DB without
   updated run data. This is the highest data-integrity risk during the transition period.

  ---
  5. Refactor Readiness

  What is ready

  ┌───────────────────────────────┬────────┬──────────────────────────────────────────────────────────────────────────────────┐
  │           Component           │ Status │                                      Reason                                      │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Supabase schema (core tables) │ Ready  │ runs, losses, aal, zonal_kabupaten are well-structured with FKs                  │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Backend API layer routes      │ Ready  │ Fully DB-driven, stateless — safe to keep untouched                              │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Auth system                   │ Ready  │ Uses Supabase for user storage, JWT for sessions — no pipeline dependency        │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ ETL scripts                   │ Ready  │ scripts/etl/ correctly pushes to Supabase, already works with DATABASE_URL       │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Pipeline script modules       │ Ready  │ scripts/analysis/, scripts/core/, scripts/config/ are pure Python, no Flask deps │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Report generation             │ Ready  │ API-only, reads from DB — no change needed                                       │
  └───────────────────────────────┴────────┴──────────────────────────────────────────────────────────────────────────────────┘

  What is NOT safe to touch early

  ┌────────────────────────────────────────────┬────────┬─────────────────────────────────────────────────────────────────────────────────────┐
  │                 Component                  │  Risk  │                                       Reason                                        │
  ├────────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ backend/app/routes/layers/                 │ HIGH   │ Live API serving the Vercel frontend — any breakage immediately affects end users   │
  ├────────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ backend/app/routes/tiles/                  │ HIGH   │ MVT tile generation — latency-sensitive, used by map on every render                │
  ├────────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ runs table structure                       │ HIGH   │ Every layer query depends on is_active; wrong migration breaks all data             │
  ├────────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ backend/app/routes/auth/                   │ HIGH   │ Auth is required for download/report features — any breakage blocks users           │
  ├────────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ backend/app/routes/admin/process_routes.py │ MEDIUM │ Admin panel currently uses this; decommission only after Docker CLI is proven       │
  │                                            │        │ working                                                                             │
  └────────────────────────────────────────────┴────────┴─────────────────────────────────────────────────────────────────────────────────────┘

  Overall Readiness Assessment

  The project is partially ready for this refactor. The data layer (DB schema, ETL, API routes) already matches the target architecture. The
  pipeline execution layer (Flask-subprocess, in-memory state, file upload) requires full replacement. The admin panel requires surgical
  separation.

  Estimated complexity: Medium-High. The core data flow already matches the target; the gaps are in execution environment, monitoring, and
  deployment isolation.

  ---
  6. Recommended Refactor Phases

  Phase 1 — Stabilize the DB-Based Run Tracking (No Breaking Changes)

  Goal: Make the runs table the authoritative source of truth for pipeline status, without removing anything from the Flask API yet.

  1. Add columns to runs table: step TEXT, progress INTEGER, message TEXT, operator_name TEXT, source TEXT DEFAULT 'local'
  2. Add new backend endpoint GET /api/admin/run-status that reads the latest run from runs table (alongside the existing
  /api/admin/process-status which stays untouched)
  3. Add argparse support to backend/scripts/main.py: --mode, --hazard, --operator
  4. Update scripts/etl/run_all.py (and run_manager.py) to write step and progress to runs table during ETL
  5. Update orchestrator.py to write step/progress to runs before/after each stage

  Result: Two parallel status systems. Nothing breaks. Pipeline can now be called from CLI with proper args and writes monitoring data to DB.

  ---
  Phase 2 — Build and Validate the Docker Pipeline

  Goal: Prove the pipeline works in Docker end-to-end, writing to Supabase, before removing any Flask pipeline code.

  1. Create Dockerfile for the pipeline (based on osgeo/gdal or python:3.11-slim + manual GDAL wheels)
  2. Test locally: docker run --rm -v /path/to/data:/data -e DATABASE_URL=... padis-pipeline python scripts/main.py --mode full --hazard flood
  --operator test
  3. Confirm: runs table gets new row, data loads to losses/aal/zonal_kabupaten, is_active flips correctly
  4. Update admin panel frontend to poll GET /api/admin/run-status (DB-based) instead of /api/admin/process-status (in-memory)
  5. Validate monitoring: pipeline runs in terminal → Vercel dashboard shows correct progress

  Result: Docker pipeline is proven. Flask subprocess path still works but is no longer the primary path.

  ---
  Phase 3 — Decommission Flask Pipeline Code and Isolate Admin

  Goal: Remove heavy pipeline code from Railway, clean up the admin separation.

  1. Remove from Flask/Railway:
    - backend/app/routes/admin/process_routes.py — delete or stub out to return 410 Gone
    - backend/app/routes/admin/data_routes.py — remove upload/delete endpoints; keep read-only GET /api/admin/data if still useful (simplified to
   DB-only checks)
    - Remove geospatial dependencies from requirements.txt: rasterio, fiona, geopandas, numpy, shapely, pyproj, playwright
    - Remove playwright install chromium from railway.toml
  2. Admin panel isolation:
    - Add NEXT_PUBLIC_ENABLE_ADMIN=false env var to Vercel deployment
    - Gate all admin route rendering on this flag
    - Local .env.local sets NEXT_PUBLIC_ENABLE_ADMIN=true
    - Admin panel points to localhost:5000 or a separate local Flask instance
  3. Backend cleanup:
    - Add GET /api/admin/run-status as the canonical monitoring endpoint (already done in Phase 1)
    - Update CORS to allow localhost:3000 only when ENABLE_LOCAL_ADMIN=true env var is set on Railway (for development), or run a second local
  Flask instance for admin
  4. Final validation:
    - Deploy cleaned Railway (no pipeline code) — confirm all public API endpoints work
    - Run Docker pipeline locally — confirm data appears in Vercel dashboard
    - Confirm admin panel (local) shows correct DB-based status

  ---
  7. Conclusion

  The PADIS codebase has a well-structured data layer (Supabase schema, ETL, API routes) that already aligns with the target architecture. The
  critical misalignment is in the execution layer: pipeline runs inside Flask on Railway using subprocess+threading, status is tracked in-memory,
   and the admin panel is deployed publicly.

  The three most important gaps to close first, in order of impact:

  1. Gap 5 — Add CLI args to scripts/main.py (enables Docker execution)
  2. Gap 3 — Add step/progress/message/operator_name to runs table (enables DB monitoring)
  3. Gap 4 — Create Dockerfile (enables containerized local execution)

  These three changes unlock the entire target architecture and can be done without breaking any live API endpoint. Everything else (Flask
  pipeline code removal, admin isolation, dependency cleanup) follows only after Docker pipeline is proven working end-to-end against the live
  Supabase instance.

  The highest risk during refactor is Gap 7 (two divergent ETL paths) — unifying these into one canonical pipeline CLI path should be done
  carefully in Phase 2 before decommissioning the Flask subprocess path.

  ---