import os

from flask import Blueprint, request, jsonify

analytics_bp = Blueprint("analytics_bp", __name__)

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parents[2]
OUTPUT_DIR = PROJECT_ROOT / "data" / "output"

AAL_MULTI_PATH = os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal_v2.csv")
AAL_FLOOD_PATH = os.path.join(OUTPUT_DIR, "kabkota_flood_aal_v2.csv")
AAL_DROUGHT_PATH = os.path.join(OUTPUT_DIR, "kabkota_drought_aal_v2.csv")

ALLOWED_HAZARDS = {"flood", "drought", "multi"}
ALLOWED_CLIMATE = {"nonclimate", "climate"}
SCENARIOS = ["rp25", "rp50", "rp100", "rp250"]


def get_aal_config(hazard: str):
    file_map = {
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
    }
    return file_map[hazard]


def get_geojson_path(hazard: str, climate: str, scenario: str):
    file_map = {
        ("multi", "nonclimate"): os.path.join(
            OUTPUT_DIR, f"web_multi_nonclimate_{scenario}_v2.geojson"
        ),
        ("multi", "climate"): os.path.join(
            OUTPUT_DIR, f"web_multi_climate_{scenario}_v2.geojson"
        ),
        ("flood", "nonclimate"): os.path.join(
            OUTPUT_DIR, f"web_flood_nonclimate_{scenario}_v2.geojson"
        ),
        ("flood", "climate"): os.path.join(
            OUTPUT_DIR, f"web_flood_climate_{scenario}_v2.geojson"
        ),
        ("drought", "nonclimate"): os.path.join(
            OUTPUT_DIR, f"web_drought_nonclimate_{scenario}_v2.geojson"
        ),
        ("drought", "climate"): os.path.join(
            OUTPUT_DIR, f"web_drought_climate_{scenario}_v2.geojson"
        ),
    }
    return file_map[(hazard, climate)]


def get_hazard_display_name(hazard: str):
    if hazard == "flood":
        return "Flood"
    if hazard == "drought":
        return "Drought"
    return "Multi-hazard"


def get_aal_summary_by_hazard(hazard: str):
    import pandas as pd

    config = get_aal_config(hazard)
    aal_path = config["path"]
    nonclimate_col = config["nonclimate_col"]
    climate_col = config["climate_col"]

    if not os.path.exists(aal_path):
        return {
            "hazard": hazard,
            "total_aal_nonclimate": 0.0,
            "total_aal_climate": 0.0,
            "count_nonclimate": 0,
            "count_climate": 0,
            "top_nonclimate_region": "-",
            "top_nonclimate_value": 0.0,
            "top_climate_region": "-",
            "top_climate_value": 0.0,
        }

    df = pd.read_csv(aal_path)

    if nonclimate_col not in df.columns or climate_col not in df.columns:
        return {
            "hazard": hazard,
            "total_aal_nonclimate": 0.0,
            "total_aal_climate": 0.0,
            "count_nonclimate": 0,
            "count_climate": 0,
            "top_nonclimate_region": "-",
            "top_nonclimate_value": 0.0,
            "top_climate_region": "-",
            "top_climate_value": 0.0,
        }

    aal_nonclimate = df[nonclimate_col].dropna()
    aal_climate = df[climate_col].dropna()

    total_aal_nonclimate = (
        float(aal_nonclimate.sum()) if not aal_nonclimate.empty else 0.0
    )
    total_aal_climate = float(aal_climate.sum()) if not aal_climate.empty else 0.0

    top_nonclimate = (
        df.loc[df[nonclimate_col].idxmax()]
        if not aal_nonclimate.empty
        else None
    )
    top_climate = (
        df.loc[df[climate_col].idxmax()]
        if not aal_climate.empty
        else None
    )

    return {
        "hazard": hazard,
        "total_aal_nonclimate": total_aal_nonclimate,
        "total_aal_climate": total_aal_climate,
        "count_nonclimate": int(aal_nonclimate.count()),
        "count_climate": int(aal_climate.count()),
        "top_nonclimate_region": (
            f"{top_nonclimate['kab_kota']}, {top_nonclimate['prov']}"
            if top_nonclimate is not None
            else "-"
        ),
        "top_nonclimate_value": (
            float(top_nonclimate[nonclimate_col])
            if top_nonclimate is not None
            else 0.0
        ),
        "top_climate_region": (
            f"{top_climate['kab_kota']}, {top_climate['prov']}"
            if top_climate is not None
            else "-"
        ),
        "top_climate_value": (
            float(top_climate[climate_col])
            if top_climate is not None
            else 0.0
        ),
    }


def get_loss_summary_by_hazard_and_climate(hazard: str, climate: str):
    import geopandas as gpd

    results = []

    for scenario in SCENARIOS:
        file_path = get_geojson_path(hazard, climate, scenario)

        if not os.path.exists(file_path):
            results.append({
                "scenario": scenario.upper(),
                "total_loss": 0,
            })
            continue

        gdf = gpd.read_file(file_path)
        total_loss = (
            int(round(gdf["loss"].dropna().sum()))
            if "loss" in gdf.columns
            else 0
        )

        results.append({
            "scenario": scenario.upper(),
            "total_loss": total_loss,
        })

    return results


@analytics_bp.route("/api/aal-summary")
def get_aal_summary():
    hazard = request.args.get("hazard", "multi")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    result = get_aal_summary_by_hazard(hazard)
    return jsonify(result)


@analytics_bp.route("/api/aal-summary-all-hazards")
def get_aal_summary_all_hazards():
    results = []

    for hazard in ["flood", "drought", "multi"]:
        summary = get_aal_summary_by_hazard(hazard)
        results.append({
            "hazard": hazard,
            "total_aal_nonclimate": summary["total_aal_nonclimate"],
            "total_aal_climate": summary["total_aal_climate"],
        })

    return jsonify(results)


@analytics_bp.route("/api/loss-summary")
def get_loss_summary():
    hazard = request.args.get("hazard", "multi")
    climate = request.args.get("climate", "nonclimate")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    results = get_loss_summary_by_hazard_and_climate(hazard, climate)
    return jsonify(results)


@analytics_bp.route("/api/loss-summary-compare-climate")
def get_loss_summary_compare_climate():
    hazard = request.args.get("hazard", "multi")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    nonclimate_rows = get_loss_summary_by_hazard_and_climate(hazard, "nonclimate")
    climate_rows = get_loss_summary_by_hazard_and_climate(hazard, "climate")

    merged = {}

    for row in nonclimate_rows:
        scenario = (row.get("scenario") or "").upper()
        merged[scenario] = {
            "scenario": scenario,
            "nonclimate": int(row.get("total_loss", 0) or 0),
            "climate": 0,
        }

    for row in climate_rows:
        scenario = (row.get("scenario") or "").upper()
        if scenario not in merged:
            merged[scenario] = {
                "scenario": scenario,
                "nonclimate": 0,
                "climate": 0,
            }
        merged[scenario]["climate"] = int(row.get("total_loss", 0) or 0)

    scenario_order = ["RP25", "RP50", "RP100", "RP250"]
    results = sorted(
        merged.values(),
        key=lambda item: scenario_order.index(item["scenario"])
        if item["scenario"] in scenario_order
        else 999,
    )

    return jsonify(results)


@analytics_bp.route("/api/top-regions")
def get_top_regions():
    import geopandas as gpd

    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    file_path = get_geojson_path(hazard, climate, scenario)

    if not os.path.exists(file_path):
        return jsonify([])

    gdf = gpd.read_file(file_path)

    if "kab_kota" not in gdf.columns or "loss" not in gdf.columns:
        return jsonify([])

    df = gdf[["kab_kota", "loss"]].dropna()
    df = df.sort_values("loss", ascending=False).head(10)

    result = [
        {
            "name": row["kab_kota"],
            "loss": int(round(row["loss"])),
        }
        for _, row in df.iterrows()
    ]

    return jsonify(result)


@analytics_bp.route("/api/hazard-breakdown")
def hazard_breakdown():
    import geopandas as gpd

    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    results = []

    for hazard in ["flood", "drought", "multi"]:
        file_path = get_geojson_path(hazard, climate, scenario)

        if not os.path.exists(file_path):
            results.append({
                "hazard": get_hazard_display_name(hazard),
                "total": 0,
            })
            continue

        gdf = gpd.read_file(file_path)
        total = (
            int(round(gdf["loss"].dropna().sum()))
            if "loss" in gdf.columns
            else 0
        )

        results.append({
            "hazard": get_hazard_display_name(hazard),
            "total": total,
        })

    return jsonify(results)