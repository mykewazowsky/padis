"""
standardize_naming.py

Menstandarkan nama kolom hasil loss flood dan drought
agar sesuai dengan schema pipeline v2.
"""

import os
import geopandas as gpd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")


def read_required(path, layer):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File tidak ditemukan: {path}")
    return gpd.read_file(path, layer=layer, engine="fiona")


def require_columns(gdf, columns, label):
    missing = [col for col in columns if col not in gdf.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def standardize_region_columns(gdf):
    if "kab_kota" not in gdf.columns:
        if "kab_kota_x" in gdf.columns:
            gdf["kab_kota"] = gdf["kab_kota_x"]
        elif "kab_kota_y" in gdf.columns:
            gdf["kab_kota"] = gdf["kab_kota_y"]

    if "prov" not in gdf.columns:
        if "prov_x" in gdf.columns:
            gdf["prov"] = gdf["prov_x"]
        elif "prov_y" in gdf.columns:
            gdf["prov"] = gdf["prov_y"]

    cols_to_drop = [c for c in gdf.columns if c.endswith("_x") or c.endswith("_y")]
    gdf = gdf.drop(columns=cols_to_drop, errors="ignore")

    return gdf


def rename_columns_if_exist(gdf, rename_map):
    existing_map = {old: new for old, new in rename_map.items() if old in gdf.columns}
    return gdf.rename(columns=existing_map)


def process_flood():
    print("\n=== FLOOD ===")
    path = os.path.join(OUTPUT_DIR, "kabkota_flood_loss.gpkg")

    gdf = read_required(path, "kabkota_flood_loss")
    gdf = standardize_region_columns(gdf)

    rename_map = {
        "loss_r25": "loss_flood_nonclimate_rp25",
        "loss_r50": "loss_flood_nonclimate_rp50",
        "loss_r100": "loss_flood_nonclimate_rp100",
        "loss_r250": "loss_flood_nonclimate_rp250",
        "loss_rc25": "loss_flood_climate_rp25",
        "loss_rc50": "loss_flood_climate_rp50",
        "loss_rc100": "loss_flood_climate_rp100",
        "loss_rc250": "loss_flood_climate_rp250",
    }

    gdf = rename_columns_if_exist(gdf, rename_map)

    required_output_cols = [
        "id_kabkota",
        "kab_kota",
        "prov",
        "loss_flood_nonclimate_rp25",
        "loss_flood_nonclimate_rp50",
        "loss_flood_nonclimate_rp100",
        "loss_flood_nonclimate_rp250",
        "loss_flood_climate_rp25",
        "loss_flood_climate_rp50",
        "loss_flood_climate_rp100",
        "loss_flood_climate_rp250",
    ]
    require_columns(gdf, required_output_cols, "kabkota_flood_loss_std")

    out_path = path.replace(".gpkg", "_std.gpkg")
    gdf.to_file(out_path, driver="GPKG", engine="fiona", layer="kabkota_flood_loss_std")

    print("DONE flood:", out_path)


def process_drought():
    print("\n=== DROUGHT ===")
    path = os.path.join(OUTPUT_DIR, "kabkota_drought_loss.gpkg")

    gdf = read_required(path, "kabkota_drought_loss")
    gdf = standardize_region_columns(gdf)

    rename_map = {
        "loss_gpm_rp25": "loss_drought_nonclimate_rp25",
        "loss_gpm_rp50": "loss_drought_nonclimate_rp50",
        "loss_gpm_rp100": "loss_drought_nonclimate_rp100",
        "loss_gpm_rp250": "loss_drought_nonclimate_rp250",
        "loss_mme_rp25": "loss_drought_climate_rp25",
        "loss_mme_rp50": "loss_drought_climate_rp50",
        "loss_mme_rp100": "loss_drought_climate_rp100",
        "loss_mme_rp250": "loss_drought_climate_rp250",
    }

    gdf = rename_columns_if_exist(gdf, rename_map)

    required_output_cols = [
        "id_kabkota",
        "kab_kota",
        "prov",
        "loss_drought_nonclimate_rp25",
        "loss_drought_nonclimate_rp50",
        "loss_drought_nonclimate_rp100",
        "loss_drought_nonclimate_rp250",
        "loss_drought_climate_rp25",
        "loss_drought_climate_rp50",
        "loss_drought_climate_rp100",
        "loss_drought_climate_rp250",
    ]
    require_columns(gdf, required_output_cols, "kabkota_drought_loss_std")

    out_path = path.replace(".gpkg", "_std.gpkg")
    gdf.to_file(out_path, driver="GPKG", engine="fiona", layer="kabkota_drought_loss_std")

    print("DONE drought:", out_path)


if __name__ == "__main__":
    process_flood()
    process_drought()
    print("\nSTANDARDIZATION COMPLETE")