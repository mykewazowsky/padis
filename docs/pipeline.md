# PADIS Pipeline Documentation

Dokumen ini menjelaskan alur pipeline analisis untuk:
- Flood
- Drought
- Multi-hazard

Pipeline dibagi menjadi beberapa tahap utama:
1. Preprocess
2. Zonal Statistics
3. Analysis
4. Prepare (web output)

---

# 1. Konsep Umum Pipeline

## Alur umum

```text
RAW DATA
   ↓
PREPROCESS
   ↓
ZONAL STATS
   ↓
ANALYSIS (DI / LOP / LOSS / AAL)
   ↓
PREPARE (WEB LAYER)
   ↓
OUTPUT

Struktur folder pipeline

scripts/
  preprocess/
  zonal/
  analysis/
  prepare/
  legacy/


---

2. Flood Pipeline

Deskripsi

Pipeline flood menghitung:

zonal flood exposure

LOP flood

loss ekonomi

AAL

web layers



---

Step-by-step

1. Preprocess raster flood

scripts/preprocess/preprocess_flood_rasters.py

Fungsi:

reprojection raster flood ke EPSG:4326


Output:

data/processed/reproj_R*.tif

data/processed/reproj_RC*.tif



---

2. Zonal statistics flood

scripts/zonal/zonal_stats_flood.py

Fungsi:

hitung mean raster per polygon sawah-admin


Output:

sawah_hazard_stats.geojson



---

3. Aggregation ke kabupaten/kota

scripts/analysis/aggregate_flood_kabkota.py

Fungsi:

agregasi mean hazard ke level kabupaten


Output:

kabkota_flood_stats.geojson



---

4. Hitung LOP flood

scripts/analysis/calculate_lop_flood.py

Fungsi:

transform hazard → probabilitas loss


Output:

kabkota_flood_lop.gpkg



---

5. Hitung loss flood

scripts/analysis/calculate_loss_flood.py

Fungsi:

menggunakan:

LOP

total produksi padi



Output:

kabkota_flood_loss.gpkg



---

6. Standardisasi naming

scripts/analysis/standardize_naming.py

Fungsi:

rename kolom menjadi standar:

loss_flood_nonclimate_rpXX

loss_flood_climate_rpXX



Output:

kabkota_flood_loss_std.gpkg



---

7. Hitung AAL flood (v2)

scripts/analysis/calculate_aal_flood_v2.py

Fungsi:

menghitung area under curve dari loss vs probability


Output:

kabkota_flood_aal_v2.csv



---

8. Prepare web layer (split)

scripts/prepare/prepare_web_flood_split_v2.py

Output:

web_flood_nonclimate_rp25_v2.geojson

web_flood_climate_rp25_v2.geojson

dst.



---

9. Tambahkan AAL ke web layer

scripts/prepare/add_aal_to_web_layers_v2.py

Fungsi:

join CSV AAL ke GeoJSON



---

Output akhir flood

Loss (standardized) → GPKG

AAL → CSV

Web layer → GeoJSON



---

3. Drought Pipeline

Deskripsi

Pipeline drought menghitung:

DI (Drought Index)

LOP drought

loss

AAL

web layers



---

Step-by-step

1. Preprocess raster drought

scripts/preprocess/preprocess_drought_rasters.py

Output:

reproj_mme_rp*.tif

reproj_gpm_rp*.tif



---

2. Zonal statistics drought

scripts/zonal/zonal_stats_drought.py

Output:

sawah_drought_stats.gpkg



---

3. Aggregation

scripts/analysis/aggregate_drought_kabkota.py

Output:

kabkota_drought_stats.gpkg



---

4. Hitung DI

scripts/analysis/calculate_di_drought.py

Output:

kabkota_drought_di.gpkg



---

5. Hitung LOP

scripts/analysis/calculate_lop_drought.py

Output:

kabkota_drought_lop.gpkg



---

6. Hitung loss

scripts/analysis/calculate_loss_drought.py

Output:

kabkota_drought_loss.gpkg



---

7. Standardisasi naming

scripts/analysis/standardize_naming.py

Output:

kabkota_drought_loss_std.gpkg



---

8. Hitung AAL drought (v2)

scripts/analysis/calculate_aal_drought_v2.py

Output:

kabkota_drought_aal_v2.csv



---

9. Prepare web layer

scripts/prepare/prepare_web_drought_split_v2.py


---

10. Tambahkan AAL

scripts/prepare/add_aal_to_web_layers_v2.py


---

Output akhir drought

DI → GPKG

LOP → GPKG

Loss → GPKG

AAL → CSV

Web → GeoJSON



---

4. Multi-hazard Pipeline

Deskripsi

Menggabungkan:

flood loss

drought loss



---

Step-by-step

1. Hitung multihazard clean

scripts/analysis/calculate_multihazard_clean.py

Fungsi:

gabungkan flood + drought

weighted loss


Output:

kabkota_multihazard_clean.gpkg



---

2. Hitung AAL multihazard (v2)

scripts/analysis/calculate_aal_multihazard_v2.py

Output:

kabkota_multihazard_aal_v2.csv



---

3. Prepare web layer

scripts/prepare/prepare_web_multi_split_v2.py


---

4. Tambahkan AAL

scripts/prepare/add_aal_to_web_layers_v2.py


---

Output akhir multi

Clean → GPKG

AAL → CSV

Web → GeoJSON



---

5. Dependensi Antar Pipeline

Flood & Drought → Multi

Multi hanya dapat dijalankan jika:

kabkota_flood_loss_std.gpkg tersedia

kabkota_drought_loss_std.gpkg tersedia



---

6. Mode Eksekusi Pipeline

Pipeline dapat dijalankan dengan mode:

full

Menjalankan seluruh pipeline dari awal hingga akhir

preprocess

Hanya menjalankan tahap preprocess

analysis

Menjalankan zonal + analysis

web

Menjalankan prepare web + AAL join


---

7. Prinsip Desain Pipeline

Modular

Setiap step adalah script terpisah

Re-runnable

Script dapat dijalankan ulang tanpa merusak pipeline

Transparent output

Setiap step menghasilkan output yang jelas

Naming konsisten

loss_*

aal_*

web_*

suffix _v2 untuk versi aktif



---

8. Catatan Penting

Pipeline menggunakan GeoPandas + RasterStats

CRS target: EPSG:4326

Geometry selalu di-force ke 2D

Geometry invalid dan NULL dibersihkan sebelum output

Web layer disederhanakan untuk optimasi performa (prototype)



---

9. Status Pipeline Saat Ini

Flood: ✅ stabil

Drought: ✅ stabil

Multi-hazard: ✅ stabil (bergantung flood + drought)

Admin pipeline control: ✅ aktif


---