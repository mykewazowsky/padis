# app/routes/layers/aal.py
from flask import jsonify, request
from sqlalchemy import text
from app.db.session import SessionLocal
from . import layers_bp
import json

# Shared with tile_routes.py and values.py — must stay in sync with the DB.
# hazards: flood=1, drought=2, multihazard=3
_HAZARD_ALIAS = {"multi": "multihazard"}
_HAZARD_ID    = {"flood": 1, "drought": 2, "multihazard": 3}
_SCENARIO_ID  = {"nonclimate": 1, "climate": 2}


@layers_bp.route("/aal", methods=["GET"])
def get_aal():
    raw_hazard = request.args.get("hazard", "flood")
    hazard     = _HAZARD_ALIAS.get(raw_hazard.strip().lower(), raw_hazard.strip().lower())
    climate    = request.args.get("climate", "nonclimate").strip().lower()

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400

    if climate not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown climate '{climate}'. Valid: {list(_SCENARIO_ID)}"}), 400

    hazard_id   = _HAZARD_ID[hazard]
    scenario_id = _SCENARIO_ID[climate]

    print({
        "endpoint":    "layers/aal",
        "hazard":      hazard,
        "hazard_id":   hazard_id,
        "climate":     climate,
        "scenario_id": scenario_id,
    })

    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(a.aal, 0) AS aal,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.0005)) AS geometry
            FROM regions_adm r
            LEFT JOIN aal a
                ON  r.id_kabkota  = a.id_kabkota
                AND a.hazard_id   = :hazard_id
                AND a.scenario_id = :scenario_id
        """), {"hazard_id": hazard_id, "scenario_id": scenario_id}).fetchall()

        features = []
        for row in result:
            if not row.geometry:
                continue
            features.append({
                "type": "Feature",
                "geometry": json.loads(row.geometry),
                "properties": {
                    "id_kabkota": row.id_kabkota,
                    "kab_kota":   row.kab_kota,
                    "prov":       row.prov,
                    "aal":        float(row.aal),
                },
            })

        print(f"[layers/aal] features={len(features)}")
        return jsonify({"type": "FeatureCollection", "features": features})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
