import os
import geopandas as gpd
import shapely

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

input_path = os.path.join(PROJECT_ROOT, "data", "output", "kabkota_multihazard_loss.gpkg")
output_dir = os.path.join(PROJECT_ROOT, "data", "output")
os.makedirs(output_dir, exist_ok=True)

scenarios = {
    "rp25": "loss_multi_rp25",
    "rp50": "loss_multi_rp50",
    "rp100": "loss_multi_rp100",
    "rp250": "loss_multi_rp250",
}

print("Membaca multi-hazard source...")
gdf = gpd.read_file(input_path, layer="kabkota_multihazard_loss", engine="fiona")

kab_col = [c for c in gdf.columns if "kab_kota" in c][0]
prov_col = [c for c in gdf.columns if "prov" in c][0]

gdf["geometry"] = gdf["geometry"].apply(
    lambda geom: shapely.force_2d(geom) if geom is not None else None
)

gdf = gdf[gdf.geometry.notnull()]
gdf = gdf[~gdf.geometry.is_empty]
gdf = gdf[gdf.is_valid].copy()

for key, loss_col in scenarios.items():
    print(f"Menyiapkan web layer {key} ...")

    out = gdf[["id_kabkota", kab_col, prov_col, loss_col, "geometry"]].copy()
    out = out.rename(columns={
        kab_col: "kab_kota",
        prov_col: "prov",
        loss_col: "loss"
    })

    out["geometry"] = out["geometry"].simplify(0.05, preserve_topology=True)

    # karena multi-hazard saat ini hanya valid di area yang punya data flood
    out = out[out["loss"].notna()]
    out = out[out["loss"] > 0]

    # batasi dulu untuk prototipe web
    out = out.head(100)

    output_path = os.path.join(output_dir, f"web_multihazard_{key}.geojson")
    out.to_file(output_path, driver="GeoJSON", engine="fiona")

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"{output_path} -> {size_mb:.2f} MB")

print("Selesai: web layers multi-hazard siap.")