"""
prepare_web_drought_split_v2.py

Generate web layer drought v2 untuk seluruh skenario
(non-climate dan climate) dalam format GeoJSON.
"""

import os
import geopandas as gpd
from shapely import force_2d

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

input_path = os.path.join(OUTPUT_DIR, "kabkota_drought_loss_std.gpkg")
os.makedirs(OUTPUT_DIR, exist_ok=True)

scenarios = {
    "rp25": {
        "nonclimate": "loss_drought_nonclimate_rp25",
        "climate": "loss_drought_climate_rp25",
    },
    "rp50": {
        "nonclimate": "loss_drought_nonclimate_rp50",
        "climate": "loss_drought_climate_rp50",
    },
    "rp100": {
        "nonclimate": "loss_drought_nonclimate_rp100",
        "climate": "loss_drought_climate_rp100",
    },
    "rp250": {
        "nonclimate": "loss_drought_nonclimate_rp250",
        "climate": "loss_drought_climate_rp250",
    },
}

SIMPLIFY_TOLERANCE = 0.001
APPLY_ROW_LIMIT = False
ROW_LIMIT = 100

print(f"BASE_DIR      : {BASE_DIR}")
print(f"PROJECT_ROOT  : {PROJECT_ROOT}")
print(f"OUTPUT_DIR    : {OUTPUT_DIR}")
print(f"INPUT_PATH    : {input_path}")

if not os.path.exists(input_path):
    raise FileNotFoundError(f"File input tidak ditemukan: {input_path}")

print("Membaca drought source...")
gdf = gpd.read_file(input_path, layer="kabkota_drought_loss_std", engine="fiona")

required_columns = ["id_kabkota", "kab_kota", "prov", "geometry"]
for rp_cfg in scenarios.values():
    required_columns.extend(rp_cfg.values())

missing = [col for col in required_columns if col not in gdf.columns]
if missing:
    raise ValueError(f"Kolom wajib tidak ditemukan: {missing}")

print("Force geometry ke 2D...")
gdf["geometry"] = gdf["geometry"].apply(
    lambda geom: force_2d(geom) if geom is not None else None
)

print("Cleaning geometry...")
gdf = gdf[gdf.geometry.notnull()]
gdf = gdf[~gdf.geometry.is_empty]
gdf = gdf[gdf.is_valid].copy()

print(f"Jumlah fitur awal: {len(gdf)}")

generated_files = []

for rp, cols in scenarios.items():
    for climate_key, loss_col in cols.items():
        print(f"\nMenyiapkan drought {climate_key} {rp} ...")

        out = gdf[["id_kabkota", "kab_kota", "prov", loss_col, "geometry"]].copy()
        out = out.rename(columns={loss_col: "loss"})

        out = out[out["loss"].notna()]
        out = out[out["loss"] > 0].copy()

        print(f"Fitur setelah filter loss: {len(out)}")

        out["geometry"] = out["geometry"].simplify(
            SIMPLIFY_TOLERANCE,
            preserve_topology=True
        )

        out = out[out.geometry.notnull()]
        out = out[~out.geometry.is_empty]
        out = out[out.is_valid].copy()

        if APPLY_ROW_LIMIT:
            out = out.head(ROW_LIMIT)

        output_path = os.path.join(
            OUTPUT_DIR,
            f"web_drought_{climate_key}_{rp}_v2.geojson"
        )

        out.to_file(output_path, driver="GeoJSON", engine="fiona")
        generated_files.append(output_path)

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"{output_path} -> {size_mb:.2f} MB")
        print(f"Jumlah fitur: {len(out)}")

print("\nGenerated files:")
for file in generated_files:
    print(f"- {os.path.basename(file)}")

print("\nSelesai: drought v2 siap.")