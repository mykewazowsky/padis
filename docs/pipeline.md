# Pipeline Analisis Geospasial

Pipeline PADIS memproses data raster dan vector menjadi tiga file GeoJSON final. Setelah ketiga file final tersedia, proses ETL/load database dijalankan terpisah.

## Prinsip Terbaru

Pipeline analisis hazard tidak otomatis menulis ke database.

| Proses | Hasil |
|---|---|
| `full + flood` | `backend/data/output/analysis/kabkota_flood_final.geojson` |
| `full + drought` | `backend/data/output/analysis/kabkota_drought_final.geojson` |
| `full + multi` | `backend/data/output/analysis/kabkota_multihazard_final.geojson` |
| `web` atau tombol "Muat ke Database Saja" | ETL ketiga file final ke database |

ETL hanya boleh berjalan jika tiga file final berikut sudah tersedia:

```text
kabkota_flood_final.geojson
kabkota_drought_final.geojson
kabkota_multihazard_final.geojson
```

## Entry Point

Entry point internal:

```powershell
python backend/scripts/main.py --mode full --hazard flood --operator nama_operator
```

Operator biasanya tidak menjalankan command tersebut langsung. Gunakan Admin UI atau launcher:

```powershell
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
```

## Mode Pipeline

| Mode | Hazard | Tahap yang dijalankan | Catatan |
|---|---|---|---|
| `full` | `flood` | preprocess, zonal, analysis | Tidak ETL. |
| `full` | `drought` | preprocess, zonal, analysis | Tidak ETL. |
| `full` | `multi` | analysis multihazard | Tidak preprocess, tidak zonal, tidak ETL. |
| `analysis` | `flood` | zonal, analysis flood | Untuk recompute tanpa preprocess. |
| `analysis` | `drought` | zonal, analysis drought | Untuk recompute tanpa preprocess. |
| `analysis` | `multi` | analysis multihazard | Butuh flood dan drought final. |
| `preprocess` | apa pun | preprocess saja | Menyiapkan raster dan vector. |
| `web` | diabaikan | ETL saja | Memuat semua file final ke database. |

`full + multi` tidak menjalankan ulang flood dan drought. Multi-hazard membaca `kabkota_flood_final.geojson` dan `kabkota_drought_final.geojson` dari disk.

## Tahap 1 - Preprocess

File terkait:

- `backend/scripts/pipeline/preprocess_pipeline.py`
- `backend/scripts/core/raster_engine.py`
- `backend/scripts/core/vector_engine.py`

Fungsi tahap ini:

- Membaca raster hazard dari `backend/data/raw/hazard/`.
- Reproject raster ke CRS kerja.
- Normalisasi raster drought jika diperlukan.
- Menyiapkan vector sawah dan administrasi.
- Menghasilkan `sawah_admin_intersection.geojson` sebagai basis zonal.

Input vector utama:

```text
backend/data/raw/administrasi/regions.gpkg
backend/data/raw/exposure/sawah_selected.gpkg
```

### Metode Intersection Sawah–Administrasi

`intersect_sawah_admin()` di `vector_engine.py` menggunakan `gpd.overlay(how='intersection')` — identik dengan operasi **Clip** di QGIS. Setiap polygon sawah dipotong tepat di batas administrasi kabupaten/kota, kemudian di-dissolve per `id_kabkota`.

Pendekatan ini menggantikan metode lama (sjoin largest-overlap) yang membiarkan geometri sawah meluber keluar batas admin. Akibat perubahan ini, area sawah per kabkota menjadi lebih kecil dan presisi, sesuai batas administrasi yang sebenarnya.

## Tahap 2 - Zonal Statistics

File terkait:

- `backend/scripts/pipeline/zonal_pipeline.py`
- `backend/scripts/core/zonal_engine.py`

Fungsi tahap ini:

- Menghitung nilai rata-rata raster hazard di tiap wilayah sawah-administrasi.
- Menghasilkan file zonal per hazard di `backend/data/output/zonal/`.

Output utama:

```text
backend/data/output/zonal/flood_stats.geojson
backend/data/output/zonal/drought_stats.geojson
```

Multi-hazard tidak punya raster sendiri, sehingga tidak punya file zonal tersendiri.

### Metode Zonal Statistics

`bulk_zonal_stats()` di `zonal_engine.py` menggunakan `rasterio.mask` per polygon — identik dengan Zonal Statistics QGIS. Raster dibuka sekali, setiap fitur sawah di-mask dan mean dihitung dari piksel valid menggunakan numpy.

Metode ini menggantikan pendekatan lama yang membagi raster menjadi dua mode:

- Mode centroid (raster kasar > 500 m): mengambil 1 piksel di titik tengah polygon. Mode ini menghasilkan error 3–29% vs QGIS dan menyebabkan 47% kabkota bernilai 0 karena centroid jatuh di area NoData.
- Mode polygon (raster halus): menggunakan `rasterstats` yang gagal dengan error `width and height must be > 0` pada raster GEOGCS karena bug axis-order.

Perilaku `all_touched` saat ini:

| Kondisi polygon | Metode |
|---|---|
| Ada piksel dengan pusat di dalam polygon | `all_touched=False` (strict) — identik dengan QGIS default |
| Tidak ada piksel yang masuk (polygon < resolusi raster) | Fallback `all_touched=True` — menangkap piksel yang disentuh boundary |

Dengan metode ini, seluruh 444 kabkota mendapat nilai (tidak ada yang hilang), dan untuk kabkota besar hasilnya identik 0.000 vs QGIS.

## Tahap 3 - Analysis

File utama:

- `backend/scripts/pipeline/orchestrator.py`
- `backend/scripts/config/analysis_registry.py`
- `backend/scripts/analysis/flood/*`
- `backend/scripts/analysis/drought/*`
- `backend/scripts/analysis/multihazard/*`

### Flood

Alur flood:

1. Membaca `flood_stats.geojson`.
2. Menghitung LOP flood.
3. Menggabungkan data produksi padi.
4. Menghitung loss per return period dan climate scenario.
5. Menghitung AAL.
6. Menulis `kabkota_flood_final.geojson`.

### Drought

Alur drought:

1. Membaca `drought_stats.geojson`.
2. Menghitung DI.
3. Menghitung LOP drought.
4. Menggabungkan data produksi padi.
5. Menghitung loss.
6. Menghitung AAL.
7. Menulis `kabkota_drought_final.geojson`.

### Multi-hazard

Alur multi-hazard:

1. Memastikan `kabkota_flood_final.geojson` tersedia.
2. Memastikan `kabkota_drought_final.geojson` tersedia.
3. Menggabungkan loss flood dan drought.
4. Menghitung loss multi-hazard.
5. Menghitung AAL multi-hazard.
6. Menulis `kabkota_multihazard_final.geojson`.

Multi-hazard juga menolak input stale jika waktu modifikasi flood dan drought final terlalu jauh berbeda.

## Tahap 4 - ETL / Load Database

File terkait:

- `backend/scripts/etl/run_all.py`
- `backend/scripts/etl/load_regions_adm.py`
- `backend/scripts/etl/load_sawah.py`
- `backend/scripts/etl/load_production.py`
- `backend/scripts/etl/load_losses.py`
- `backend/scripts/etl/load_aal.py`
- `backend/scripts/etl/load_zonal_agg.py`

ETL memuat data ke:

- `regions_adm`
- `regions_sawah`
- `production`
- `losses`
- `aal`
- `zonal_kabupaten`
- `runs`

Saat dipanggil dari tombol "Muat ke Database Saja", ETL dijalankan sebagai subprocess mode `web` dengan hazard `multi`. Hazard tersebut hanya label internal; loader membaca semua file final.

## Status File Final

Backend menyediakan endpoint:

```text
GET /api/admin/final-analysis-status
```

Response berisi:

- `ready`: true jika semua file ada.
- `files`: status tiap file.
- `missing`: daftar file yang belum tersedia.

Endpoint load database:

```text
POST /api/admin/load-database
```

Endpoint ini akan return `409` jika ada file final yang belum tersedia.

## Urutan Aman untuk Operator

1. Jalankan `full + flood`.
2. Jalankan `full + drought`.
3. Jalankan `full + multi`.
4. Pastikan status file final lengkap.
5. Jalankan "Muat ke Database Saja".
6. Pantau status ETL di Pipeline Monitor.
7. Aktifkan run sukses jika ingin dipakai dashboard.

## Folder Data

```
backend/data/
|-- raw/
|   |-- administrasi/
|   |-- exposure/
|   `-- hazard/
|-- processed/
|   |-- hazard/
|   `-- vector/
`-- output/
    |-- zonal/
    `-- analysis/
```

Standar nama file input dijelaskan di `docs/data-requirements.md`.
