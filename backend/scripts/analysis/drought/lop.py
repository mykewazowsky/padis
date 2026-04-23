import numpy as np
import geopandas as gpd


def drought_polynomial(x: float) -> float:
    """
    Polynomial vulnerability function

    x = intensitas kekeringan (0–1)
    output = LOP / loss of productivity (0–1)
    """

    if x is None or np.isnan(x):
        return np.nan

    try:
        y = (
            -0.8381 * (x ** 3)
            + 0.8967 * (x ** 2)
            + 0.9064 * x
            - 0.0106
        )
    except Exception:
        return np.nan

    return max(0.0, min(1.0, y))


def compute_lop_drought(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Transform:
    di_drought_* → lop_drought_* (polynomial)
    """

    # =========================
    # DETECT KOLOM DI
    # =========================
    di_cols = [c for c in gdf.columns if c.startswith("di_drought_")]

    if not di_cols:
        raise ValueError("Tidak ada kolom di_drought_* ditemukan")

    # =========================
    # COMPUTE LOP (POLYNOMIAL)
    # =========================
    for col in di_cols:
        new_col = col.replace("di_", "lop_")
        gdf[new_col] = gdf[col].apply(drought_polynomial)

    return gdf
