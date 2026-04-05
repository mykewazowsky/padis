from flask import Blueprint, request, jsonify
from sqlalchemy import text
from app.db.session import engine

layer_bp = Blueprint("layer_bp", __name__)

ALLOWED_HAZARDS = {"flood", "drought", "multi"}
ALLOWED_SCENARIOS = {"rp25", "rp50", "rp100", "rp250"}
ALLOWED_CLIMATE = {"nonclimate", "climate"}

@layer_bp.route("/api/layer")
def get_layer():
    hazard = request.args.get("hazard", "multi").lower()
    scenario = request.args.get("scenario", "rp25").lower()
    climate = request.args.get("climate", "nonclimate").lower()

    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400
    if scenario not in ALLOWED_SCENARIOS:
        return jsonify({"error": "scenario tidak valid"}), 400
    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    # Query SQL dengan JOIN ke tabel aal_summary
    sql = text("""
        select jsonb_build_object(
            'type', 'FeatureCollection',
            'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
        ) as geojson
        from (
            select jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(hf.geom)::jsonb,
                'properties', jsonb_build_object(
                    'kab_kota', hf.region_name,
                    'prov', hf.province,
                    'hazard', hf.hazard,
                    'climate', hf.climate,
                    'scenario', hf.scenario,
                    'loss', hf.loss,
                    -- Mengambil data AAL dari tabel aal_summary berdasarkan region dan hazard
                    'aal_nonclimate', coalesce(aal.aal_nonclimate, 0),
                    'aal_climate', coalesce(aal.aal_climate, 0)
                )
            ) as feature
            from hazard_features hf
            left join aal_summary aal ON 
                lower(hf.region_name) = lower(aal.region_name) AND 
                lower(hf.hazard) = lower(aal.hazard)
            where lower(hf.hazard) = :hazard
              and lower(hf.climate) = :climate
              and lower(hf.scenario) = :scenario
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

# Fungsi get_regions tetap sama, atau bisa disesuaikan lower() untuk keamanan
@layer_bp.route("/api/regions")
def get_regions():
    hazard = request.args.get("hazard", "multi").lower()
    scenario = request.args.get("scenario", "rp25").lower()
    climate = request.args.get("climate", "nonclimate").lower()

    sql = text("""
        select distinct
            region_name as kab_kota,
            province as prov
        from hazard_features
        where lower(hazard) = :hazard
          and lower(climate) = :climate
          and lower(scenario) = :scenario
          and region_name is not null
        order by region_name
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, {"hazard": hazard, "climate": climate, "scenario": scenario}).mappings().all()

    return jsonify([{"kab_kota": row["kab_kota"], "prov": row["prov"]} for row in rows])