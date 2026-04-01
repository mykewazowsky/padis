"""
zonal_stats_flood.py

Menghitung zonal statistics flood untuk seluruh skenario
non-climate (R) dan climate (RC) pada polygon sawah-admin.

Output:
- sawah_hazard_stats.geojson
- sawah_hazard_stats_temp.geojson
"""

import os
import gc
import time
import geopandas as gpd
from rasterstats import zonal_stats

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

processed_folder = os.path.join(PROJECT_ROOT, "data", "processed")
output_folder = os.path.join(PROJECT_ROOT, "data", "output")
os.makedirs(output_folder, exist_ok=True)

vector_path = os.path.join(processed_folder, "sawah_admin_intersection.geojson")
output_path = os.path.join(output_folder, "sawah_hazard_stats.geojson")
temp_output_path = os.path.join(output_folder, "sawah_hazard_stats_temp.geojson")

rasters = {
    "mean_r25": "reproj_R25.tif",
    "mean_r50": "reproj_R50.tif",
    "mean_r100": "reproj_R100.tif",
    "mean_r250": "reproj_R250.tif",
    "mean_rc25": "reproj_RC25.tif",
    "mean_rc50": "reproj_RC50.tif",
    "mean_rc100": "reproj_RC100.tif",
    "mean_rc250": "reproj_RC250.tif",
}

CHUNK_SIZE = 25


def require_file(path: str, label: str) -> None:
    if not os.path.exists(path):
        raise FileNotFoundError(f"{label} tidak ditemukan: {path}")


def require_columns(df, columns, label: str) -> None:
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def compute_chunked_zonal_stats(gdf, raster_path: str, field_name: str, chunk_size: int = 25):
    values = []

    total_features = len(gdf)
    total_chunks = (total_features + chunk_size - 1) // chunk_size

    for chunk_index, start in enumerate(range(0, total_features, chunk_size), start=1):
        end = min(start + chunk_size, total_features)
        chunk = gdf.iloc[start:end].copy()

        print(
            f"[zonal_stats_flood]   chunk {chunk_index}/{total_chunks} "
            f"fitur {start + 1}-{end}"
        )

        stats = zonal_stats(
            chunk,
            raster_path,
            stats=["mean"],
            geojson_out=False,
            nodata=None,
            all_touched=False,
        )

        chunk_values = [s.get("mean") for s in stats]
        values.extend(chunk_values)

        del chunk
        del stats
        gc.collect()

    if len(values) != len(gdf):
        raise ValueError(
            f"Jumlah hasil tidak cocok untuk {field_name}: "
            f"{len(values)} != {len(gdf)}"
        )

    return values


require_file(vector_path, "Vector input")
for raster_file in rasters.values():
    require_file(os.path.join(processed_folder, raster_file), f"Raster {raster_file}")

print("[zonal_stats_flood] Membaca polygon sawah-admin...")
start_total = time.time()

gdf = gpd.read_file(vector_path, engine="fiona")
print(f"[zonal_stats_flood] Jumlah fitur: {len(gdf)}")

if gdf.empty:
    raise ValueError("GeoDataFrame kosong: sawah_admin_intersection.geojson")

require_columns(gdf, ["geometry"], "sawah_admin_intersection.geojson")

for idx, (field_name, raster_file) in enumerate(rasters.items(), start=1):
    raster_path = os.path.join(processed_folder, raster_file)

    print(f"[zonal_stats_flood] ({idx}/{len(rasters)}) Mulai raster: {raster_file}")
    step_start = time.time()

    gdf[field_name] = compute_chunked_zonal_stats(
        gdf=gdf,
        raster_path=raster_path,
        field_name=field_name,
        chunk_size=CHUNK_SIZE,
    )

    elapsed = time.time() - step_start
    print(f"[zonal_stats_flood] Selesai raster: {raster_file} ({elapsed:.2f} detik)")

    gdf.to_file(temp_output_path, driver="GeoJSON")
    print(f"[zonal_stats_flood] Temp saved: {temp_output_path}")

    gc.collect()

flood_cols = list(rasters.keys())

print("\n[zonal_stats_flood] Statistik flood:")
print(gdf[flood_cols].describe())

print("\n[zonal_stats_flood] Cek NULL:")
print(gdf[flood_cols].isnull().sum())

print("[zonal_stats_flood] Menyimpan hasil akhir...")
gdf.to_file(output_path, driver="GeoJSON")

elapsed_total = time.time() - start_total
print(f"[zonal_stats_flood] Selesai semua zonal stats flood. Total: {elapsed_total:.2f} detik")
print(f"[zonal_stats_flood] Output akhir: {output_path}")