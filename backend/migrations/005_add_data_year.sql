-- Migration 005: Tambah kolom data_year pada tabel runs
-- Jalankan sekali di database sebelum deploy backend.
--
-- data_year menyimpan tahun model data yang digunakan dalam run (mis. 2022).
-- Nilainya diisi manual oleh admin melalui halaman Pipeline Monitor.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS data_year SMALLINT;

-- Isi nilai default 2022 untuk run yang saat ini aktif.
UPDATE runs SET data_year = 2022 WHERE is_active = TRUE AND data_year IS NULL;
