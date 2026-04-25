from flask import Blueprint, request, jsonify
from sqlalchemy import text
from ..db.session import SessionLocal

analytics_bp = Blueprint("analytics_bp", __name__)


# ===============================
# RUNS
# ===============================

@analytics_bp.route("/runs/latest", methods=["GET"])
def get_latest_run():
    """Returns the most recent run_id from the runs table."""
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT id AS run_id FROM runs ORDER BY id DESC LIMIT 1")
        ).fetchone()
        if not row:
            return jsonify({"error": "No runs found"}), 404
        return jsonify({"run_id": int(row.run_id)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


# ===============================
# HELPERS
# ===============================
def map_hazard(hazard: str) -> str:
    return "multihazard" if hazard == "multi" else hazard


def get_hazard_display_name(hazard: str) -> str:
    return {
        "flood":       "Flood",
        "drought":     "Drought",
        "multihazard": "Multi-hazard",
    }.get(hazard, hazard)


def _latest_run_id(db) -> int | None:
    """Return the most recent run_id, or None if no runs exist."""
    row = db.execute(text("SELECT id FROM runs ORDER BY id DESC LIMIT 1")).fetchone()
    return int(row.id) if row else None


# ===============================
# AAL SUMMARY
# ===============================
@analytics_bp.route("/aal-summary")
def get_aal_summary():
    hazard = map_hazard(request.args.get("hazard", "multi"))
    region = request.args.get("region", "").strip()
    run_id = request.args.get("run_id", type=int)

    db = SessionLocal()
    try:
        if run_id is None:
            run_id = _latest_run_id(db)
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        if region:
            sql = text("""
                SELECT
                    s.name AS scenario,
                    COALESCE(SUM(a.aal), 0) AS total_aal
                FROM aal a
                JOIN hazards h   ON a.hazard_id   = h.id
                JOIN scenarios s ON a.scenario_id = s.id
                JOIN regions_adm r ON a.id_kabkota = r.id_kabkota
                WHERE h.name = :hazard
                  AND a.run_id = :run_id
                  AND LOWER(TRIM(r.kab_kota)) = LOWER(TRIM(:region))
                GROUP BY s.name
            """)
            params = {"hazard": hazard, "run_id": run_id, "region": region}
        else:
            sql = text("""
                SELECT
                    s.name AS scenario,
                    COALESCE(SUM(a.aal), 0) AS total_aal
                FROM aal a
                JOIN hazards h   ON a.hazard_id   = h.id
                JOIN scenarios s ON a.scenario_id = s.id
                WHERE h.name = :hazard
                  AND a.run_id = :run_id
                GROUP BY s.name
            """)
            params = {"hazard": hazard, "run_id": run_id}

        rows   = db.execute(sql, params).mappings().all()
        totals = {row["scenario"]: float(row["total_aal"] or 0) for row in rows}

        return jsonify({
            "hazard":              hazard,
            "total_aal_nonclimate": totals.get("nonclimate", 0),
            "total_aal_climate":    totals.get("climate",    0),
        })

    except Exception as e:
        print("ERROR aal-summary:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()


# ===============================
# AAL ALL HAZARDS
# ===============================
@analytics_bp.route("/aal-summary-all-hazards")
def get_aal_summary_all_hazards():
    run_id = request.args.get("run_id", type=int)

    db = SessionLocal()
    try:
        if run_id is None:
            run_id = _latest_run_id(db)
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        results = []
        for hazard in ("flood", "drought", "multihazard"):
            rows = db.execute(text("""
                SELECT
                    s.name AS scenario,
                    COALESCE(SUM(a.aal), 0) AS total_aal
                FROM aal a
                JOIN hazards h   ON a.hazard_id   = h.id
                JOIN scenarios s ON a.scenario_id = s.id
                WHERE h.name  = :hazard
                  AND a.run_id = :run_id
                GROUP BY s.name
            """), {"hazard": hazard, "run_id": run_id}).mappings().all()

            totals = {row["scenario"]: float(row["total_aal"] or 0) for row in rows}
            results.append({
                "hazard":              get_hazard_display_name(hazard),
                "total_aal_nonclimate": totals.get("nonclimate", 0),
                "total_aal_climate":    totals.get("climate",    0),
            })

        return jsonify(results)

    finally:
        db.close()


# ===============================
# LOSS SUMMARY
# ===============================
@analytics_bp.route("/loss-summary")
def get_loss_summary():
    hazard  = map_hazard(request.args.get("hazard",  "multi"))
    climate = request.args.get("climate", "nonclimate")
    run_id  = request.args.get("run_id",  type=int)

    db = SessionLocal()
    try:
        if run_id is None:
            run_id = _latest_run_id(db)
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        rows = db.execute(text("""
            SELECT
                rp.rp,
                COALESCE(SUM(l.loss), 0) AS total_loss
            FROM losses l
            JOIN hazards h        ON l.hazard_id   = h.id
            JOIN scenarios s      ON l.scenario_id = s.id
            JOIN return_periods rp ON l.rp_id       = rp.id
            WHERE h.name   = :hazard
              AND s.name   = :climate
              AND l.run_id = :run_id
            GROUP BY rp.rp
            ORDER BY rp.rp
        """), {"hazard": hazard, "climate": climate, "run_id": run_id}).mappings().all()

        rp_map = {
            f"rp{row['rp']}": int(round(float(row["total_loss"] or 0)))
            for row in rows
        }

        return jsonify([
            {"scenario": s.upper(), "total_loss": rp_map.get(s, 0)}
            for s in ["rp25", "rp50", "rp100", "rp250"]
        ])

    finally:
        db.close()


# ===============================
# LOSS COMPARE CLIMATE
# ===============================
@analytics_bp.route("/loss-summary-compare-climate")
def get_loss_summary_compare_climate():
    hazard = map_hazard(request.args.get("hazard", "multi"))
    run_id = request.args.get("run_id", type=int)

    db = SessionLocal()
    try:
        if run_id is None:
            run_id = _latest_run_id(db)
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        rows = db.execute(text("""
            SELECT
                rp.rp,
                s.name AS climate,
                COALESCE(SUM(l.loss), 0) AS total_loss
            FROM losses l
            JOIN hazards h        ON l.hazard_id   = h.id
            JOIN scenarios s      ON l.scenario_id = s.id
            JOIN return_periods rp ON l.rp_id       = rp.id
            WHERE h.name   = :hazard
              AND l.run_id = :run_id
            GROUP BY rp.rp, s.name
            ORDER BY rp.rp
        """), {"hazard": hazard, "run_id": run_id}).mappings().all()

        merged = {
            "rp25":  {"scenario": "RP25",  "nonclimate": 0, "climate": 0},
            "rp50":  {"scenario": "RP50",  "nonclimate": 0, "climate": 0},
            "rp100": {"scenario": "RP100", "nonclimate": 0, "climate": 0},
            "rp250": {"scenario": "RP250", "nonclimate": 0, "climate": 0},
        }

        for row in rows:
            key     = f"rp{row['rp']}"
            climate = row["climate"]
            if key in merged:
                merged[key][climate] = int(round(float(row["total_loss"] or 0)))

        return jsonify(list(merged.values()))

    finally:
        db.close()


# ===============================
# TOP REGIONS
# ===============================
@analytics_bp.route("/top-regions")
def get_top_regions():
    hazard   = map_hazard(request.args.get("hazard",   "multi"))
    scenario = request.args.get("scenario", "rp25")
    climate  = request.args.get("climate",  "nonclimate")
    run_id   = request.args.get("run_id",   type=int)

    rp = int(scenario.replace("rp", ""))

    db = SessionLocal()
    try:
        if run_id is None:
            run_id = _latest_run_id(db)
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        rows = db.execute(text("""
            SELECT
                r.kab_kota AS region_name,
                SUM(l.loss) AS loss
            FROM losses l
            JOIN regions_adm r    ON l.id_kabkota  = r.id_kabkota
            JOIN hazards h        ON l.hazard_id   = h.id
            JOIN scenarios s      ON l.scenario_id = s.id
            JOIN return_periods rp ON l.rp_id       = rp.id
            WHERE h.name   = :hazard
              AND rp.rp    = :rp
              AND s.name   = :climate
              AND l.run_id = :run_id
            GROUP BY r.kab_kota
            ORDER BY loss DESC
            LIMIT 10
        """), {"hazard": hazard, "rp": rp, "climate": climate, "run_id": run_id}).mappings().all()

        return jsonify([
            {
                "name": row["region_name"],
                "loss": int(round(float(row["loss"] or 0))),
            }
            for row in rows
        ])

    finally:
        db.close()


# ===============================
# HAZARD BREAKDOWN
# ===============================
@analytics_bp.route("/hazard-breakdown")
def hazard_breakdown():
    scenario = request.args.get("scenario", "rp25")
    climate  = request.args.get("climate",  "nonclimate")
    run_id   = request.args.get("run_id",   type=int)

    rp = int(scenario.replace("rp", ""))

    db = SessionLocal()
    try:
        if run_id is None:
            run_id = _latest_run_id(db)
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        rows = db.execute(text("""
            SELECT
                h.name AS hazard,
                SUM(l.loss) AS total
            FROM losses l
            JOIN hazards h        ON l.hazard_id   = h.id
            JOIN scenarios s      ON l.scenario_id = s.id
            JOIN return_periods rp ON l.rp_id       = rp.id
            WHERE rp.rp    = :rp
              AND s.name   = :climate
              AND l.run_id = :run_id
            GROUP BY h.name
        """), {"rp": rp, "climate": climate, "run_id": run_id}).mappings().all()

        totals = {
            row["hazard"]: int(round(float(row["total"] or 0)))
            for row in rows
        }

        return jsonify([
            {"hazard": get_hazard_display_name(h), "total": totals.get(h, 0)}
            for h in ["flood", "drought", "multihazard"]
        ])

    finally:
        db.close()
