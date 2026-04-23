# app/routes/layers/production.py
from flask import jsonify
from sqlalchemy import text
from app.db.session import SessionLocal
from . import layers_bp
import json

@layers_bp.route("/production", methods=["GET"])
def get_production():
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                s.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(p_agg.total_prod, 0) AS total_prod,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(s.geom, 0.0005)) AS geometry
            FROM regions_sawah s
            JOIN regions_adm r
                ON s.id_kabkota = r.id_kabkota
            LEFT JOIN (
                SELECT id_kabkota, SUM(total_prod) AS total_prod
                FROM production
                GROUP BY id_kabkota
            ) p_agg
                ON s.id_kabkota = p_agg.id_kabkota
        """)).fetchall()

        features = []

        for row in result:
            if not row.geometry:
                continue

            features.append({
                "type": "Feature",
                "geometry": json.loads(row.geometry),
                "properties": {
                    "id_kabkota": row.id_kabkota,
                    "kab_kota": row.kab_kota,
                    "prov": row.prov,
                    "total_prod": float(row.total_prod),
                }
            })

        print(f"🌾 Production sawah features: {len(features)}")

        return jsonify({"type": "FeatureCollection", "features": features})

    except Exception as e:
        print("ERROR production:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()
