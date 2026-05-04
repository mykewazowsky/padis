# app/routes/layers/regions.py
from flask import jsonify
from sqlalchemy import text
from ...db.session import SessionLocal
from . import layers_bp
import json
import logging

logger = logging.getLogger(__name__)


@layers_bp.route("/regions", methods=["GET"])
def get_regions():
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                id_kabkota,
                kab_kota,
                prov,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0005)) AS geometry
            FROM regions_adm
        """)).fetchall()

        features = []
        skipped = 0

        for row in result:
            if not row.geometry:
                skipped += 1
                continue

            features.append({
                "type": "Feature",
                "geometry": json.loads(row.geometry),
                "properties": {
                    "id_kabkota": row.id_kabkota,
                    "kab_kota": row.kab_kota,
                    "prov": row.prov
                }
            })

        logger.debug("Regions loaded: %s | skipped: %s", len(features), skipped)

        return jsonify({"type": "FeatureCollection", "features": features})

    finally:
        db.close()
