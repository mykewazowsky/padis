import geopandas as gpd


REQUIRED_COLUMNS = [
    "id_kabkota",
    "kab_kota",
    "prov",
    "total_prod",
    "aal_drought_nonclimate",
    "aal_drought_climate",
    "geometry",
]


def aggregate_drought(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # =========================
    # VALIDATION
    # =========================
    missing = [c for c in REQUIRED_COLUMNS if c not in gdf.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan: {missing}")

    # =========================
    # OPTIONAL COLUMNS (LOSS ONLY)
    # =========================
    optional_cols = [
        c for c in gdf.columns
        if c.startswith("loss_drought_")
    ]

    # =========================
    # FINAL STRUCTURE
    # =========================
    final_cols = REQUIRED_COLUMNS + optional_cols

    gdf_out = gdf[final_cols].copy()

    return gdf_out
