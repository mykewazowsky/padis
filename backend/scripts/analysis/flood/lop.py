import numpy as np
import geopandas as gpd


def flood_lop_function(x: float) -> float:
    """
    Flood vulnerability curve.

    x is inundation depth from zonal statistics, and the output is LOP
    (loss of productivity). Keep this formula close to the thesis/capstone
    method section because it is one of the main scientific assumptions.
    """
    if x is None or np.isnan(x) or x <= 0:
        return np.nan

    y = 0.2885 * np.log(x) + 0.5148

    return max(0.0, y)


def compute_lop_flood(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # Convert each flood intensity column into a matching LOP column while
    # preserving the return-period suffix used by downstream loss and AAL steps.
    flood_cols = [c for c in gdf.columns if c.startswith("mean_flood_")]

    if not flood_cols:
        raise ValueError("Tidak ada kolom mean_flood_* ditemukan")

    for col in flood_cols:
        new_col = col.replace("mean_", "lop_")
        gdf[new_col] = gdf[col].apply(flood_lop_function)

    return gdf
