import os
import numpy as np
import geopandas as gpd
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

input_path = os.path.join(OUTPUT_DIR, "kabkota_flood_loss_std.gpkg")
output_csv = os.path.join(OUTPUT_DIR, "kabkota_flood_aal_v2.csv")

# annual exceedance probability
P25 = 1 / 25
P50 = 1 / 50
P100 = 1 / 100
P250 = 1 / 250

TAIL_METHOD = "rectangle"

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


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def calculate_aal(row, cols, tail_method="rectangle"):
    """
    Menghitung AAL dari RP25, RP50, RP100, RP250
    dengan trapezoidal rule + tail correction.
    """
    losses = [row.get(c) for c in cols]
    probs = [P25, P50, P100, P250]

    if any(v is None or pd.isna(v) for v in losses):
        return np.nan

    losses = [float(v) for v in losses]

    aal = 0.0

    for i in range(len(losses) - 1):
        l1, l2 = losses[i], losses[i + 1]
        p1, p2 = probs[i], probs[i + 1]
        aal += ((l1 + l2) / 2.0) * (p1 - p2)

    l_last = losses[-1]
    p_last = probs[-1]

    if tail_method == "rectangle":
        aal += l_last * p_last
    elif tail_method == "triangle":
        aal += 0.5 * l_last * p_last
    else:
        raise ValueError(f"tail_method tidak dikenali: {tail_method}")

    return aal


if not os.path.exists(input_path):
    raise FileNotFoundError(f"File input tidak ditemukan: {input_path}")

print("Membaca data flood loss (atribut saja)...")
df = pd.DataFrame(
    gpd.read_file(
        input_path,
        layer="kabkota_flood_loss_std",
        engine="pyogrio",
        ignore_geometry=True
    )
)

require_columns(
    df,
    ["id_kabkota", "kab_kota", "prov", *nonclimate_cols, *climate_cols],
    "kabkota_flood_loss_std"
)

print(f"Menghitung AAL flood non-iklim... (tail_method={TAIL_METHOD})")
df["aal_flood_nonclimate_v2"] = df.apply(
    lambda row: calculate_aal(row, nonclimate_cols, tail_method=TAIL_METHOD),
    axis=1
)

print(f"Menghitung AAL flood iklim... (tail_method={TAIL_METHOD})")
df["aal_flood_climate_v2"] = df.apply(
    lambda row: calculate_aal(row, climate_cols, tail_method=TAIL_METHOD),
    axis=1
)

matched_nonclimate = df["aal_flood_nonclimate_v2"].notna().sum()
matched_climate = df["aal_flood_climate_v2"].notna().sum()

print(f"\nAAL flood non-iklim terhitung: {matched_nonclimate}/{len(df)}")
print(f"AAL flood iklim terhitung: {matched_climate}/{len(df)}")

print("\nStatistik AAL flood non-iklim v2:")
print(df["aal_flood_nonclimate_v2"].describe())

print("\nNULL AAL flood non-iklim v2:")
print(df["aal_flood_nonclimate_v2"].isnull().sum())

print("\nStatistik AAL flood iklim v2:")
print(df["aal_flood_climate_v2"].describe())

print("\nNULL AAL flood iklim v2:")
print(df["aal_flood_climate_v2"].isnull().sum())

keep_cols = [
    "id_kabkota",
    "kab_kota",
    "prov",
    "total_prod",
    *nonclimate_cols,
    *climate_cols,
    "aal_flood_nonclimate_v2",
    "aal_flood_climate_v2",
]

keep_cols = [c for c in keep_cols if c in df.columns]
df_out = df[keep_cols].copy()

print("Menyimpan hasil AAL flood v2 ke CSV...")
df_out.to_csv(output_csv, index=False)

print(f"Selesai: AAL flood v2 berhasil dihitung -> {output_csv}")