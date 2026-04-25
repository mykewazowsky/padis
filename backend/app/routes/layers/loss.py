from flask import jsonify, request
from sqlalchemy import text
from ...db.session import SessionLocal
from . import layers_bp
import json

# Shared with tile_routes.py and values.py — must stay in sync with the DB.
# hazards: flood=1, drought=2, multihazard=3
_HAZARD_ALIAS = {"multi": "multihazard"}
_HAZARD_ID    = {"flood": 1, "drought": 2, "multihazard": 3}
_SCENARIO_ID  = {"nonclimate": 1, "climate": 2}
_RP_ID        = {25: 1, 50: 2, 100: 3, 250: 4}


@layers_bp.route("/loss", methods=["GET"])
def get_loss():
    raw_hazard     = request.args.get("hazard", "flood")
    hazard         = _HAZARD_ALIAS.get(raw_hazard.strip().lower(), raw_hazard.strip().lower())
    climate        = request.args.get("climate",  "nonclimate").strip().lower()
    scenario_param = request.args.get("scenario", "rp100").strip().lower()
    run_id         = request.args.get("run_id",   type=int)

    try:
        rp = int(scenario_param.replace("rp", ""))
    except ValueError:
        return jsonify({"error": f"Invalid scenario '{scenario_param}'"}), 400

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400

    if climate not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown climate '{climate}'. Valid: {list(_SCENARIO_ID)}"}), 400

    if rp not in _RP_ID:
        return jsonify({"error": f"Unknown return period {rp}. Valid: {list(_RP_ID)}"}), 400

    hazard_id   = _HAZARD_ID[hazard]
    scenario_id = _SCENARIO_ID[climate]
    rp_id       = _RP_ID[rp]

    db = SessionLocal()
    try:
        if run_id is None:
            row = db.execute(text("SELECT id FROM runs ORDER BY id DESC LIMIT 1")).fetchone()
            run_id = int(row.id) if row else None
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        print({
            "endpoint":    "layers/loss",
            "hazard":      hazard,
            "hazard_id":   hazard_id,
            "climate":     climate,
            "scenario_id": scenario_id,
            "rp":          rp,
            "rp_id":       rp_id,
            "run_id":      run_id,
        })

        result = db.execute(text("""
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(l.loss, 0) AS loss,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.0005)) AS geometry
            FROM regions_adm r
            LEFT JOIN losses l
                ON  r.id_kabkota  = l.id_kabkota
                AND l.hazard_id   = :hazard_id
                AND l.scenario_id = :scenario_id
                AND l.rp_id       = :rp_id
                AND l.run_id      = :run_id
        """), {"hazard_id": hazard_id, "scenario_id": scenario_id, "rp_id": rp_id, "run_id": run_id}).fetchall()

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
                    "loss":       float(row.loss),
                },
            })

        print(f"[layers/loss] features={len(features)}")
        return jsonify({"type": "FeatureCollection", "features": features})

    except Exception as e:
        print("ERROR layers/loss:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
