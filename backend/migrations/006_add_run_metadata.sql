-- Migration 006: Simpan manifest metadata run ke database.
-- Jalankan sekali di Supabase/Postgres sebelum mengaktifkan sinkronisasi metadata.
--
-- Kolom metadata menyimpan isi lengkap run_<id>_metadata.json sebagai JSONB.
-- Kolom ringkasan dipakai agar Admin/API dapat query cepat tanpa membongkar JSON.

CREATE TABLE IF NOT EXISTS run_metadata (
    id SERIAL PRIMARY KEY,
    run_id INTEGER UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
    hazard TEXT,
    status TEXT,
    metadata_version TEXT,
    metadata_status TEXT,
    metadata_path TEXT,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_metadata_run_id
ON run_metadata(run_id);

CREATE INDEX IF NOT EXISTS idx_run_metadata_hazard
ON run_metadata(hazard);

CREATE INDEX IF NOT EXISTS idx_run_metadata_status
ON run_metadata(status);

CREATE INDEX IF NOT EXISTS idx_run_metadata_json
ON run_metadata USING GIN(metadata);
