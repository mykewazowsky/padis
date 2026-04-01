import os
import numpy as np
import geopandas as gpd
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

input_path = os.path.join(OUTPUT_DIR, "kabkota_flood_loss_std.gpkg")
output_csv = os.path.join(OUTPUT_DIR, "kabkota_flood_aal.csv")

print("Membaca data flood loss (atribut saja)...")
df = pd.DataFrame(
    gpd.read_file(
        input_path,
        layer="kabkota_flood_loss_std",
        engine="pyogrio",
        ignore_geometry=True
    )
)

P25 = 1 / 25
P50 = 1 / 50
P100 = 1 / 100
P250 = 1 / 250

def calculate_aal(row, cols):
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
    "loss_flood_nonclimate_rp25",
    "loss_flood_nonclimate_rp50",
    "loss_flood_nonclimate_rp100",
    "loss_flood_nonclimate_rp250",
]

climate_cols = [
    "loss_flood_climate_rp25",
    "loss_flood_climate_rp50",
    "loss_flood_climate_rp100",
    "loss_flood_climate_rp250",
]

print("Menghitung AAL flood non-iklim...")
df["aal_flood_nonclimate"] = df.apply(lambda row: calculate_aal(row, nonclimate_cols), axis=1)

print("Menghitung AAL flood iklim...")
df["aal_flood_climate"] = df.apply(lambda row: calculate_aal(row, climate_cols), axis=1)

print("\nStatistik AAL flood non-iklim:")
print(df["aal_flood_nonclimate"].describe())

print("\nNULL AAL flood non-iklim:")
print(df["aal_flood_nonclimate"].isnull().sum())

print("\nStatistik AAL flood iklim:")
print(df["aal_flood_climate"].describe())

print("\nNULL AAL flood iklim:")
print(df["aal_flood_climate"].isnull().sum())

keep_cols = [
    "id_kabkota",
    "kab_kota",
    "prov",
    "total_prod",
    *nonclimate_cols,
    *climate_cols,
    "aal_flood_nonclimate",
    "aal_flood_climate",
]

keep_cols = [c for c in keep_cols if c in df.columns]
df_out = df[keep_cols].copy()

print("Menyimpan hasil AAL flood ke CSV...")
df_out.to_csv(output_csv, index=False)

print(f"Selesai: AAL flood berhasil dihitung -> {output_csv}")