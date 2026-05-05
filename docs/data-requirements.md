# Standar Data Input Pipeline

Data input pipeline ditempatkan di `backend/data/raw/`. Nama file harus konsisten karena pipeline membaca file berdasarkan path dan prefix.

## Struktur Folder

```
backend/data/raw/
|-- administrasi/
|   `-- regions.gpkg
|-- exposure/
|   |-- sawah_selected.gpkg
|   `-- totalproduksipadi.csv
`-- hazard/
    |-- flood_r25.tif
    |-- flood_r50.tif
    |-- flood_r100.tif
    |-- flood_r250.tif
    |-- flood_rc25.tif
    |-- flood_rc50.tif
    |-- flood_rc100.tif
    |-- flood_rc250.tif
    |-- drought_r25.tif
    |-- drought_r50.tif
    |-- drought_r100.tif
    |-- drought_r250.tif
    |-- drought_rc25.tif
    |-- drought_rc50.tif
    |-- drought_rc100.tif
    `-- drought_rc250.tif
```

## Administrasi

| Item | Nilai |
|---|---|
| File | `regions.gpkg` |
| Folder | `backend/data/raw/administrasi/` |
| Format | GeoPackage |
| Geometri | Polygon atau MultiPolygon |
| CRS | Bebas, tetapi metadata CRS harus valid |

Kolom wajib:

| Kolom | Keterangan |
|---|---|
| `id_kabkota` | Kode wilayah, contoh `32.01`. |
| `kab_kota` | Nama kabupaten/kota. |
| `prov` | Nama provinsi. |

## Sawah

| Item | Nilai |
|---|---|
| File | `sawah_selected.gpkg` |
| Folder | `backend/data/raw/exposure/` |
| Format | GeoPackage |
| Geometri | Polygon atau MultiPolygon |
| CRS | Bebas, tetapi metadata CRS harus valid |

Layer sawah dioverlay dengan administrasi untuk membentuk `sawah_admin_intersection.geojson`.

## Produksi Padi

| Item | Nilai |
|---|---|
| File | `totalproduksipadi.csv` |
| Folder | `backend/data/raw/exposure/` |
| Format | CSV UTF-8 |
| Separator | Koma |

Kolom wajib:

| Kolom | Keterangan |
|---|---|
| `id_kabkota` | Kode wilayah yang konsisten dengan `regions.gpkg`. |
| `total_prod` | Nilai produksi padi. |

Kolom `kab_kota` dan `prov` disarankan untuk audit dan preview.

## Raster Flood

Folder:

```text
backend/data/raw/hazard/
```

Nama file:

| File | Scenario | Return period |
|---|---|---|
| `flood_r25.tif` | nonclimate | 25 |
| `flood_r50.tif` | nonclimate | 50 |
| `flood_r100.tif` | nonclimate | 100 |
| `flood_r250.tif` | nonclimate | 250 |
| `flood_rc25.tif` | climate | 25 |
| `flood_rc50.tif` | climate | 50 |
| `flood_rc100.tif` | climate | 100 |
| `flood_rc250.tif` | climate | 250 |

Pipeline flood membaca prefix `flood_`.

## Raster Drought

Folder:

```text
backend/data/raw/hazard/
```

Nama file:

| File | Scenario | Return period |
|---|---|---|
| `drought_r25.tif` | nonclimate | 25 |
| `drought_r50.tif` | nonclimate | 50 |
| `drought_r100.tif` | nonclimate | 100 |
| `drought_r250.tif` | nonclimate | 250 |
| `drought_rc25.tif` | climate | 25 |
| `drought_rc50.tif` | climate | 50 |
| `drought_rc100.tif` | climate | 100 |
| `drought_rc250.tif` | climate | 250 |

Pipeline drought membaca prefix `drought_` dan melakukan normalisasi.

## Output yang Diharapkan

Setelah pipeline analisis, file final berada di:

```text
backend/data/output/analysis/kabkota_flood_final.geojson
backend/data/output/analysis/kabkota_drought_final.geojson
backend/data/output/analysis/kabkota_multihazard_final.geojson
```

ETL/load database hanya boleh dijalankan jika ketiganya lengkap.

## Catatan Validasi

- Nama file case-sensitive.
- CRS harus terdefinisi di metadata file.
- Raster korup atau tanpa CRS dapat membuat preprocess gagal.
- Flood hanya membutuhkan delapan raster flood.
- Drought hanya membutuhkan delapan raster drought.
- Multi-hazard tidak membaca raster baru; ia membaca file final flood dan drought.
- Untuk upload/manajemen data dari Admin UI, backend membatasi folder dan nama file yang boleh diakses.
