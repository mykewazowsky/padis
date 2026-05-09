import re
import geopandas as gpd

from backend.scripts.config.settings import GABAH_KERING_PANEN

W_FLOOD = 0.678
W_DROUGHT = 0.322
# Relative hazard weights used to combine single-hazard losses. Keep these
# values traceable to the capstone method section because they directly affect
# every multi-hazard loss and AAL output.


# ===============================
# HELPERS
# ===============================
def extract_rp(col_name: str) -> int:
    match = re.search(r"rp(\d+)", col_name)
    if not match:
        raise ValueError(f"Tidak bisa ekstrak RP dari: {col_name}")
    return int(match.group(1))


# ===============================
# MERGE (FIXED)
# ===============================
def merge_hazards(
    flood: gpd.GeoDataFrame,
    drought: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    """
    Join completed flood and drought outputs at id_kabkota level.

    Multi-hazard analysis deliberately depends on validated single-hazard
    outputs so that the combined layer inherits the same district geometry and
    return-period naming convention.
    """

    flood = flood.copy()
    drought = drought.copy()

    # samakan tipe
    flood["id_kabkota"] = flood["id_kabkota"].astype(str).str.strip()
    drought["id_kabkota"] = drought["id_kabkota"].astype(str).str.strip()

    # =========================
    # AMBIL KOLOM PENTING SAJA DARI DROUGHT
    # =========================
    drought_cols = [
        c for c in drought.columns
        if c.startswith("loss_drought_") or c.startswith("aal_drought_")
    ]

    drought_subset = drought[["id_kabkota"] + drought_cols]

    # =========================
    # MERGE TANPA SUFFIX
    # =========================
    gdf = flood.merge(
        drought_subset,
        on="id_kabkota",
        how="inner"
    )

    if gdf.empty:
        raise ValueError("Hasil merge flood x drought kosong")

    return gdf


# ===============================
# MAIN COMPUTE
# ===============================
def compute_multihazard_loss(
    gdf: gpd.GeoDataFrame,
    gabah: float = GABAH_KERING_PANEN,
) -> gpd.GeoDataFrame:
    """
    Combine flood and drought loss columns per matching return period.

    Formula:
        loss_multi = loss_flood * W_FLOOD + loss_drought * W_DROUGHT
    """

    gdf = gdf.copy()

    # =========================
    # DETECT LOSS COLUMNS
    # =========================
    flood_nc = sorted(
        [c for c in gdf.columns if c.startswith("loss_flood_nonclimate")],
        key=extract_rp
    )

    flood_cl = sorted(
        [c for c in gdf.columns if c.startswith("loss_flood_climate")],
        key=extract_rp
    )

    drought_nc = sorted(
        [c for c in gdf.columns if c.startswith("loss_drought_nonclimate")],
        key=extract_rp
    )

    drought_cl = sorted(
        [c for c in gdf.columns if c.startswith("loss_drought_climate")],
        key=extract_rp
    )

    # =========================
    # VALIDASI
    # =========================
    for cols, label in [
        (flood_nc, "loss_flood nonclimate"),
        (flood_cl, "loss_flood climate"),
        (drought_nc, "loss_drought nonclimate"),
        (drought_cl, "loss_drought climate"),
    ]:
        if not cols:
            raise ValueError(f"Kolom {label} tidak ditemukan")

    # =========================
    # MATCH RP
    # =========================
    rp_sets = [
        {extract_rp(c) for c in flood_nc},
        {extract_rp(c) for c in flood_cl},
        {extract_rp(c) for c in drought_nc},
        {extract_rp(c) for c in drought_cl},
    ]

    common_rps = sorted(rp_sets[0].intersection(*rp_sets[1:]))

    if not common_rps:
        raise ValueError("Tidak ada RP yang sama antara flood dan drought")

    # =========================
    # BUILD MAP
    # =========================
    flood_nc_map = {extract_rp(c): c for c in flood_nc}
    flood_cl_map = {extract_rp(c): c for c in flood_cl}
    drought_nc_map = {extract_rp(c): c for c in drought_nc}
    drought_cl_map = {extract_rp(c): c for c in drought_cl}

    # =========================
    # COMPUTE MULTI LOSS
    # =========================
    for rp in common_rps:

        # NON-CLIMATE
        gdf[f"loss_multi_nonclimate_rp{rp}"] = (
            gdf[flood_nc_map[rp]] * W_FLOOD +
            gdf[drought_nc_map[rp]] * W_DROUGHT
        )

        # CLIMATE
        gdf[f"loss_multi_climate_rp{rp}"] = (
            gdf[flood_cl_map[rp]] * W_FLOOD +
            gdf[drought_cl_map[rp]] * W_DROUGHT
        )

    return gdf
