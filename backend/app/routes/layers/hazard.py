# app/routes/layers/hazard.py
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
_RP_ID        = {25: 1, 50: 2, 100: 3, 250: 4}


@layers_bp.route("/hazard", methods=["GET"])
def get_hazard():
    raw_hazard = request.args.get("hazard", "flood")
    hazard     = _HAZARD_ALIAS.get(raw_hazard.strip().lower(), raw_hazard.strip().lower())
    scenario   = request.args.get("scenario", "nonclimate").strip().lower()  # = climate value
    rp_str     = request.args.get("rp", "rp100").strip().lower()
    run_id     = request.args.get("run_id", type=int)

    if run_id is None:
        return jsonify({"error": "run_id is required"}), 400

    try:
        rp = int(rp_str.replace("rp", ""))
    except ValueError:
        return jsonify({"error": f"Invalid rp '{rp_str}'"}), 400

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400

    if scenario not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown scenario '{scenario}'. Valid: {list(_SCENARIO_ID)}"}), 400

    if rp not in _RP_ID:
        return jsonify({"error": f"Unknown return period {rp}. Valid: {list(_RP_ID)}"}), 400

    hazard_id   = _HAZARD_ID[hazard]
    scenario_id = _SCENARIO_ID[scenario]
    rp_id       = _RP_ID[rp]

    print({
        "endpoint":    "layers/hazard",
        "hazard":      hazard,
        "hazard_id":   hazard_id,
        "climate":     scenario,
        "scenario_id": scenario_id,
        "rp":          rp,
        "rp_id":       rp_id,
        "run_id":      run_id,
    })

    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                z.mean_value,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.0005)) AS geometry
            FROM regions_adm r
            LEFT JOIN zonal_kabupaten z
                ON  r.id_kabkota  = z.id_kabkota
                AND z.hazard_id   = :hazard_id
                AND z.scenario_id = :scenario_id
                AND z.rp_id       = :rp_id
                AND z.run_id      = :run_id
        """), {
            "hazard_id":   hazard_id,
            "scenario_id": scenario_id,
            "rp_id":       rp_id,
            "run_id":      run_id,
        }).fetchall()

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
                    "mean_value": float(row.mean_value) if row.mean_value is not None else None,
                },
            })

        print(f"[layers/hazard] features={len(features)}")
        return jsonify({"type": "FeatureCollection", "features": features})

    except Exception as e:
        print("ERROR layers/hazard:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
