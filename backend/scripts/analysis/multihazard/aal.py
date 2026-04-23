import re
import numpy as np
import pandas as pd
import geopandas as gpd


# FIX: hapus P = [1/25, ...] hardcoded — RP diekstrak dinamis dari nama kolom


def extract_rp(col_name: str) -> int:
    match = re.search(r"rp(\d+)", col_name)
    if not match:
        raise ValueError(f"Tidak bisa ekstrak RP dari: {col_name}")
    return int(match.group(1))


def calculate_aal(losses: list[float], probs: list[float]) -> float:
    if any(pd.isna(v) for v in losses):
        return np.nan

    aal = 0.0

    for i in range(len(losses) - 1):
        aal += ((losses[i] + losses[i + 1]) / 2.0) * (probs[i] - probs[i + 1])

    aal += losses[-1] * probs[-1]

    return aal


def compute_aal_multihazard(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # =========================
    # DETECT COLUMNS DINAMIS
    # =========================
    nonclimate_cols = sorted(
        [c for c in gdf.columns if c.startswith("loss_multi_nonclimate_")],
        key=extract_rp
    )
    climate_cols = sorted(
        [c for c in gdf.columns if c.startswith("loss_multi_climate_")],
        key=extract_rp
    )

    if not nonclimate_cols:
        raise ValueError("Kolom loss_multi_nonclimate_* tidak ditemukan")
    if not climate_cols:
        raise ValueError("Kolom loss_multi_climate_* tidak ditemukan")

    probs_nc = [1 / extract_rp(c) for c in nonclimate_cols]
    probs_cl = [1 / extract_rp(c) for c in climate_cols]

    gdf["aal_multi_nonclimate"] = gdf.apply(
        lambda row: calculate_aal([row[c] for c in nonclimate_cols], probs_nc),
        axis=1
    )

    gdf["aal_multi_climate"] = gdf.apply(
        lambda row: calculate_aal([row[c] for c in climate_cols], probs_cl),
        axis=1
    )

    return gdf
