"""
aggregate_flood_kabkota.py

Mengagregasi flood stats dari level sawah ke level kabupaten/kota,
lalu menggabungkannya dengan geometri admin.
"""

import os
import geopandas as gpd
from shapely import force_2d

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

output_folder = os.path.join(PROJECT_ROOT, "data", "output")
processed_folder = os.path.join(PROJECT_ROOT, "data", "processed")

input_path = os.path.join(output_folder, "sawah_hazard_stats.geojson")
admin_path = os.path.join(processed_folder, "admin_clean.geojson")
output_path = os.path.join(output_folder, "kabkota_flood_stats.geojson")

hazard_cols = [
    "mean_r25", "mean_r50", "mean_r100", "mean_r250",
    "mean_rc25", "mean_rc50", "mean_rc100", "mean_rc250"
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

print("Membaca data sawah hazard stats...")
gdf = gpd.read_file(input_path, engine="fiona")

print("Membaca data admin...")
admin = gpd.read_file(admin_path, engine="fiona")

group_cols = ["id_kabkota_2", "kab_kota_2", "prov_2"]

require_columns(gdf, [*group_cols, *hazard_cols], "sawah_hazard_stats")
require_columns(admin, ["id_kabkota", "kab_kota", "prov", "geometry"], "admin_clean")

print("Agregasi ke tingkat kabupaten/kota...")
agg_df = gdf.groupby(group_cols)[hazard_cols].mean().reset_index()

agg_df = agg_df.rename(columns={
    "id_kabkota_2": "id_kabkota",
    "kab_kota_2": "kab_kota",
    "prov_2": "prov"
})

print("Jumlah kab/kota hasil agregasi:", len(agg_df))
print(agg_df[hazard_cols].describe())

print("Gabungkan kembali dengan geometri admin...")
admin_subset = admin[["id_kabkota", "kab_kota", "prov", "geometry"]].copy()

result = admin_subset.merge(
    agg_df,
    on=["id_kabkota", "kab_kota", "prov"],
    how="left"
)

print("Cek kualitas geometry hasil merge...")
print("Jumlah fitur result:", len(result))
print("Jumlah geometry null:", result.geometry.isnull().sum())
print("Jumlah geometry empty:", result.geometry.is_empty.sum())
print("Jumlah geometry invalid:", (~result.is_valid).sum())

result = result[result.geometry.notnull()]
result = result[~result.geometry.is_empty]
result = result[result.is_valid].copy()

print("Menghapus dimensi Z (3D -> 2D)...")
result["geometry"] = result["geometry"].apply(
    lambda geom: force_2d(geom) if geom is not None else None
)

save_cols = [
    "id_kabkota", "kab_kota", "prov",
    "mean_r25", "mean_r50", "mean_r100", "mean_r250",
    "mean_rc25", "mean_rc50", "mean_rc100", "mean_rc250",
    "geometry"
]

require_columns(result, save_cols, "result flood stats")

result_save = result[save_cols].copy()

print("Menyimpan hasil agregasi kabupaten/kota...")
result_save.to_file(output_path, driver="GeoJSON", engine="fiona")

print("Selesai: agregasi flood kabupaten/kota berhasil.")