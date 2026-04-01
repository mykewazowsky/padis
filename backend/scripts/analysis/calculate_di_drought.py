"""
calculate_di_drought.py

Menghitung Drought Index (DI) dari nilai mean drought,
menggunakan normalisasi min-max per kolom.
"""

import os
import geopandas as gpd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

input_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_drought_stats.gpkg")
output_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_drought_di.gpkg")

drought_cols = [
    "mean_mme_rp25", "mean_mme_rp50", "mean_mme_rp100", "mean_mme_rp250",
    "mean_gpm_rp25", "mean_gpm_rp50", "mean_gpm_rp100", "mean_gpm_rp250"
]


def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File input tidak ditemukan: {path}")


def require_columns(df, columns):
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"Kolom tidak ditemukan: {missing}")


require_file(input_path)

print("Membaca data drought kabupaten...")
gdf = gpd.read_file(input_path, layer="kabkota_drought_stats", engine="fiona")

required_cols = [
    "id_kabkota", "kab_kota", "prov",
    *drought_cols,
    "geometry"
]
require_columns(gdf, required_cols)

print("Menghitung DI...")

for col in drought_cols:
    print(f"Processing {col} ...")

    abs_val = gdf[col].abs()

    min_val = abs_val.min()
    max_val = abs_val.max()

    print(f"Min: {min_val}, Max: {max_val}")

    di_col = col.replace("mean_", "di_")

    if max_val == min_val:
        print(f"WARNING: {col} konstan → DI di-set 0")
        gdf[di_col] = 0.0
    else:
        gdf[di_col] = (abs_val - min_val) / (max_val - min_val)
        gdf[di_col] = gdf[di_col].clip(0, 1)

di_cols = [c.replace("mean_", "di_") for c in drought_cols]

print("\nStatistik DI:")
print(gdf[di_cols].describe())

print("\nCek NULL:")
print(gdf[di_cols].isnull().sum())

print("Menyimpan hasil DI...")
gdf.to_file(
    output_path,
    driver="GPKG",
    engine="fiona",
    layer="kabkota_drought_di"
)

print("Selesai: DI kekeringan berhasil dihitung.")