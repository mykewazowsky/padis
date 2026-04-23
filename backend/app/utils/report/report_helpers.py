import os
import re

import pandas as pd

OUTPUT_DIR = os.path.join(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")),
    "data",
    "output",
)

AAL_MULTI_PATH = os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal_v2.csv")
AAL_FLOOD_PATH = os.path.join(OUTPUT_DIR, "kabkota_flood_aal_v2.csv")
AAL_DROUGHT_PATH = os.path.join(OUTPUT_DIR, "kabkota_drought_aal_v2.csv")

ALLOWED_HAZARDS = {"flood", "drought", "multi"}
ALLOWED_SCENARIOS = {"rp25", "rp50", "rp100", "rp250"}
ALLOWED_CLIMATE = {"nonclimate", "climate"}


def format_rupiah(value):
    try:
        return f"Rp {value:,.0f}".replace(",", ".")
    except Exception:
        return "Rp 0"


def make_region_slug(region: str) -> str:
    if not region:
        return "all-region"
    return re.sub(r"[^a-z0-9-]", "", region.lower().strip().replace(" ", "-"))


def validate_filters(hazard: str, scenario: str, climate: str):
    if hazard not in ALLOWED_HAZARDS:
        return "hazard tidak valid"
    if scenario not in ALLOWED_SCENARIOS:
        return "scenario tidak valid"
    if climate not in ALLOWED_CLIMATE:
        return "climate condition tidak valid"
    return None


def get_hazard_label(hazard: str) -> str:
    if hazard == "multi":
        return "Multi-hazard"
    if hazard == "flood":
        return "Flood"
    return "Drought"


def get_climate_label(climate: str) -> str:
    return "Climate" if climate == "climate" else "Non-Climate"


def get_geojson_path(output_dir: str, hazard: str, scenario: str, climate: str) -> str:
    file_map = {
        ("multi", "nonclimate"): os.path.join(output_dir, f"web_multi_nonclimate_{scenario}_v2.geojson"),
        ("multi", "climate"): os.path.join(output_dir, f"web_multi_climate_{scenario}_v2.geojson"),
        ("flood", "nonclimate"): os.path.join(output_dir, f"web_flood_nonclimate_{scenario}_v2.geojson"),
        ("flood", "climate"): os.path.join(output_dir, f"web_flood_climate_{scenario}_v2.geojson"),
        ("drought", "nonclimate"): os.path.join(output_dir, f"web_drought_nonclimate_{scenario}_v2.geojson"),
        ("drought", "climate"): os.path.join(output_dir, f"web_drought_climate_{scenario}_v2.geojson"),
    }
    return file_map[(hazard, climate)]


def get_aal_config(hazard: str):
    return {
        "multi": {
            "path": AAL_MULTI_PATH,
            "nonclimate_col": "aal_nonclimate_v2",
            "climate_col": "aal_climate_v2",
        },
        "flood": {
            "path": AAL_FLOOD_PATH,
            "nonclimate_col": "aal_flood_nonclimate_v2",
            "climate_col": "aal_flood_climate_v2",
        },
        "drought": {
            "path": AAL_DROUGHT_PATH,
            "nonclimate_col": "aal_drought_nonclimate_v2",
            "climate_col": "aal_drought_climate_v2",
        },
    }[hazard]


def filter_by_region(df, region: str, column_name: str = "kab_kota"):
    if not region or column_name not in df.columns:
        return df
    return df[
        df[column_name].astype(str).str.lower().str.strip() == region.lower()
    ]


def load_geo_dataframe(file_path: str, region: str = ""):
    import geopandas as gpd

    empty_metrics = {
        "total_loss": 0.0,
        "top_region": "-",
        "top_loss": 0.0,
        "data_count": 0,
        "top_regions": [],
    }

    if not os.path.exists(file_path):
        return None, empty_metrics

    gdf = gpd.read_file(file_path)
    if "loss" not in gdf.columns:
        return None, empty_metrics

    valid = gdf.dropna(subset=["loss"]).copy()
    valid = filter_by_region(valid, region, "kab_kota")

    metrics = {
        "total_loss": 0.0,
        "top_region": "-",
        "top_loss": 0.0,
        "data_count": int(valid.shape[0]),
        "top_regions": [],
    }

    if valid.empty:
        return valid, metrics

    metrics["total_loss"] = float(valid["loss"].sum())
    top_row = valid.sort_values("loss", ascending=False).iloc[0]
    metrics["top_region"] = f"{top_row['kab_kota']}, {top_row['prov']}"
    metrics["top_loss"] = float(top_row["loss"])
    metrics["top_regions"] = (
        valid[["kab_kota", "prov", "loss"]]
        .sort_values("loss", ascending=False)
        .head(8)
        .to_dict("records")
    )
    return valid, metrics


def load_aal_metrics(hazard: str, region: str = ""):
    aal_cfg = get_aal_config(hazard)

    metrics = {
        "aal_total_nonclimate": 0.0,
        "aal_total_climate": 0.0,
        "aal_delta": 0.0,
        "climate_change_pct": 0.0,
        "interpretation": "Tidak terdapat perubahan AAL yang signifikan.",
    }

    if not os.path.exists(aal_cfg["path"]):
        return metrics

    df_aal = pd.read_csv(aal_cfg["path"])
    df_aal = filter_by_region(df_aal, region, "kab_kota")

    nc = aal_cfg["nonclimate_col"]
    cc = aal_cfg["climate_col"]

    if nc in df_aal.columns:
        metrics["aal_total_nonclimate"] = float(df_aal[nc].dropna().sum())

    if cc in df_aal.columns:
        metrics["aal_total_climate"] = float(df_aal[cc].dropna().sum())

    metrics["aal_delta"] = metrics["aal_total_climate"] - metrics["aal_total_nonclimate"]

    if metrics["aal_total_nonclimate"] != 0:
        metrics["climate_change_pct"] = (
            (metrics["aal_total_climate"] - metrics["aal_total_nonclimate"])
            / metrics["aal_total_nonclimate"]
        ) * 100.0

    pct = metrics["climate_change_pct"]
    if pct > 5:
        metrics["interpretation"] = "Peningkatan AAL tergolong signifikan akibat perubahan iklim."
    elif pct > 0:
        metrics["interpretation"] = "Terdapat peningkatan AAL moderat akibat perubahan iklim."
    elif pct < 0:
        metrics["interpretation"] = "AAL menurun dibanding baseline pada konfigurasi ini."

    return metrics


def build_summary_text(
    region: str,
    scenario_label: str,
    climate_label: str,
    hazard_label: str,
    top_region: str,
    total_loss: float,
):
    if region:
        return (
            f"Pada skenario {scenario_label} dengan kondisi {climate_label}, "
            f"hazard {hazard_label} untuk wilayah {top_region} "
            f"menghasilkan total kerugian sebesar {format_rupiah(total_loss)}."
        )

    return (
        f"Pada skenario {scenario_label} dengan kondisi {climate_label}, "
        f"hazard {hazard_label} menghasilkan total kerugian sebesar "
        f"{format_rupiah(total_loss)}. Wilayah paling terdampak adalah {top_region}."
    )


def build_insight_text(
    region: str,
    top_region: str,
    total_loss: float,
    top_loss: float,
    aal_delta: float,
    climate_change_pct: float,
):
    top_region_share = (top_loss / total_loss * 100.0) if total_loss > 0 else 0.0

    if region:
        insight_text = (
            f"Total loss pada wilayah {top_region} tercatat sebesar "
            f"{format_rupiah(total_loss)}. "
        )
    else:
        insight_text = (
            f"Total loss tercatat sebesar {format_rupiah(total_loss)} dengan "
            f"{top_region} sebagai wilayah paling terdampak, menyumbang sekitar "
            f"{top_region_share:.1f}% dari total kerugian. "
        )

    if climate_change_pct > 0:
        insight_text += (
            f"Perubahan iklim meningkatkan AAL sebesar {climate_change_pct:.1f}% "
            f"dengan tambahan absolut {format_rupiah(abs(aal_delta))} per tahun."
        )
    elif climate_change_pct < 0:
        insight_text += (
            f"AAL menurun sebesar {abs(climate_change_pct):.1f}% "
            f"dengan selisih absolut {format_rupiah(abs(aal_delta))} per tahun."
        )
    else:
        insight_text += "Perubahan AAL terhadap baseline tidak signifikan."

    return insight_text
