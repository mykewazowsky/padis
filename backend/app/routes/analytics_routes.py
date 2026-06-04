from flask import Blueprint, request, jsonify
from sqlalchemy import text
from ..db.session import SessionLocal
import logging

analytics_bp = Blueprint("analytics_bp", __name__)
logger = logging.getLogger(__name__)


# ===============================
# RUNS
# ===============================

@analytics_bp.route("/runs/latest", methods=["GET"])
def get_latest_run():
    """Return the active run_id used by the dashboard.

    Resolution order:
        1. is_active=TRUE  — admin-selected active run (one run = all hazards).
        2. Latest successful run scoped to hazard (data presence in aal table).
        3. Latest successful run overall.

    Query param:
        hazard  str  flood | drought | multi | multihazard  (optional)
                     Only consulted by the fallback paths (#2, #3).  When an
                     active run is set, hazard is ignored — a single run_id
                     contains data for every hazard.
    """
    raw = request.args.get("hazard", "").strip().lower()
    db_hazard = "multihazard" if raw in ("multi", "multihazard") else raw

    db = SessionLocal()
    try:
        # 1. Admin-selected active run (priority).
        try:
            row = db.execute(
                text("SELECT id AS run_id, data_year FROM runs WHERE is_active = TRUE LIMIT 1")
            ).fetchone()
        except Exception:
            db.rollback()
            row = db.execute(
                text("SELECT id AS run_id, NULL AS data_year FROM runs WHERE is_active = TRUE LIMIT 1")
            ).fetchone()

        # 2. Hazard-scoped fallback for backward compatibility.
        if not row and db_hazard in ("flood", "drought", "multihazard"):
            try:
                row = db.execute(
                    text("""
                        SELECT a.run_id, r.data_year
                        FROM   aal a
                        JOIN   hazards h ON a.hazard_id = h.id
                        JOIN   runs r    ON r.id = a.run_id
                        WHERE  h.name = :hazard
                        ORDER  BY a.run_id DESC
                        LIMIT  1
                    """),
                    {"hazard": db_hazard},
                ).fetchone()
            except Exception:
                db.rollback()
                row = db.execute(
                    text("""
                        SELECT a.run_id, NULL AS data_year
                        FROM   aal a
                        JOIN   hazards h ON a.hazard_id = h.id
                        WHERE  h.name = :hazard
                        ORDER  BY a.run_id DESC
                        LIMIT  1
                    """),
                    {"hazard": db_hazard},
                ).fetchone()

        # 3. Last-resort: latest successful run, no hazard filter.
        if not row:
            try:
                row = db.execute(
                    text("""
                        SELECT id AS run_id, data_year
                        FROM   runs
                        WHERE  status = 'success'
                        ORDER  BY id DESC
                        LIMIT  1
                    """),
                ).fetchone()
            except Exception:
                db.rollback()
                row = db.execute(
                    text("""
                        SELECT id AS run_id, NULL AS data_year
                        FROM   runs
                        WHERE  status = 'success'
                        ORDER  BY id DESC
                        LIMIT  1
                    """),
                ).fetchone()

        if not row:
            return jsonify({"error": "No runs found"}), 404
        return jsonify({
            "run_id":    int(row.run_id),
            "data_year": getattr(row, "data_year", None),
        })
    except Exception as e:
        logger.exception("Latest run request failed")
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


# ─── Spatial scope helpers ─────────────────────────────────────────────────────

_SPATIAL_SCOPE = "intersection (flood ∩ drought ∩ multihazard)"

# Pre-compiled COUNT queries — count kabupaten present in ALL three hazard types
# with a valid (> 0) value.  WHERE pre-filters zero/null rows; HAVING uses
# COUNT(DISTINCT CASE ... AND value > 0 THEN 1 END) > 0 to confirm each hazard
# has at least one genuine record per kabupaten.
_MULTI_REGION_COUNT_SQL: dict[str, object] = {
    "aal": text("""
        WITH intersection AS (
            SELECT a.id_kabkota
            FROM aal a
            JOIN hazards h ON a.hazard_id = h.id
            WHERE h.name IN ('flood', 'drought', 'multihazard')
              AND a.run_id = :run_id
              AND a.aal IS NOT NULL AND a.aal > 0
            GROUP BY a.id_kabkota
            HAVING
                COUNT(DISTINCT CASE WHEN h.name = 'flood'       AND a.aal > 0 THEN 1 END) > 0
            AND COUNT(DISTINCT CASE WHEN h.name = 'drought'     AND a.aal > 0 THEN 1 END) > 0
            AND COUNT(DISTINCT CASE WHEN h.name = 'multihazard' AND a.aal > 0 THEN 1 END) > 0
        )
        SELECT COUNT(*) AS cnt FROM intersection
    """),
    "losses": text("""
        WITH intersection AS (
            SELECT l.id_kabkota
            FROM losses l
            JOIN hazards h ON l.hazard_id = h.id
            WHERE h.name IN ('flood', 'drought', 'multihazard')
              AND l.run_id = :run_id
              AND l.loss IS NOT NULL AND l.loss > 0
            GROUP BY l.id_kabkota
            HAVING
                COUNT(DISTINCT CASE WHEN h.name = 'flood'       AND l.loss > 0 THEN 1 END) > 0
            AND COUNT(DISTINCT CASE WHEN h.name = 'drought'     AND l.loss > 0 THEN 1 END) > 0
            AND COUNT(DISTINCT CASE WHEN h.name = 'multihazard' AND l.loss > 0 THEN 1 END) > 0
        )
        SELECT COUNT(*) AS cnt FROM intersection
    """),
}


def _multi_region_count(db, table: str, run_id: int) -> int:
    """Return kabupaten count present in flood, drought, AND multihazard for run_id.

    Returns 0 when the true spatial intersection is empty — callers use this to
    detect the condition and attach a warning to the response.
    """
    sql = _MULTI_REGION_COUNT_SQL.get(table)
    if sql is None:
        return 0
    row = db.execute(sql, {"run_id": run_id}).fetchone()
    return int(row.cnt) if row else 0


def _no_multihazard_warning(run_id: int) -> str:
    return (
        f"No spatial intersection found for run_id={run_id} "
        "(requires flood, drought, and multihazard data in the same kabupaten). "
        "Run the full pipeline (--hazard multi) to enable spatially comparable aggregation."
    )


# ===============================
# AAL SUMMARY
# ===============================
@analytics_bp.route("/aal-summary")
def get_aal_summary():
    hazard   = map_hazard(request.args.get("hazard",   "multi"))
    region   = request.args.get("region",   "").strip()
    province = request.args.get("province", "").strip()
    run_id   = request.args.get("run_id", type=int)

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
        elif province:
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
                  AND LOWER(TRIM(r.prov)) = LOWER(TRIM(:province))
                GROUP BY s.name
            """)
            params = {"hazard": hazard, "run_id": run_id, "province": province}
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
        logger.exception("AAL summary request failed")
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

        region_count = _multi_region_count(db, "aal", run_id)
        if region_count == 0:
            logger.warning(
                "AAL summary all hazards has no spatial intersection for run_id=%s",
                run_id,
            )

        results = []
        for hazard in ("flood", "drought", "multihazard"):
            rows = db.execute(text("""
                WITH multi_regions AS (
                    SELECT a2.id_kabkota
                    FROM aal a2
                    JOIN hazards h2 ON a2.hazard_id = h2.id
                    WHERE h2.name IN ('flood', 'drought', 'multihazard')
                      AND a2.run_id = :run_id
                      AND a2.aal IS NOT NULL AND a2.aal > 0
                    GROUP BY a2.id_kabkota
                    HAVING
                        COUNT(DISTINCT CASE WHEN h2.name = 'flood'       AND a2.aal > 0 THEN 1 END) > 0
                    AND COUNT(DISTINCT CASE WHEN h2.name = 'drought'     AND a2.aal > 0 THEN 1 END) > 0
                    AND COUNT(DISTINCT CASE WHEN h2.name = 'multihazard' AND a2.aal > 0 THEN 1 END) > 0
                )
                SELECT
                    s.name AS scenario,
                    COALESCE(SUM(a.aal), 0) AS total_aal
                FROM aal a
                JOIN hazards h        ON a.hazard_id   = h.id
                JOIN scenarios s      ON a.scenario_id = s.id
                JOIN multi_regions mr ON a.id_kabkota  = mr.id_kabkota
                WHERE h.name  = :hazard
                  AND a.run_id = :run_id
                GROUP BY s.name
            """), {"hazard": hazard, "run_id": run_id}).mappings().all()

            totals = {row["scenario"]: float(row["total_aal"] or 0) for row in rows}
            item: dict = {
                "hazard":               get_hazard_display_name(hazard),
                "total_aal_nonclimate": totals.get("nonclimate", 0),
                "total_aal_climate":    totals.get("climate",    0),
                "spatial_scope":        _SPATIAL_SCOPE,
                "region_count":         region_count,
            }
            if region_count == 0:
                item["warning"] = _no_multihazard_warning(run_id)
            results.append(item)

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
    region   = request.args.get("region",   "").strip()
    province = request.args.get("province", "").strip()

    rp = int(scenario.replace("rp", ""))

    db = SessionLocal()
    try:
        if run_id is None:
            run_id = _latest_run_id(db)
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        extra_where = ""
        params: dict = {"hazard": hazard, "rp": rp, "climate": climate, "run_id": run_id}
        if region:
            extra_where = "AND LOWER(TRIM(r.kab_kota)) = LOWER(TRIM(:region))"
            params["region"] = region
        elif province:
            extra_where = "AND LOWER(TRIM(r.prov)) = LOWER(TRIM(:province))"
            params["province"] = province

        rows = db.execute(text(f"""
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
              {extra_where}
            GROUP BY r.kab_kota
            ORDER BY loss DESC
            LIMIT 10
        """), params).mappings().all()

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

        region_count = _multi_region_count(db, "losses", run_id)
        if region_count == 0:
            logger.warning(
                "Hazard breakdown has no spatial intersection for run_id=%s",
                run_id,
            )

        rows = db.execute(text("""
            WITH multi_regions AS (
                SELECT l2.id_kabkota
                FROM losses l2
                JOIN hazards h2 ON l2.hazard_id = h2.id
                WHERE h2.name IN ('flood', 'drought', 'multihazard')
                  AND l2.run_id = :run_id
                  AND l2.loss IS NOT NULL AND l2.loss > 0
                GROUP BY l2.id_kabkota
                HAVING
                    COUNT(DISTINCT CASE WHEN h2.name = 'flood'       AND l2.loss > 0 THEN 1 END) > 0
                AND COUNT(DISTINCT CASE WHEN h2.name = 'drought'     AND l2.loss > 0 THEN 1 END) > 0
                AND COUNT(DISTINCT CASE WHEN h2.name = 'multihazard' AND l2.loss > 0 THEN 1 END) > 0
            )
            SELECT
                h.name AS hazard,
                SUM(l.loss) AS total
            FROM losses l
            JOIN hazards h         ON l.hazard_id   = h.id
            JOIN scenarios s       ON l.scenario_id = s.id
            JOIN return_periods rp  ON l.rp_id       = rp.id
            JOIN multi_regions mr   ON l.id_kabkota  = mr.id_kabkota
            WHERE rp.rp    = :rp
              AND s.name   = :climate
              AND l.run_id = :run_id
            GROUP BY h.name
        """), {"rp": rp, "climate": climate, "run_id": run_id}).mappings().all()

        totals = {
            row["hazard"]: int(round(float(row["total"] or 0)))
            for row in rows
        }

        base: dict = {"spatial_scope": _SPATIAL_SCOPE, "region_count": region_count}
        if region_count == 0:
            base["warning"] = _no_multihazard_warning(run_id)

        return jsonify([
            {**base, "hazard": get_hazard_display_name(h), "total": totals.get(h, 0)}
            for h in ["flood", "drought", "multihazard"]
        ])

    finally:
        db.close()
