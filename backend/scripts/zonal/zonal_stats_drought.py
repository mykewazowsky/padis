"""
zonal_stats_drought.py

Menghitung zonal statistics drought untuk seluruh skenario
GPM dan MME pada polygon sawah-admin.

Output:
- sawah_drought_stats.gpkg
"""

import os
import geopandas as gpd
from rasterstats import zonal_stats
from shapely import force_2d

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

processed_folder = os.path.join(PROJECT_ROOT, "data", "processed")
output_folder = os.path.join(PROJECT_ROOT, "data", "output")
os.makedirs(output_folder, exist_ok=True)

vector_path = os.path.join(processed_folder, "sawah_admin_intersection.geojson")
output_path = os.path.join(output_folder, "sawah_drought_stats.gpkg")

rasters = {
    "mean_mme_rp25": "reproj_mme_rp25.tif",
    "mean_mme_rp50": "reproj_mme_rp50.tif",
    "mean_mme_rp100": "reproj_mme_rp100.tif",
    "mean_mme_rp250": "reproj_mme_rp250.tif",
    "mean_gpm_rp25": "reproj_gpm_rp25.tif",
    "mean_gpm_rp50": "reproj_gpm_rp50.tif",
    "mean_gpm_rp100": "reproj_gpm_rp100.tif",
    "mean_gpm_rp250": "reproj_gpm_rp250.tif",
}


def require_file(path: str, label: str) -> None:
    if not os.path.exists(path):
        raise FileNotFoundError(f"{label} tidak ditemukan: {path}")


def require_columns(df, columns, label: str) -> None:
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


require_file(vector_path, "Vector input")
for raster_file in rasters.values():
    require_file(os.path.join(processed_folder, raster_file), f"Raster {raster_file}")

print("[zonal_stats_drought] Membaca polygon sawah-admin...")
gdf = gpd.read_file(vector_path, engine="fiona")

if gdf.empty:
    raise ValueError("GeoDataFrame kosong: sawah_admin_intersection.geojson")

require_columns(gdf, ["geometry"], "sawah_admin_intersection.geojson")

print("[zonal_stats_drought] Menghapus dimensi Z (3D -> 2D) jika ada...")
gdf["geometry"] = gdf["geometry"].apply(
    lambda geom: force_2d(geom) if geom is not None else None
)

for field_name, raster_file in rasters.items():
    raster_path = os.path.join(processed_folder, raster_file)

    print(f"[zonal_stats_drought] Menghitung zonal stats untuk {raster_file} ...")

    stats = zonal_stats(
        gdf,
        raster_path,
        stats=["mean"],
        nodata=-9999,
        geojson_out=False,
    )

    gdf[field_name] = [s["mean"] for s in stats]

drought_cols = list(rasters.keys())

print("\n[zonal_stats_drought] Cek statistik drought:")
print(gdf[drought_cols].describe())

print("\n[zonal_stats_drought] Cek jumlah NULL:")
print(gdf[drought_cols].isnull().sum())

print("[zonal_stats_drought] Menyimpan hasil zonal stats kekeringan...")
gdf.to_file(
    output_path,
    driver="GPKG",
    engine="fiona",
    layer="sawah_drought_stats"
)

print("[zonal_stats_drought] Selesai: zonal stats kekeringan berhasil.")