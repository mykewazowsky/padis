# Standar Data Input Pipeline

Data input pipeline ditempatkan secara manual di folder `backend/data/raw/`. Tidak ada mekanisme upload via UI — operator bertanggung jawab menempatkan file dengan nama dan format yang benar sebelum menjalankan pipeline.

---

## Struktur Folder

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

---

## Dataset: Admin Boundary

| Atribut | Nilai |
|---|---|
| Nama file | `regions.gpkg` |
| Folder | `raw/administrasi/` |
| Format | GeoPackage (`.gpkg`) |
| Geometri | MultiPolygon |
| CRS | Bebas — pipeline mereprojekan ke EPSG:4326 otomatis |

**Kolom wajib:**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id_kabkota` | string / integer | Kode unik kabupaten/kota (e.g. `"32.01"`) |
| `kab_kota` | string | Nama kabupaten/kota untuk tampilan |
| `prov` | string | Nama provinsi |

---

## Dataset: Sawah Layer

| Atribut | Nilai |
|---|---|
| Nama file | `sawah_selected.gpkg` |
| Folder | `raw/exposure/` |
| Format | GeoPackage (`.gpkg`) |
| Geometri | Polygon / MultiPolygon |
| CRS | Bebas — pipeline mereprojekan otomatis |

Layer ini merepresentasikan area sawah yang digunakan untuk overlay analisis exposure. Tidak ada kolom atribut wajib selain geometri.

---

## Dataset: Total Produksi Padi

| Atribut | Nilai |
|---|---|
| Nama file | `totalproduksipadi.csv` |
| Folder | `raw/exposure/` |
| Format | CSV, encoding UTF-8 |
| Separator | Koma (`,`) |

**Kolom wajib:**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id_kabkota` | string / integer | Kode wilayah, harus konsisten dengan `regions.gpkg` |
| `kab_kota` | string | Nama kabupaten/kota |
| `total_prod` | number | Total produksi padi (ton) |

`prov` disarankan ada untuk validasi tambahan.

---

## Dataset: Flood Raster Set

| Atribut | Nilai |
|---|---|
| Folder | `raw/hazard/` |
| Format | GeoTIFF (`.tif`) |
| CRS | Bebas — pipeline mereprojekan ke EPSG:4326 otomatis |
| Nilai | Kedalaman banjir atau intensitas hazard (float) |

**Nama file dan konvensi:**

| Nama File | Skenario | Return Period |
|---|---|---|
| `flood_r25.tif` | Non-climate (current) | 25 tahun |
| `flood_r50.tif` | Non-climate | 50 tahun |
| `flood_r100.tif` | Non-climate | 100 tahun |
| `flood_r250.tif` | Non-climate | 250 tahun |
| `flood_rc25.tif` | Climate | 25 tahun |
| `flood_rc50.tif` | Climate | 50 tahun |
| `flood_rc100.tif` | Climate | 100 tahun |
| `flood_rc250.tif` | Climate | 250 tahun |

Prefix `r` = return period (non-climate). Prefix `rc` = return period climate scenario.

---

## Dataset: Drought Raster Set

| Atribut | Nilai |
|---|---|
| Folder | `raw/hazard/` |
| Format | GeoTIFF (`.tif`) |
| CRS | Bebas — pipeline mereprojekan ke EPSG:4326 otomatis |
| Nilai | SPI/SPEI atau indeks kekeringan (float, biasanya negatif) |

**Nama file dan konvensi:**

| Nama File | Skenario | Return Period |
|---|---|---|
| `drought_r25.tif` | Non-climate | 25 tahun |
| `drought_r50.tif` | Non-climate | 50 tahun |
| `drought_r100.tif` | Non-climate | 100 tahun |
| `drought_r250.tif` | Non-climate | 250 tahun |
| `drought_rc25.tif` | Climate | 25 tahun |
| `drought_rc50.tif` | Climate | 50 tahun |
| `drought_rc100.tif` | Climate | 100 tahun |
| `drought_rc250.tif` | Climate | 250 tahun |

**Normalisasi drought:** Pipeline menggunakan threshold tetap `-6.5` hingga `-2.0` (P1-based) untuk normalisasi reverse min-max. Nilai di luar range ini akan di-clip sebelum normalisasi.

---

## Catatan Umum

- **Nama file case-sensitive.** `Flood_R25.tif` ≠ `flood_r25.tif`.
- **CRS tidak harus EPSG:4326.** Pipeline mereprojekan semua input secara otomatis. Yang penting CRS terdefinisi dengan benar di metadata file.
- **Raster harus valid.** File yang terpotong atau korup akan menyebabkan pipeline gagal. Uji raster dengan QGIS atau `gdalinfo` sebelum menempatkan di folder.
- **Semua 16 file raster hazard tidak harus ada sekaligus.** Jika menjalankan mode `flood` saja, hanya 8 file flood yang dibutuhkan. Mode `drought` hanya 8 file drought. Mode `multi` tidak membaca raster baru — ia menggunakan output analisis flood dan drought yang sudah ada; pastikan kedua hazard sudah diproses sebelum menjalankan `multi`.
