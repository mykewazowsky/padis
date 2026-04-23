import re


# ===============================
# NORMALIZE HAZARD NAME
# ===============================
def normalize_hazard(hazard: str) -> str:
    """
    Samakan penamaan hazard
    """
    if hazard == "multi":
        return "multihazard"
    return hazard


# ===============================
# PARSE LOSS COLUMN
# ===============================
def parse_loss(col: str):
    """
    contoh:
    - loss_flood_climate_rp100
    - loss_drought_nonclimate_rp25
    - loss_multi_climate_rp50
    """

    try:
        parts = col.split("_")

        hazard = normalize_hazard(parts[1])
        scenario = parts[2]

        rp_match = re.search(r"rp(\d+)", col)
        if not rp_match:
            raise ValueError

        rp = int(rp_match.group(1))

        return hazard, scenario, rp

    except Exception:
        raise ValueError(f"Invalid loss column format: {col}")


# ===============================
# PARSE ZONAL COLUMN
# ===============================
def parse_zonal(col: str):
    """
    contoh:
    - mean_flood_r100
    - mean_flood_rc100
    - mean_multi_rc50
    """

    try:
        parts = col.split("_")

        hazard = normalize_hazard(parts[1])

        # scenario
        if "rc" in col:
            scenario = "climate"
        else:
            scenario = "nonclimate"

        rp_match = re.search(r"\d+", col)
        if not rp_match:
            raise ValueError

        rp = int(rp_match.group())

        return hazard, scenario, rp

    except Exception:
        raise ValueError(f"Invalid zonal column format: {col}")


# ===============================
# PARSE AAL COLUMN
# ===============================
def parse_aal(col: str):
    """
    contoh:
    - aal_flood_climate
    - aal_drought_nonclimate
    - aal_multi_climate
    """

    try:
        parts = col.split("_")

        hazard = normalize_hazard(parts[1])
        scenario = parts[2]

        return hazard, scenario

    except Exception:
        raise ValueError(f"Invalid AAL column format: {col}")