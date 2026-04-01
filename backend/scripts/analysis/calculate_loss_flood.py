"""
calculate_loss_flood.py

Menghitung loss banjir per kabupaten/kota berdasarkan
layer LOP flood dan total produksi padi.

Output:
- kabkota_flood_loss.gpkg
"""

import os
import pandas as pd
import geopandas as gpd

# ===============================
# PATH SETUP
# ===============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

lop_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_flood_lop.gpkg")
prod_path = os.path.join(PROJECT_ROOT, "data", "raw", "total_prod_padi.csv")
output_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_flood_loss.gpkg")

GABAH_KERING_PANEN = 6500000

lop_cols = [
    "lop_r25", "lop_r50", "lop_r100", "lop_r250",
    "lop_rc25", "lop_rc50", "lop_rc100", "lop_rc250"
]


# ===============================
# VALIDATION
# ===============================
def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File tidak ditemukan: {path}")


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


# ===============================
# LOAD DATA
# ===============================
require_file(lop_path)
require_file(prod_path)

print("Membaca data LOP banjir...")
gdf = gpd.read_file(lop_path, layer="kabkota_flood_lop", engine="fiona")

print("Membaca data total produksi padi...")
prod_df = pd.read_csv(prod_path)

require_columns(gdf, ["id_kabkota", *lop_cols], "kabkota_flood_lop")
require_columns(prod_df, ["id_kabkota", "total_prod"], "total_prod_padi.csv")

# samakan tipe ID
gdf["id_kabkota"] = gdf["id_kabkota"].astype(str)
prod_df["id_kabkota"] = prod_df["id_kabkota"].astype(str)


# ===============================
# JOIN
# ===============================
print("Join data produksi ke layer kabupaten...")
gdf = gdf.merge(
    prod_df[["id_kabkota", "total_prod"]],
    on="id_kabkota",
    how="left",
)


# ===============================
# CALCULATE LOSS
# ===============================
print("Menghitung loss banjir...")

for col in lop_cols:
    loss_col = col.replace("lop_", "loss_")
    gdf[loss_col] = gdf["total_prod"] * gdf[col] * GABAH_KERING_PANEN

loss_cols = [c.replace("lop_", "loss_") for c in lop_cols]


# ===============================
# DEBUG OUTPUT
# ===============================
print("\nStatistik loss:")
print(gdf[loss_cols].describe())

print("\nNULL loss:")
print(gdf[loss_cols].isnull().sum())


# ===============================
# SAVE OUTPUT
# ===============================
print("Menyimpan hasil loss banjir...")
gdf.to_file(
    output_path,
    driver="GPKG",
    engine="fiona",
    layer="kabkota_flood_loss"
)

print("Selesai: Loss banjir berhasil dihitung.")