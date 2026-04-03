from flask import Blueprint, request, jsonify
from sqlalchemy import text

from app.db.session import engine

layer_bp = Blueprint("layer_bp", __name__)

ALLOWED_HAZARDS = {"flood", "drought", "multi"}
ALLOWED_SCENARIOS = {"rp25", "rp50", "rp100", "rp250"}
ALLOWED_CLIMATE = {"nonclimate", "climate"}


@layer_bp.route("/")
def home():
    return {"message": "PADIS API running."}


@layer_bp.route("/api/layer")
def get_layer():
    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    if scenario not in ALLOWED_SCENARIOS:
        return jsonify({"error": "scenario tidak valid"}), 400

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    sql = text("""
        select jsonb_build_object(
            'type', 'FeatureCollection',
            'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
        ) as geojson
        from (
            select jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(geom)::jsonb,
                'properties', jsonb_build_object(
                    'kab_kota', region_name,
                    'prov', province,
                    'hazard', hazard,
                    'climate', climate,
                    'scenario', scenario,
                    'loss', loss
                )
            ) as feature
            from hazard_features
            where hazard = :hazard
              and climate = :climate
              and scenario = :scenario
        ) t
    """)

    with engine.connect() as conn:
        row = conn.execute(
            sql,
            {
                "hazard": hazard,
                "climate": climate,
                "scenario": scenario,
            },
        ).mappings().first()

    geojson = row["geojson"] if row and row["geojson"] else {
        "type": "FeatureCollection",
        "features": [],
    }

    return jsonify(geojson)


@layer_bp.route("/api/regions")
def get_regions():
    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    if scenario not in ALLOWED_SCENARIOS:
        return jsonify({"error": "scenario tidak valid"}), 400

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    sql = text("""
        select distinct
            region_name as kab_kota,
            province as prov
        from hazard_features
        where hazard = :hazard
          and climate = :climate
          and scenario = :scenario
          and region_name is not null
        order by region_name
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
        {"kab_kota": row["kab_kota"], "prov": row["prov"]}
        for row in rows
    ]

    return jsonify(result)