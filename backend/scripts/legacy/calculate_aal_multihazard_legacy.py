import os
import numpy as np
import geopandas as gpd
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

input_path = os.path.join(OUTPUT_DIR, "kabkota_multihazard_clean.gpkg")
output_csv = os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal.csv")

print("Membaca data multi-hazard clean (atribut saja)...")
gdf_attr = pd.DataFrame(
    gpd.read_file(
        input_path,
        layer="kabkota_multihazard_clean",
        engine="pyogrio",
        ignore_geometry=True
    )
)

# annual exceedance probability
P25 = 1 / 25
P50 = 1 / 50
P100 = 1 / 100
P250 = 1 / 250

def calculate_aal_from_cols(row, cols):
    losses = [row.get(c) for c in cols]
    probs = [P25, P50, P100, P250]

    if any(v is None or pd.isna(v) for v in losses):
        return np.nan

    aal = 0.0
    for i in range(len(losses) - 1):
        l1, l2 = losses[i], losses[i + 1]
        p1, p2 = probs[i], probs[i + 1]
        aal += ((l1 + l2) / 2) * (p1 - p2)

    return aal

nonclimate_cols = [
    "loss_multi_nonclimate_rp25",
    "loss_multi_nonclimate_rp50",
    "loss_multi_nonclimate_rp100",
    "loss_multi_nonclimate_rp250",
]

climate_cols = [
    "loss_multi_climate_rp25",
    "loss_multi_climate_rp50",
    "loss_multi_climate_rp100",
    "loss_multi_climate_rp250",
]

print("Menghitung AAL non-iklim...")
gdf_attr["aal_nonclimate"] = gdf_attr.apply(
    lambda row: calculate_aal_from_cols(row, nonclimate_cols), axis=1
)

print("Menghitung AAL iklim...")
gdf_attr["aal_climate"] = gdf_attr.apply(
    lambda row: calculate_aal_from_cols(row, climate_cols), axis=1
)

print("\nStatistik AAL non-iklim:")
print(gdf_attr["aal_nonclimate"].describe())

print("\nNULL AAL non-iklim:")
print(gdf_attr["aal_nonclimate"].isnull().sum())

print("\nStatistik AAL iklim:")
print(gdf_attr["aal_climate"].describe())

print("\nNULL AAL iklim:")
print(gdf_attr["aal_climate"].isnull().sum())

keep_cols = [
    "id_kabkota",
    "kab_kota",
    "prov",
    "total_prod",
    *nonclimate_cols,
    *climate_cols,
    "aal_nonclimate",
    "aal_climate",
]

keep_cols = [c for c in keep_cols if c in gdf_attr.columns]
df_out = gdf_attr[keep_cols].copy()

print("Menyimpan hasil AAL ke CSV...")
df_out.to_csv(output_csv, index=False)

print(f"Selesai: AAL clean berhasil dihitung -> {output_csv}")