import pandas as pd
import geopandas as gpd

from .lop import compute_lop_flood
from .loss_kabkota import compute_loss_flood_kab
from .aal import compute_aal_flood
from .aggregate import aggregate_flood


def run_flood_analysis(input_path: str) -> str:
    print("[FLOOD] Load zonal...")
    gdf = gpd.read_file(input_path)

    print("[FLOOD] LOP...")
    gdf = compute_lop_flood(gdf)

    print("[FLOOD] Load produksi...")
    prod = pd.read_csv("data/raw/exposure/totalproduksipadi.csv")

    print("[FLOOD] LOSS...")
    gdf = compute_loss_flood_kab(gdf, prod)

    print("[FLOOD] AAL...")
    df = compute_aal_flood(gdf)

    print("[FLOOD] AGGREGATE...")
    gdf_final = aggregate_flood(df)

    output_path = input_path.replace("_stats.geojson", "_flood_final.geojson")

    gdf_final.to_file(output_path, driver="GeoJSON")

    print(f"[FLOOD] DONE → {output_path}")

    return output_path