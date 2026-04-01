import os
import geopandas as gpd
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

flood_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_flood_lop.gpkg")
drought_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_drought_lop.gpkg")
prod_path = os.path.join(PROJECT_ROOT, "data", "raw", "total_prod_padi.csv")

output_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_multihazard_loss.gpkg")

GABAH = 6500
BOBOT_BANJIR = 0.678
BOBOT_KEKERINGAN = 0.322

print("Membaca data flood...")
flood = gpd.read_file(flood_path, layer="kabkota_flood_lop", engine="fiona")

print("Membaca data drought...")
drought = gpd.read_file(drought_path, layer="kabkota_drought_lop", engine="fiona")

print("Membaca data produksi...")
prod = pd.read_csv(prod_path)

# samakan tipe ID
flood["id_kabkota"] = flood["id_kabkota"].astype(str)
drought["id_kabkota"] = drought["id_kabkota"].astype(str)
prod["id_kabkota"] = prod["id_kabkota"].astype(str)

print("Gabungkan flood + drought...")
gdf = flood.merge(
    drought.drop(columns="geometry"),
    on="id_kabkota",
    how="outer"
)

print("Gabungkan dengan produksi...")
gdf = gdf.merge(
    prod[["id_kabkota", "total_prod"]],
    on="id_kabkota",
    how="left"
)

print("Menghitung multi-hazard loss...")

pairs = [
    ("lop_r25", "lop_mme_rp25", "loss_multi_rp25"),
    ("lop_r50", "lop_mme_rp50", "loss_multi_rp50"),
    ("lop_r100", "lop_mme_rp100", "loss_multi_rp100"),
    ("lop_r250", "lop_mme_rp250", "loss_multi_rp250"),
]

for flood_col, drought_col, out_col in pairs:
    gdf[out_col] = gdf["total_prod"] * (
        (gdf[flood_col] * BOBOT_BANJIR) +
        (gdf[drought_col] * BOBOT_KEKERINGAN)
    ) * GABAH

multi_cols = [p[2] for p in pairs]

print("\nStatistik multi-hazard:")
print(gdf[multi_cols].describe())

print("\nCek NULL:")
print(gdf[multi_cols].isnull().sum())

print("Menyimpan hasil multi-hazard...")
gdf.to_file(output_path, driver="GPKG", engine="fiona", layer="kabkota_multihazard_loss")

print("Selesai: Multi-hazard berhasil dihitung.")