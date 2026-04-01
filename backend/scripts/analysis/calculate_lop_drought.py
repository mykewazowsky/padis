"""
calculate_lop_drought.py

Menghitung LOP kekeringan per kabupaten/kota berdasarkan
nilai DI drought, lalu menyimpan hasil ke GPKG.
"""

import os
import numpy as np
import geopandas as gpd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

input_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_drought_di.gpkg")
output_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_drought_lop.gpkg")

A = 0.8
B = 4
C = 6

di_cols = [
    "di_mme_rp25", "di_mme_rp50", "di_mme_rp100", "di_mme_rp250",
    "di_gpm_rp25", "di_gpm_rp50", "di_gpm_rp100", "di_gpm_rp250"
]


def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File input tidak ditemukan: {path}")


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def calculate_lop_drought(di):
    if di is None or np.isnan(di):
        return np.nan

    numerator = (1 / (1 + B * np.exp(C * di))) - (1 / (1 + B))
    denominator = (1 / (1 + B * np.exp(C))) - (1 / (1 + B))

    value = (numerator / denominator) * A
    return max(0.0, value)


require_file(input_path)

print("Membaca data DI kekeringan...")
gdf = gpd.read_file(input_path, layer="kabkota_drought_di", engine="fiona")

required_cols = [
    "id_kabkota", "kab_kota", "prov",
    *di_cols,
    "geometry",
]
require_columns(gdf, required_cols, "kabkota_drought_di")

print("Menghitung LOP kekeringan...")
for col in di_cols:
    new_col = col.replace("di_", "lop_")
    gdf[new_col] = gdf[col].apply(calculate_lop_drought)

lop_cols = [c.replace("di_", "lop_") for c in di_cols]

print("\nStatistik LOP kekeringan:")
print(gdf[lop_cols].describe())

print("\nCek NULL:")
print(gdf[lop_cols].isnull().sum())

print("Menyimpan hasil LOP kekeringan...")
gdf.to_file(output_path, driver="GPKG", engine="fiona", layer="kabkota_drought_lop")

print("Selesai: LOP kekeringan berhasil dihitung.")