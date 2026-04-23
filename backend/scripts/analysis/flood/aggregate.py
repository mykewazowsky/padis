import geopandas as gpd


def aggregate_flood(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:

    # =========================
    # VALIDATION
    # =========================
    required_cols = [
        "id_kabkota",
        "kab_kota",
        "prov",
        "total_prod",
        "aal_flood_nonclimate",
        "aal_flood_climate",
        "geometry"
    ]

    missing = [c for c in required_cols if c not in gdf.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan: {missing}")

    # =========================
    # LOSS COLUMNS
    # =========================
    loss_cols = sorted(
        [c for c in gdf.columns if c.startswith("loss_flood_")]
    )

    # =========================
    # FINAL STRUCTURE
    # =========================
    keep_cols = required_cols + loss_cols

    gdf_out = gdf[keep_cols].copy()

    return gdf_out