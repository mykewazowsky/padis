# Pipeline Operation Guide (PADIS)

## Overview

Dokumen ini menjelaskan langkah-langkah menjalankan pipeline PADIS menggunakan Docker oleh operator (admin/mitra).

Pipeline dijalankan secara lokal, dan hasilnya akan otomatis tersimpan ke database Supabase dan ditampilkan pada dashboard.

---

## Prasyarat

Sebelum menjalankan pipeline, pastikan:

* Docker sudah terinstall
* Memiliki akses ke database (DATABASE_URL)
* Memiliki data input (raster, shapefile, dll)

---

## Step 1 — Jalankan Admin Panel (Opsional)

```bash
cd frontend
npm run dev
```

Akses:

```
http://localhost:3000/admin
```

Gunakan admin panel untuk:

* menentukan parameter (hazard, mode)
* melihat status pipeline

---

## Step 2 — Build Docker Image (Sekali saja)

```bash
docker build -t padis-pipeline .
```

---

## Step 3 — Jalankan Pipeline

```bash
docker run --rm \
  -e DATABASE_URL=<your_database_url> \
  -e OPERATOR_NAME=<nama_operator> \
  -v /path/to/data:/data \
  padis-pipeline \
  python scripts/main.py --mode full --hazard flood
```

---

## Step 4 — Monitoring

Setelah pipeline berjalan:

* buka dashboard (Vercel)
* atau admin panel (local)
* status akan muncul otomatis:

  * progress
  * step
  * message

---

## Step 5 — Analisis Hasil

* buka halaman dashboard
* pilih layer (hazard, loss, dll)
* klik wilayah untuk melihat detail
* gunakan chart untuk analisis

---

## Catatan Penting

* Pipeline membutuhkan waktu lama (tergantung data)
* Jangan menjalankan lebih dari satu pipeline secara bersamaan
* Data tidak diupload melalui web (gunakan local path)
* Semua hasil disimpan ke database pusat

---

## Troubleshooting

### Pipeline tidak jalan

* cek Docker sudah running
* cek DATABASE_URL benar

### Data tidak muncul di dashboard

* pastikan pipeline selesai (status = success)
* cek filter dashboard

### Error dependency

* rebuild docker image:

```bash
docker build --no-cache -t padis-pipeline .
```

---

## Kesimpulan

Pipeline PADIS dirancang untuk:

* dijalankan secara lokal
* mudah digunakan oleh operator
* terintegrasi dengan dashboard

Operator hanya perlu:

1. build docker (sekali)
2. run pipeline
3. lihat hasil di dashboard