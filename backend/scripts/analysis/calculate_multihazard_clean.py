"""
calculate_multihazard_clean.py

Menggabungkan loss flood dan drought untuk menghasilkan
loss multi-hazard final (non-climate dan climate) per kabupaten/kota.
"""

import os
import geopandas as gpd
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

flood_path = os.path.join(OUTPUT_DIR, "kabkota_flood_loss.gpkg")
drought_path = os.path.join(OUTPUT_DIR, "kabkota_drought_loss.gpkg")
prod_path = os.path.join(PROJECT_ROOT, "data", "raw", "total_prod_padi.csv")

output_path = os.path.join(OUTPUT_DIR, "kabkota_multihazard_clean.gpkg")

GABAH = 6500000
BOBOT_BANJIR = 0.678
BOBOT_KEKERINGAN = 0.322


def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File tidak ditemukan: {path}")


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def ensure_region_columns(gdf):
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

    return gdf


require_file(flood_path)
require_file(drought_path)
require_file(prod_path)

print("Membaca data flood...")
flood = gpd.read_file(flood_path, layer="kabkota_flood_loss", engine="fiona")

print("Membaca data drought...")
drought = gpd.read_file(drought_path, layer="kabkota_drought_loss", engine="fiona")

print("Membaca data produksi...")
prod = pd.read_csv(prod_path)

require_columns(
    flood,
    [
        "id_kabkota",
        "lop_r25", "lop_r50", "lop_r100", "lop_r250",
        "lop_rc25", "lop_rc50", "lop_rc100", "lop_rc250",
        "geometry",
    ],
    "kabkota_flood_loss",
)

require_columns(
    drought,
    [
        "id_kabkota",
        "lop_gpm_rp25", "lop_gpm_rp50", "lop_gpm_rp100", "lop_gpm_rp250",
        "lop_mme_rp25", "lop_mme_rp50", "lop_mme_rp100", "lop_mme_rp250",
    ],
    "kabkota_drought_loss",
)

require_columns(prod, ["id_kabkota", "total_prod"], "total_prod_padi.csv")

flood["id_kabkota"] = flood["id_kabkota"].astype(str)
drought["id_kabkota"] = drought["id_kabkota"].astype(str)
prod["id_kabkota"] = prod["id_kabkota"].astype(str)

flood = ensure_region_columns(flood)
drought = ensure_region_columns(drought)

print("Gabungkan flood + drought...")
gdf = flood.merge(
    drought.drop(columns="geometry"),
    on="id_kabkota",
    how="outer",
    suffixes=("_flood", "_drought"),
)

print("Gabungkan produksi...")
gdf = gdf.merge(
    prod[["id_kabkota", "total_prod"]],
    on="id_kabkota",
    how="left",
)

if "kab_kota" not in gdf.columns:
    for candidate in ["kab_kota_flood", "kab_kota_drought", "kab_kota_x", "kab_kota_y"]:
        if candidate in gdf.columns:
            gdf["kab_kota"] = gdf[candidate]
            break

if "prov" not in gdf.columns:
    for candidate in ["prov_flood", "prov_drought", "prov_x", "prov_y"]:
        if candidate in gdf.columns:
            gdf["prov"] = gdf[candidate]
            break

print("Menghitung multi-hazard NON-IKLIM (R + GPM)...")
pairs_nonclimate = [
    ("lop_r25", "lop_gpm_rp25", "loss_multi_nonclimate_rp25"),
    ("lop_r50", "lop_gpm_rp50", "loss_multi_nonclimate_rp50"),
    ("lop_r100", "lop_gpm_rp100", "loss_multi_nonclimate_rp100"),
    ("lop_r250", "lop_gpm_rp250", "loss_multi_nonclimate_rp250"),
]

for flood_col, drought_col, out_col in pairs_nonclimate:
    gdf[out_col] = gdf["total_prod"] * (
        (gdf[flood_col] * BOBOT_BANJIR) +
        (gdf[drought_col] * BOBOT_KEKERINGAN)
    ) * GABAH

print("Menghitung multi-hazard IKLIM (RC + MME)...")
pairs_climate = [
    ("lop_rc25", "lop_mme_rp25", "loss_multi_climate_rp25"),
    ("lop_rc50", "lop_mme_rp50", "loss_multi_climate_rp50"),
    ("lop_rc100", "lop_mme_rp100", "loss_multi_climate_rp100"),
    ("lop_rc250", "lop_mme_rp250", "loss_multi_climate_rp250"),
]

for flood_col, drought_col, out_col in pairs_climate:
    gdf[out_col] = gdf["total_prod"] * (
        (gdf[flood_col] * BOBOT_BANJIR) +
        (gdf[drought_col] * BOBOT_KEKERINGAN)
    ) * GABAH

nonclimate_cols = [x[2] for x in pairs_nonclimate]
climate_cols = [x[2] for x in pairs_climate]

print("\nStatistik NON-IKLIM:")
print(gdf[nonclimate_cols].describe())

print("\nNULL NON-IKLIM:")
print(gdf[nonclimate_cols].isnull().sum())

print("\nStatistik IKLIM:")
print(gdf[climate_cols].describe())

print("\nNULL IKLIM:")
print(gdf[climate_cols].isnull().sum())

keep_cols = [
    "id_kabkota", "kab_kota", "prov", "total_prod",
    *nonclimate_cols,
    *climate_cols,
    "geometry",
]
keep_cols = [c for c in keep_cols if c in gdf.columns]

gdf_out = gdf[keep_cols].copy()

print("Menyimpan multi-hazard clean...")
gdf_out.to_file(
    output_path,
    driver="GPKG",
    engine="fiona",
    layer="kabkota_multihazard_clean"
)

print("Selesai: multi-hazard clean berhasil dihitung.")