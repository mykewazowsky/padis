import os

from flask import Blueprint, request, send_file, jsonify

layer_bp = Blueprint("layer_bp", __name__)

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parents[2]
OUTPUT_DIR = PROJECT_ROOT / "data" / "output"


@layer_bp.route("/")
def home():
    return {"message": "PADIS API running 🚀"}


@layer_bp.route("/api/multihazard")
def get_multihazard():
    scenario = request.args.get("scenario", "rp25")

    allowed = {"rp25", "rp50", "rp100", "rp250"}
    if scenario not in allowed:
        return jsonify({"error": "scenario tidak valid"}), 400

    file_path = os.path.join(OUTPUT_DIR, f"web_multihazard_{scenario}.geojson")

    if not os.path.exists(file_path):
        return jsonify({"error": "file output tidak ditemukan"}), 404

    return send_file(file_path, mimetype="application/json")


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
        ("multi", "nonclimate"): os.path.join(OUTPUT_DIR, f"web_multi_nonclimate_{scenario}_v2.geojson"),
        ("multi", "climate"): os.path.join(OUTPUT_DIR, f"web_multi_climate_{scenario}_v2.geojson"),
        ("flood", "nonclimate"): os.path.join(OUTPUT_DIR, f"web_flood_nonclimate_{scenario}_v2.geojson"),
        ("flood", "climate"): os.path.join(OUTPUT_DIR, f"web_flood_climate_{scenario}_v2.geojson"),
        ("drought", "nonclimate"): os.path.join(OUTPUT_DIR, f"web_drought_nonclimate_{scenario}_v2.geojson"),
        ("drought", "climate"): os.path.join(OUTPUT_DIR, f"web_drought_climate_{scenario}_v2.geojson"),
    }

    file_path = file_map[(hazard, climate)]

    if not os.path.exists(file_path):
        return jsonify({"error": "file layer tidak ditemukan"}), 404

    return send_file(file_path, mimetype="application/json")


@layer_bp.route("/api/regions")
def get_regions():
    import geopandas as gpd

    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    file_map = {
        ("multi", "nonclimate"): os.path.join(OUTPUT_DIR, f"web_multi_nonclimate_{scenario}_v2.geojson"),
        ("multi", "climate"): os.path.join(OUTPUT_DIR, f"web_multi_climate_{scenario}_v2.geojson"),
        ("flood", "nonclimate"): os.path.join(OUTPUT_DIR, f"web_flood_nonclimate_{scenario}_v2.geojson"),
        ("flood", "climate"): os.path.join(OUTPUT_DIR, f"web_flood_climate_{scenario}_v2.geojson"),
        ("drought", "nonclimate"): os.path.join(OUTPUT_DIR, f"web_drought_nonclimate_{scenario}_v2.geojson"),
        ("drought", "climate"): os.path.join(OUTPUT_DIR, f"web_drought_climate_{scenario}_v2.geojson"),
    }

    file_path = file_map.get((hazard, climate))
    if not file_path or not os.path.exists(file_path):
        return jsonify([])

    gdf = gpd.read_file(file_path)
    df = gdf[["kab_kota", "prov"]].dropna().drop_duplicates()
    df = df.sort_values("kab_kota")

    result = [
        {"kab_kota": row["kab_kota"], "prov": row["prov"]}
        for _, row in df.iterrows()
    ]

    return jsonify(result)