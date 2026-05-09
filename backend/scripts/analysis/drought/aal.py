import numpy as np
import pandas as pd
import re


def extract_rp(col_name: str) -> int:
    match = re.search(r"rp(\d+)", col_name)
    if not match:
        raise ValueError(f"Tidak bisa extract RP dari {col_name}")
    return int(match.group(1))


def enforce_monotonic(losses):
    # AAL integration assumes losses do not decrease as events become rarer
    # and more severe. This correction keeps the exceedance curve physical.
    corrected = losses.copy()
    for i in range(1, len(corrected)):
        if corrected[i] < corrected[i-1]:
            corrected[i] = corrected[i-1]
    return corrected


def calculate_aal(losses: list[float], probs: list[float]) -> float:
    """
    Estimate Average Annual Loss from sampled return periods.

    Probabilities are 1/RP. The loop integrates adjacent points with the
    trapezoid rule; the last term approximates the tail beyond the rarest RP.
    """

    # FIX NULL → 0
    losses = [0 if pd.isna(v) else v for v in losses]

    aal = 0.0

    for i in range(len(losses) - 1):
        aal += ((losses[i] + losses[i+1]) / 2.0) * (probs[i] - probs[i+1])

    # tail
    aal += losses[-1] * probs[-1]

    return aal


def compute_aal_drought(df: pd.DataFrame) -> pd.DataFrame:

    # =========================
    # DETECT COLUMNS
    # =========================
    nonclimate_cols = [c for c in df.columns if c.startswith("loss_drought_nonclimate_")]
    climate_cols = [c for c in df.columns if c.startswith("loss_drought_climate_")]

    if not nonclimate_cols or not climate_cols:
        raise ValueError("Kolom loss drought tidak lengkap")

    # =========================
    # SORT BERDASARKAN PROBABILITAS (DESC)
    # =========================
    pairs_nc = sorted(
        [(extract_rp(c), c) for c in nonclimate_cols],
        key=lambda x: 1/x[0],
        reverse=True
    )

    pairs_cl = sorted(
        [(extract_rp(c), c) for c in climate_cols],
        key=lambda x: 1/x[0],
        reverse=True
    )

    nonclimate_cols = [c for _, c in pairs_nc]
    climate_cols = [c for _, c in pairs_cl]

    probs_nc = [1/rp for rp, _ in pairs_nc]
    probs_cl = [1/rp for rp, _ in pairs_cl]

    # =========================
    # COMPUTE AAL
    # =========================
    df["aal_drought_nonclimate"] = df.apply(
        lambda row: calculate_aal(
            enforce_monotonic([row[c] for c in nonclimate_cols]),
            probs_nc
        ),
        axis=1
    )

    df["aal_drought_climate"] = df.apply(
        lambda row: calculate_aal(
            enforce_monotonic([row[c] for c in climate_cols]),
            probs_cl
        ),
        axis=1
    )

    return df
