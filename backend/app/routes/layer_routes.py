import os
import json
from pathlib import Path

from flask import Blueprint, request, jsonify

layer_bp = Blueprint("layer_bp", __name__)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "output"


@layer_bp.route("/")
def home():
    return {"message": "PADIS API running 🚀"}


@layer_bp.route("/api/debug-layer")
def debug_layer():
    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    file_map = {
        ("multi", "nonclimate"): OUTPUT_DIR / f"web_multi_nonclimate_{scenario}_v2.geojson",
        ("multi", "climate"): OUTPUT_DIR / f"web_multi_climate_{scenario}_v2.geojson",
        ("flood", "nonclimate"): OUTPUT_DIR / f"web_flood_nonclimate_{scenario}_v2.geojson",
        ("flood", "climate"): OUTPUT_DIR / f"web_flood_climate_{scenario}_v2.geojson",
        ("drought", "nonclimate"): OUTPUT_DIR / f"web_drought_nonclimate_{scenario}_v2.geojson",
        ("drought", "climate"): OUTPUT_DIR / f"web_drought_climate_{scenario}_v2.geojson",
    }

    file_path = file_map.get((hazard, climate))

    return jsonify({
        "project_root": str(PROJECT_ROOT),
        "output_dir": str(OUTPUT_DIR),
        "output_dir_exists": OUTPUT_DIR.exists(),
        "requested_file": str(file_path) if file_path else None,
        "requested_file_exists": file_path.exists() if file_path else False,
        "sample_files": sorted([p.name for p in OUTPUT_DIR.glob("*")])[:20] if OUTPUT_DIR.exists() else []
    })


@layer_bp.route("/api/layer")
def get_layer():
    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    allowed_hazards = {"flood", "drought", "multi"}
    allowed_scenarios = {"rp25", "rp50", "rp100", "rp250"}
    allowed_climate = {"nonclimate", "climate"}

    if hazard not in allowed_hazards:
        return jsonify({"error": "hazard tidak valid"}), 400

    if scenario not in allowed_scenarios:
        return jsonify({"error": "scenario tidak valid"}), 400

    if climate not in allowed_climate:
        return jsonify({"error": "climate condition tidak valid"}), 400

    file_map = {
        ("multi", "nonclimate"): OUTPUT_DIR / f"web_multi_nonclimate_{scenario}_v2.geojson",
        ("multi", "climate"): OUTPUT_DIR / f"web_multi_climate_{scenario}_v2.geojson",
        ("flood", "nonclimate"): OUTPUT_DIR / f"web_flood_nonclimate_{scenario}_v2.geojson",
        ("flood", "climate"): OUTPUT_DIR / f"web_flood_climate_{scenario}_v2.geojson",
        ("drought", "nonclimate"): OUTPUT_DIR / f"web_drought_nonclimate_{scenario}_v2.geojson",
        ("drought", "climate"): OUTPUT_DIR / f"web_drought_climate_{scenario}_v2.geojson",
    }

    file_path = file_map[(hazard, climate)]

    if not file_path.exists():
        return jsonify({
            "error": "file layer tidak ditemukan",
            "file_path": str(file_path),
            "output_dir": str(OUTPUT_DIR),
        }), 404

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return jsonify(data)


@layer_bp.route("/api/regions")
def get_regions():
    import geopandas as gpd

    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    file_map = {
        ("multi", "nonclimate"): OUTPUT_DIR / f"web_multi_nonclimate_{scenario}_v2.geojson",
        ("multi", "climate"): OUTPUT_DIR / f"web_multi_climate_{scenario}_v2.geojson",
        ("flood", "nonclimate"): OUTPUT_DIR / f"web_flood_nonclimate_{scenario}_v2.geojson",
        ("flood", "climate"): OUTPUT_DIR / f"web_flood_climate_{scenario}_v2.geojson",
        ("drought", "nonclimate"): OUTPUT_DIR / f"web_drought_nonclimate_{scenario}_v2.geojson",
        ("drought", "climate"): OUTPUT_DIR / f"web_drought_climate_{scenario}_v2.geojson",
    }

    file_path = file_map.get((hazard, climate))
    if not file_path or not file_path.exists():
        return jsonify([])

    gdf = gpd.read_file(file_path)
    df = gdf[["kab_kota", "prov"]].dropna().drop_duplicates()
    df = df.sort_values("kab_kota")

    result = [
        {"kab_kota": row["kab_kota"], "prov": row["prov"]}
        for _, row in df.iterrows()
    ]

    return jsonify(result)