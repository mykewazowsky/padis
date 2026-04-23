import os
import pandas as pd
import geopandas as gpd

from .lop import compute_lop_drought
from .loss_kabkota import compute_loss_drought_kab
from .aal import compute_aal_drought
from .aggregate import aggregate_drought


def run_drought_analysis(input_path: str) -> str:
    print("[DROUGHT] Load zonal...")
    gdf = gpd.read_file(input_path)

    print("[DROUGHT] LOP...")
    gdf = compute_lop_drought(gdf)

    print("[DROUGHT] Load produksi...")
    prod = pd.read_csv("data/raw/exposure/totalproduksipadi.csv")

    print("[DROUGHT] LOSS...")
    gdf = compute_loss_drought_kab(gdf, prod)

    print("[DROUGHT] AAL...")
    df = compute_aal_drought(gdf)

    print("[DROUGHT] AGGREGATE...")
    gdf_final = aggregate_drought(df)

    output_path = input_path.replace("_stats.geojson", "_drought_final.geojson")

    gdf_final.to_file(output_path, driver="GeoJSON")

    print(f"[DROUGHT] DONE → {output_path}")

    return output_path