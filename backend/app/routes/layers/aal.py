# app/routes/layers/aal.py
from flask import jsonify, request
from sqlalchemy import text
from ...db.session import SessionLocal
from . import layers_bp
import json
import logging

logger = logging.getLogger(__name__)

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
    run_id     = request.args.get("run_id", type=int)

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400

    if climate not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown climate '{climate}'. Valid: {list(_SCENARIO_ID)}"}), 400

    hazard_id   = _HAZARD_ID[hazard]
    scenario_id = _SCENARIO_ID[climate]

    db = SessionLocal()
    try:
        if run_id is None:
            row = db.execute(text("SELECT id FROM runs ORDER BY id DESC LIMIT 1")).fetchone()
            run_id = int(row.id) if row else None
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        logger.debug(
            "Layers AAL request: hazard=%s hazard_id=%s climate=%s scenario_id=%s run_id=%s",
            hazard,
            hazard_id,
            climate,
            scenario_id,
            run_id,
        )

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
                AND a.run_id      = :run_id
        """), {"hazard_id": hazard_id, "scenario_id": scenario_id, "run_id": run_id}).fetchall()

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

        logger.debug("Layers AAL features: %s", len(features))
        return jsonify({"type": "FeatureCollection", "features": features})

    except Exception as e:
        logger.exception("Layers AAL request failed")
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
