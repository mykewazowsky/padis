import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from sqlalchemy import create_engine, text

analytics_bp = Blueprint("analytics_bp", __name__)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "output"

load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL tidak ditemukan di .env")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

ALLOWED_HAZARDS = {"flood", "drought", "multi"}
ALLOWED_CLIMATE = {"nonclimate", "climate"}
SCENARIOS = ["rp25", "rp50", "rp100", "rp250"]


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
    summary_sql = text("""
        select
            coalesce(sum(aal_nonclimate), 0) as total_aal_nonclimate,
            coalesce(sum(aal_climate), 0) as total_aal_climate,
            count(aal_nonclimate) as count_nonclimate,
            count(aal_climate) as count_climate
        from aal_summary
        where hazard = :hazard
    """)

    top_nonclimate_sql = text("""
        select region_name, province, aal_nonclimate
        from aal_summary
        where hazard = :hazard
        order by aal_nonclimate desc nulls last
        limit 1
    """)

    top_climate_sql = text("""
        select region_name, province, aal_climate
        from aal_summary
        where hazard = :hazard
        order by aal_climate desc nulls last
        limit 1
    """)

    with engine.connect() as conn:
        summary = conn.execute(summary_sql, {"hazard": hazard}).mappings().first()
        top_nonclimate = conn.execute(
            top_nonclimate_sql, {"hazard": hazard}
        ).mappings().first()
        top_climate = conn.execute(
            top_climate_sql, {"hazard": hazard}
        ).mappings().first()

    return {
        "hazard": hazard,
        "total_aal_nonclimate": float(summary["total_aal_nonclimate"] or 0),
        "total_aal_climate": float(summary["total_aal_climate"] or 0),
        "count_nonclimate": int(summary["count_nonclimate"] or 0),
        "count_climate": int(summary["count_climate"] or 0),
        "top_nonclimate_region": (
            f"{top_nonclimate['region_name']}, {top_nonclimate['province']}"
            if top_nonclimate and top_nonclimate["region_name"]
            else "-"
        ),
        "top_nonclimate_value": (
            float(top_nonclimate["aal_nonclimate"] or 0)
            if top_nonclimate
            else 0.0
        ),
        "top_climate_region": (
            f"{top_climate['region_name']}, {top_climate['province']}"
            if top_climate and top_climate["region_name"]
            else "-"
        ),
        "top_climate_value": (
            float(top_climate["aal_climate"] or 0)
            if top_climate
            else 0.0
        ),
    }


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

    sql = text("""
        select
            upper(scenario) as scenario,
            coalesce(sum(loss), 0) as total_loss
        from hazard_features
        where hazard = :hazard
          and climate = :climate
        group by scenario
    """)

    with engine.connect() as conn:
        rows = conn.execute(
            sql,
            {"hazard": hazard, "climate": climate},
        ).mappings().all()

    row_map = {row["scenario"]: int(round(float(row["total_loss"] or 0))) for row in rows}

    results = []
    for scenario in ["RP25", "RP50", "RP100", "RP250"]:
        results.append({
            "scenario": scenario,
            "total_loss": row_map.get(scenario, 0),
        })

    return jsonify(results)


@analytics_bp.route("/api/loss-summary-compare-climate")
def get_loss_summary_compare_climate():
    hazard = request.args.get("hazard", "multi")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    sql = text("""
        select
            upper(scenario) as scenario,
            climate,
            coalesce(sum(loss), 0) as total_loss
        from hazard_features
        where hazard = :hazard
        group by scenario, climate
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, {"hazard": hazard}).mappings().all()

    merged = {
        "RP25": {"scenario": "RP25", "nonclimate": 0, "climate": 0},
        "RP50": {"scenario": "RP50", "nonclimate": 0, "climate": 0},
        "RP100": {"scenario": "RP100", "nonclimate": 0, "climate": 0},
        "RP250": {"scenario": "RP250", "nonclimate": 0, "climate": 0},
    }

    for row in rows:
        scenario = row["scenario"]
        climate = row["climate"]
        total_loss = int(round(float(row["total_loss"] or 0)))

        if scenario in merged and climate in {"nonclimate", "climate"}:
            merged[scenario][climate] = total_loss

    results = [merged["RP25"], merged["RP50"], merged["RP100"], merged["RP250"]]
    return jsonify(results)


@analytics_bp.route("/api/top-regions")
def get_top_regions():
    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    sql = text("""
        select region_name, loss
        from hazard_features
        where hazard = :hazard
          and climate = :climate
          and scenario = :scenario
          and region_name is not null
        order by loss desc nulls last
        limit 10
    """)

    with engine.connect() as conn:
        rows = conn.execute(
            sql,
            {
                "hazard": hazard,
                "climate": climate,
                "scenario": scenario,
            },
        ).mappings().all()

    result = [
        {
            "name": row["region_name"],
            "loss": int(round(float(row["loss"] or 0))),
        }
        for row in rows
    ]

    return jsonify(result)


@analytics_bp.route("/api/hazard-breakdown")
def hazard_breakdown():
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    sql = text("""
        select
            hazard,
            coalesce(sum(loss), 0) as total
        from hazard_features
        where scenario = :scenario
          and climate = :climate
        group by hazard
    """)

    with engine.connect() as conn:
        rows = conn.execute(
            sql,
            {"scenario": scenario, "climate": climate},
        ).mappings().all()

    totals = {row["hazard"]: int(round(float(row["total"] or 0))) for row in rows}

    results = []
    for hazard in ["flood", "drought", "multi"]:
        results.append({
            "hazard": get_hazard_display_name(hazard),
            "total": totals.get(hazard, 0),
        })

    return jsonify(results)