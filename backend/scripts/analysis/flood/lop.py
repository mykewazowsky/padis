import numpy as np
import geopandas as gpd


def flood_lop_function(x: float) -> float:
    if x is None or np.isnan(x) or x <= 0:
        return np.nan

    y = 0.2885 * np.log(x) + 0.5148

    return max(0.0, y)


def compute_lop_flood(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # auto-detect kolom flood
    flood_cols = [c for c in gdf.columns if c.startswith("mean_flood_")]

    if not flood_cols:
        raise ValueError("Tidak ada kolom mean_flood_* ditemukan")

    for col in flood_cols:
        new_col = col.replace("mean_", "lop_")
        gdf[new_col] = gdf[col].apply(flood_lop_function)

    return gdf