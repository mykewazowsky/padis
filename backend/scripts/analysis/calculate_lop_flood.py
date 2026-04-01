"""
calculate_lop_flood.py

Menghitung LOP banjir per kabupaten/kota berdasarkan
kolom mean hazard flood, lalu menyimpan hasil ke GPKG.
"""

import os
import numpy as np
import geopandas as gpd
from shapely import force_2d

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

input_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_flood_stats.geojson")
output_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_flood_lop.gpkg")

hazard_cols = [
    "mean_r25", "mean_r50", "mean_r100", "mean_r250",
    "mean_rc25", "mean_rc50", "mean_rc100", "mean_rc250"
]


def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File input tidak ditemukan: {path}")


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def calculate_lop(x):
    if x is None or np.isnan(x) or x <= 0:
        return np.nan

    value = 0.2885 * np.log(x) + 0.5148
    return max(0.0, value)


require_file(input_path)

print("Membaca data flood kabupaten/kota...")
gdf = gpd.read_file(input_path, engine="fiona")

required_cols = [
    "id_kabkota", "kab_kota", "prov",
    *hazard_cols,
    "geometry",
]
require_columns(gdf, required_cols, "kabkota_flood_stats.geojson")

print("Menghitung LOP banjir...")
for col in hazard_cols:
    new_col = col.replace("mean_", "lop_")
    gdf[new_col] = gdf[col].apply(calculate_lop)

lop_cols = [c.replace("mean_", "lop_") for c in hazard_cols]

print("Cek hasil LOP...")
print(gdf[lop_cols].describe())

print("Menghapus dimensi Z (3D -> 2D) jika ada...")
gdf["geometry"] = gdf["geometry"].apply(
    lambda geom: force_2d(geom) if geom is not None else None
)

save_cols = [
    "id_kabkota", "kab_kota", "prov",
    "mean_r25", "mean_r50", "mean_r100", "mean_r250",
    "mean_rc25", "mean_rc50", "mean_rc100", "mean_rc250",
    "lop_r25", "lop_r50", "lop_r100", "lop_r250",
    "lop_rc25", "lop_rc50", "lop_rc100", "lop_rc250",
    "geometry"
]

require_columns(gdf, save_cols, "gdf hasil flood lop")

gdf_save = gdf[save_cols].copy()

numeric_cols = [
    c for c in save_cols
    if c != "geometry" and c not in ["id_kabkota", "kab_kota", "prov"]
]

for col in numeric_cols:
    gdf_save[col] = gdf_save[col].astype(float)

print("Menyimpan hasil LOP banjir...")
gdf_save.to_file(
    output_path,
    driver="GPKG",
    engine="fiona",
    layer="kabkota_flood_lop"
)

print("Selesai: LOP banjir berhasil dihitung.")