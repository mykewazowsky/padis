import os
import geopandas as gpd
import shapely

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
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

print("Membaca drought source...")
gdf = gpd.read_file(input_path, layer="kabkota_drought_loss_std", engine="fiona")

gdf["geometry"] = gdf["geometry"].apply(
    lambda geom: shapely.force_2d(geom) if geom is not None else None
)

gdf = gdf[gdf.geometry.notnull()]
gdf = gdf[~gdf.geometry.is_empty]
gdf = gdf[gdf.is_valid].copy()

for rp, cols in scenarios.items():
    for climate_key, loss_col in cols.items():
        print(f"Menyiapkan drought {climate_key} {rp} ...")

        out = gdf[["id_kabkota", "kab_kota", "prov", loss_col, "geometry"]].copy()
        out = out.rename(columns={loss_col: "loss"})

        out = out[out["loss"].notna()]
        out = out[out["loss"] > 0]
        out["geometry"] = out["geometry"].simplify(0.05, preserve_topology=True)
        out = out.head(100)

        output_path = os.path.join(OUTPUT_DIR, f"web_drought_{climate_key}_{rp}.geojson")
        out.to_file(output_path, driver="GeoJSON", engine="fiona")

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"{output_path} -> {size_mb:.2f} MB")

print("Selesai: web drought split layers siap.")