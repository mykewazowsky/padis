from flask import Blueprint, request, jsonify
from sqlalchemy import text
from ..db.session import SessionLocal
import json

layer_bp = Blueprint("layer_bp", __name__)

print("🔥 layer_routes FINAL FIXED loaded")


# =========================
# HELPERS
# =========================
def get_scenario_id(climate):
    return 1 if climate == "nonclimate" else 2


def get_rp_value(scenario):
    return int(scenario.replace("rp", ""))


def get_hazard_id(db, hazard):
    if hazard == "multi":
        return None

    result = db.execute(
        text("SELECT id FROM hazards WHERE name = :hazard"),
        {"hazard": hazard}
    ).fetchone()

    return result[0] if result else None


# =========================
# LAYER FINAL
# =========================
@layer_bp.route("/layer", methods=["GET"])
def get_layer():
    db = SessionLocal()

    try:
        hazard = request.args.get("hazard", "multi")
        scenario = request.args.get("scenario", "rp25")
        climate = request.args.get("climate", "nonclimate")

        scenario_id = get_scenario_id(climate)
        rp_value = get_rp_value(scenario)
        hazard_id = get_hazard_id(db, hazard)

        print("🔥 PARAMS:", hazard, scenario_id, rp_value, hazard_id)

        query = """
            SELECT 
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(SUM(l.loss), 0) as loss,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.0001)) as geometry
            FROM regions_adm r

            LEFT JOIN losses l 
                ON r.id_kabkota = l.id_kabkota
                AND l.scenario_id = :scenario_id

            LEFT JOIN return_periods rp
                ON l.rp_id = rp.id
                AND rp.rp = :rp_value
        """

        params = {
            "scenario_id": scenario_id,
            "rp_value": rp_value
        }

        # 🔥 FILTER HAZARD (lebih cepat & aman)
        if hazard_id:
            query += " AND l.hazard_id = :hazard_id"
            params["hazard_id"] = hazard_id

        query += """
            GROUP BY r.id_kabkota, r.kab_kota, r.prov, r.geom
        """

        result = db.execute(text(query), params).fetchall()

        print("🔥 ROW COUNT:", len(result))

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
                    "loss": float(row.loss or 0)
                }
            })

        return jsonify({
            "type": "FeatureCollection",
            "features": features
        })

    except Exception as e:
        print("[LAYER ERROR]", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()


# =========================
# REGIONS (FAST)
# =========================
@layer_bp.route("/regions", methods=["GET"])
def get_regions():
    db = SessionLocal()

    try:
        result = db.execute(text("""
            SELECT 
                id_kabkota,
                kab_kota,
                prov,
                ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001)) AS geometry
            FROM regions_adm
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
                    "prov": row.prov
                }
            })

        return jsonify({
            "type": "FeatureCollection",
            "features": features
        })

    except Exception as e:
        print("[REGIONS ERROR]", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()
