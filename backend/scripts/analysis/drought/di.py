import geopandas as gpd


def compute_di_drought(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    DI drought = nilai mean zonal (karena raster sudah 0–1)

    Transform:
    mean_drought_* → di_drought_*
    """

    # =========================
    # AUTO DETECT KOLOM
    # =========================
    mean_cols = [c for c in gdf.columns if c.startswith("mean_drought_")]

    if not mean_cols:
        raise ValueError("Tidak ada kolom mean_drought_* ditemukan")

    # =========================
    # ASSIGN DI
    # =========================
    for col in mean_cols:
        new_col = col.replace("mean_", "di_")
        gdf[new_col] = gdf[col]

    return gdf
