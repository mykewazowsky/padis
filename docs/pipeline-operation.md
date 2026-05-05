# Panduan Operasional Pipeline

Dokumen ini ditujukan untuk operator yang menjalankan dan memantau pipeline analisis PADIS secara lokal.

---

## Prasyarat

- Python environment backend tersedia (`venv` terinstall dan dependencies terpenuhi; `.\padis.ps1` akan memakai venv project jika tersedia)
- File data input sudah ditempatkan di folder `raw/` sesuai standar (lihat `docs/data-requirements.md`)
- Koneksi database aktif (variabel `DATABASE_URL` di `backend/.env` sudah diisi)
- Aplikasi lokal berjalan melalui `.\padis.ps1 start` atau backend Flask berjalan di environment deployment/lokal yang dituju

Untuk workflow operator lokal, jalankan dari root project:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

`start` menjalankan backend + frontend lokal dan membuka Admin UI. `run` digunakan hanya jika pipeline ingin dijalankan dari terminal.

---

## Alur Kerja Operator

### 1. Persiapan Data

Tempatkan semua file data di folder `backend/data/raw/` sesuai struktur berikut:

```
backend/data/raw/
├── administrasi/
│   └── regions.gpkg
├── exposure/
│   ├── sawah_selected.gpkg
│   └── totalproduksipadi.csv
└── hazard/
    ├── flood_r25.tif
    ├── flood_r50.tif
    ├── flood_r100.tif
    ├── flood_r250.tif
    ├── flood_rc25.tif
    ├── flood_rc50.tif
    ├── flood_rc100.tif
    ├── flood_rc250.tif
    ├── drought_r25.tif
    ├── drought_r50.tif
    ├── drought_r100.tif
    ├── drought_r250.tif
    ├── drought_rc25.tif
    ├── drought_rc50.tif
    ├── drought_rc100.tif
    └── drought_rc250.tif
```

Nama file harus persis seperti di atas. Pipeline membaca file berdasarkan nama; file dengan nama berbeda tidak akan ditemukan.

### 2. Verifikasi Ketersediaan File

Buka **Admin UI → Data Management → Cek Ketersediaan File**.

Tombol "Cek Ketersediaan" memanggil `GET /api/admin/dependencies` dan menampilkan status masing-masing **file output dari run sebelumnya** (bukan file input raw). Jika baru pertama kali menjalankan pipeline, semua status akan menunjukkan "tidak ditemukan" — ini normal. Pipeline tetap dapat dijalankan selama file raw sudah di tempat.

### 3. Menjalankan Pipeline

Buka **Admin UI → Process Control**.

1. Masukkan nama operator (digunakan untuk identifikasi di log)
2. Pilih **Hazard**: `flood`, `drought`, atau `multi` (multi = flood + drought + multihazard)
3. Pilih **Mode**:
   - `full` — jalankan seluruh tahapan dari awal
   - `preprocess` — hanya preprocessing raster dan vector
   - `analysis` — hanya analisis, tanpa ETL (menggunakan output preprocess/zonal yang sudah ada; tidak menulis ke database)
   - `web` — hanya ETL (re-push hasil ke database)
4. Klik **Jalankan Pipeline**

Jika ada pipeline yang sedang berjalan, tombol dinonaktifkan dan ditampilkan pesan peringatan.

### 4. Memantau Progress

Buka **Admin UI → Pipeline Monitor**.

Halaman ini polling `GET /api/admin/run-status` setiap beberapa detik dan menampilkan:
- Status run saat ini (`running`, `success`, `failed`)
- Tahap aktif (`preprocess`, `zonal`, `analysis`, `etl`)
- Persentase kemajuan
- Pesan status dari pipeline

Tahapan pipeline:

| Tahap | Deskripsi |
|---|---|
| `preprocess` | Reprojektion raster, normalisasi, persiapan vector |
| `zonal` | Komputasi zonal statistics per kabupaten |
| `analysis` | Kalkulasi loss, AAL, multi-hazard index |
| `etl` | Tulis hasil ke database Supabase |

### 5. Memeriksa Hasil

Buka **Admin UI → Outputs**.

Daftar file di folder `backend/data/output/analysis/` ditampilkan di sini. File dapat di-preview (GeoJSON dan CSV) atau diunduh langsung dari UI.

> File GeoJSON berukuran besar (>10 MB) tidak dapat di-preview; gunakan Download untuk mengunduhnya.

---

## Menjalankan Pipeline via CLI (Tanpa Admin UI)

Pipeline dapat dijalankan langsung dari terminal tanpa Admin UI menggunakan `run` dari root project:

```powershell
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
```

Jika alias lokal sudah dipasang dengan `.\install-padis-command.ps1` dan PowerShell sudah direstart, `padis run` bisa dipakai sebagai convenience alias:

```powershell
padis run --mode full --hazard flood --operator nama_operator
```

Jalankan command dari root project. `.\padis.ps1` akan meneruskan argumen ke CLI PADIS dan memakai Python venv project jika tersedia.

Opsi `--mode`:
- `full` — semua tahapan
- `preprocess` — hanya preprocess
- `analysis` — hanya analysis (tidak menulis ke database)
- `web` — hanya etl

Opsi `--hazard`:
- `flood`
- `drought`
- `multi`

> **Catatan:** Mode `full` + hazard `multi` perlu hati-hati. Multi-hazard memakai output flood dan drought yang sudah ada, jadi pastikan kedua hazard tersebut sudah diproses sebelum menjalankan multi.

Ketika dijalankan via CLI, pipeline tetap menulis progress ke tabel `runs` di database, sehingga Admin UI tetap dapat memantau statusnya.

---

## Troubleshooting

**Pipeline tidak bisa dimulai (error 409)**

Ada run dengan status `running` di database. Jika run tersebut sudah lebih dari 2 jam (stale/crash), run baru dapat dimulai; backend otomatis mengabaikan run stale. Jika belum 2 jam dan dipastikan sudah tidak berjalan, update status di database secara manual:

```sql
UPDATE runs SET status = 'failed' WHERE status = 'running' AND source = 'local';
```

**Pipeline selesai tapi data tidak muncul di frontend**

Pastikan tahap `etl` berhasil — status run harus `success`. Cek pesan error di Pipeline Monitor. Frontend membaca `run_id` terbaru dari `GET /api/runs/latest`; jika ETL gagal menulis ke tabel `runs`, `run_id` baru tidak akan ada.

**File tidak ditemukan saat pipeline berjalan**

Periksa nama file di folder `raw/`. Nama file case-sensitive dan harus persis sesuai standar. Lihat `docs/data-requirements.md`.

**Error zonal statistics**

Pastikan CRS raster valid. Pipeline melakukan reprojektion otomatis ke EPSG:4326, tapi jika raster tidak memiliki CRS terdefinisi, proses akan gagal.
