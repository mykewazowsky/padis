import geopandas as gpd

from .multihazard import (
    merge_hazards,
    compute_multihazard_loss,
)
from .aal import compute_aal_multihazard
from .aggregate import aggregate_multihazard


def run_multihazard_analysis(flood_path: str, drought_path: str) -> str:
    print("[MULTI] Load flood...")
    flood = gpd.read_file(flood_path)

    print("[MULTI] Load drought...")
    drought = gpd.read_file(drought_path)

    print("[MULTI] Merge...")
    gdf = merge_hazards(flood, drought)

    print("[MULTI] Compute loss...")
    gdf = compute_multihazard_loss(gdf)

    print("[MULTI] Compute AAL...")
    gdf = compute_aal_multihazard(gdf)

    print("[MULTI] Aggregate...")
    gdf_final = aggregate_multihazard(gdf)

    output_path = flood_path.replace("_flood_final.geojson", "_multihazard.geojson")

    gdf_final.to_file(output_path, driver="GeoJSON")

    print(f"[MULTI] DONE → {output_path}")

    return output_path
