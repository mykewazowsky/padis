"""
aggregate_drought_kabkota.py

Mengagregasi drought stats dari level sawah ke level kabupaten/kota,
lalu menggabungkannya dengan geometri admin.
"""

import os
import geopandas as gpd
from shapely import force_2d

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

output_folder = os.path.join(PROJECT_ROOT, "data", "output")
processed_folder = os.path.join(PROJECT_ROOT, "data", "processed")

input_path = os.path.join(output_folder, "sawah_drought_stats.gpkg")
admin_path = os.path.join(processed_folder, "admin_clean.geojson")
output_path = os.path.join(output_folder, "kabkota_drought_stats.gpkg")

drought_cols = [
    "mean_mme_rp25", "mean_mme_rp50", "mean_mme_rp100", "mean_mme_rp250",
    "mean_gpm_rp25", "mean_gpm_rp50", "mean_gpm_rp100", "mean_gpm_rp250"
]


def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File tidak ditemukan: {path}")


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


require_file(input_path)
require_file(admin_path)

print("Membaca data sawah drought stats...")
gdf = gpd.read_file(input_path, layer="sawah_drought_stats", engine="fiona")

print("Membaca data admin...")
admin = gpd.read_file(admin_path, engine="fiona")

group_cols = ["id_kabkota_2", "kab_kota_2", "prov_2"]

require_columns(gdf, [*group_cols, *drought_cols], "sawah_drought_stats")
require_columns(admin, ["id_kabkota", "kab_kota", "prov", "geometry"], "admin_clean")

print("Agregasi ke tingkat kabupaten/kota...")
agg_df = gdf.groupby(group_cols)[drought_cols].mean().reset_index()

agg_df = agg_df.rename(columns={
    "id_kabkota_2": "id_kabkota",
    "kab_kota_2": "kab_kota",
    "prov_2": "prov"
})

print("Jumlah kab/kota hasil agregasi:", len(agg_df))
print(agg_df[drought_cols].describe())

print("Gabungkan kembali dengan geometri admin...")
admin_subset = admin[["id_kabkota", "kab_kota", "prov", "geometry"]].copy()

result = admin_subset.merge(
    agg_df,
    on=["id_kabkota", "kab_kota", "prov"],
    how="left"
)

print("Fix geometry (2D)...")
result["geometry"] = result["geometry"].apply(
    lambda geom: force_2d(geom) if geom is not None else None
)

print("Menyimpan hasil agregasi...")
result.to_file(
    output_path,
    driver="GPKG",
    engine="fiona",
    layer="kabkota_drought_stats"
)

print("Selesai: agregasi drought kabupaten berhasil.")