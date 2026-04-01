"""
calculate_loss_drought.py

Menghitung loss kekeringan per kabupaten/kota berdasarkan
layer LOP drought dan total produksi padi.
"""

import os
import pandas as pd
import geopandas as gpd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

lop_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_drought_lop.gpkg")
prod_path = os.path.join(PROJECT_ROOT, "data", "raw", "total_prod_padi.csv")
output_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_drought_loss.gpkg")

GABAH_KERING_PANEN = 6500000

lop_cols = [
    "lop_mme_rp25", "lop_mme_rp50", "lop_mme_rp100", "lop_mme_rp250",
    "lop_gpm_rp25", "lop_gpm_rp50", "lop_gpm_rp100", "lop_gpm_rp250"
]


def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File tidak ditemukan: {path}")


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


require_file(lop_path)
require_file(prod_path)

print("Membaca data LOP kekeringan...")
gdf = gpd.read_file(lop_path, layer="kabkota_drought_lop", engine="fiona")

print("Membaca data total produksi padi...")
prod_df = pd.read_csv(prod_path)

require_columns(gdf, ["id_kabkota", *lop_cols], "kabkota_drought_lop")
require_columns(prod_df, ["id_kabkota", "total_prod"], "total_prod_padi.csv")

gdf["id_kabkota"] = gdf["id_kabkota"].astype(str)
prod_df["id_kabkota"] = prod_df["id_kabkota"].astype(str)

print("Join data produksi ke layer kabupaten...")
gdf = gdf.merge(
    prod_df[["id_kabkota", "total_prod"]],
    on="id_kabkota",
    how="left",
)

print("Menghitung loss kekeringan...")
for col in lop_cols:
    loss_col = col.replace("lop_", "loss_")
    gdf[loss_col] = gdf["total_prod"] * gdf[col] * GABAH_KERING_PANEN

loss_cols = [c.replace("lop_", "loss_") for c in lop_cols]

print("\nStatistik loss kekeringan:")
print(gdf[loss_cols].describe())

print("\nCek NULL:")
print(gdf[loss_cols].isnull().sum())

print("Menyimpan hasil loss kekeringan...")
gdf.to_file(output_path, driver="GPKG", engine="fiona", layer="kabkota_drought_loss")

print("Selesai: Loss kekeringan berhasil dihitung.")