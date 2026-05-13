"""
Geometry-free value endpoints for client-side classification.

GET /api/layers/values/loss?hazard=&scenario=&climate=&run_id=
GET /api/layers/values/aal?hazard=&climate=
GET /api/layers/values/hazard?hazard=&scenario=&rp=&run_id=
GET /api/layers/values/production

Returns: {
  "data":        [{id_kabkota, kab_kota, prov, <value>, has_data}],
  "data_bounds": {min_lng, min_lat, max_lng, max_lat} | null
}

• has_data: false when the region has no row matching the current filter combo.
  Frontend uses this to render no-data regions as gray without a separate request.
• data_bounds: the ST_Extent of regions that DO have data, used to auto-fit the map.
  Computed in the same query via window functions — no extra DB round-trip.
"""

import gzip
import json as _json
import logging

from flask import Response, jsonify, request
from sqlalchemy import text

from ...db.session import SessionLocal
from ..tiles.tile_cache import TileCache
from . import layers_bp

logger = logging.getLogger(__name__)

# ── Source of truth: must match the database exactly. DO NOT edit. ────────────
# hazards table:        flood=1, drought=2, multihazard=3
# scenarios table:      nonclimate=1, climate=2
# return_periods table: 25→1, 50→2, 100→3, 250→4
_HAZARD_ALIAS = {"multi": "multihazard"}
_HAZARD_ID    = {"flood": 1, "drought": 2, "multihazard": 3}
_SCENARIO_ID  = {"nonclimate": 1, "climate": 2}
_RP_ID        = {25: 1, 50: 2, 100: 3, 250: 4}   # integer keys — parse "rp25" → 25 first

_values_cache = TileCache(maxsize=500, ttl=3600)

_RESPONSE_HEADERS = {
    "Content-Type":     "application/json",
    "Content-Encoding": "gzip",
    "Cache-Control":    "public, max-age=300",
    "Vary":             "Accept-Encoding",
}


def _normalize_hazard(raw: str) -> str:
    key = raw.strip().lower()
    return _HAZARD_ALIAS.get(key, key)


def _bounds_from_rows(rows) -> dict | None:
    if not rows or rows[0].minx is None:
        return None
    r = rows[0]
    return {
        "min_lng": float(r.minx),
        "min_lat": float(r.miny),
        "max_lng": float(r.maxx),
        "max_lat": float(r.maxy),
    }


def _compress(payload: dict) -> bytes:
    return gzip.compress(
        _json.dumps(payload, separators=(",", ":")).encode(),
        compresslevel=1,
    )


def _cached_response(cache_key: str, payload: dict) -> Response:
    body = _compress(payload)
    _values_cache.set(cache_key, body)
    return Response(body, 200, headers={**_RESPONSE_HEADERS, "X-Cache": "MISS"})


def _hit_response(body: bytes) -> Response:
    return Response(body, 200, headers={**_RESPONSE_HEADERS, "X-Cache": "HIT"})


# ─── Loss ─────────────────────────────────────────────────────────────────────

@layers_bp.route("/values/loss", methods=["GET"])
def get_loss_values():
    hazard         = _normalize_hazard(request.args.get("hazard", "flood"))
    climate        = request.args.get("climate", "nonclimate").strip().lower()
    scenario_param = request.args.get("scenario", "rp100").strip().lower()
    run_id         = request.args.get("run_id", type=int)

    if run_id is None:
        return jsonify({"error": "run_id is required"}), 400

    try:
        rp = int(scenario_param.replace("rp", ""))
    except ValueError:
        return jsonify({"error": f"Invalid scenario '{scenario_param}'. Must be rp25/rp50/rp100/rp250"}), 400

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400
    if climate not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown climate '{climate}'. Valid: {list(_SCENARIO_ID)}"}), 400
    if rp not in _RP_ID:
        return jsonify({"error": f"Unknown return period {rp}. Valid: {list(_RP_ID)}"}), 400

    hazard_id   = _HAZARD_ID[hazard]
    scenario_id = _SCENARIO_ID[climate]
    rp_id       = _RP_ID[rp]

    cache_key = f"loss/{hazard_id}/{scenario_id}/{rp_id}/{run_id}"
    cached = _values_cache.get(cache_key)
    if cached is not None:
        return _hit_response(cached)

    logger.debug(
        "Values loss request: hazard=%s hazard_id=%s climate=%s scenario_id=%s rp=%s rp_id=%s run_id=%s",
        hazard, hazard_id, climate, scenario_id, rp, rp_id, run_id,
    )

    params = {
        "hazard_id":   hazard_id,
        "scenario_id": scenario_id,
        "rp_id":       rp_id,
        "run_id":      run_id,
    }

    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(l.loss, 0)::float          AS loss,
                (l.id_kabkota IS NOT NULL)           AS has_data,
                MIN(CASE WHEN l.id_kabkota IS NOT NULL THEN ST_XMin(r.geom) END) OVER() AS minx,
                MIN(CASE WHEN l.id_kabkota IS NOT NULL THEN ST_YMin(r.geom) END) OVER() AS miny,
                MAX(CASE WHEN l.id_kabkota IS NOT NULL THEN ST_XMax(r.geom) END) OVER() AS maxx,
                MAX(CASE WHEN l.id_kabkota IS NOT NULL THEN ST_YMax(r.geom) END) OVER() AS maxy
            FROM regions_adm r
            LEFT JOIN losses l
                ON  r.id_kabkota  = l.id_kabkota
                AND l.hazard_id   = :hazard_id
                AND l.scenario_id = :scenario_id
                AND l.rp_id       = :rp_id
                AND l.run_id      = :run_id
        """), params).fetchall()

        data = [
            {"id_kabkota": r.id_kabkota, "kab_kota": r.kab_kota, "prov": r.prov,
             "loss": r.loss, "has_data": r.has_data}
            for r in rows
        ]
        return _cached_response(cache_key, {"data": data, "data_bounds": _bounds_from_rows(rows)})
    except Exception:
        logger.exception("Values loss request failed")
        return jsonify({"error": "Values loss request failed"}), 500
    finally:
        db.close()


# ─── AAL ──────────────────────────────────────────────────────────────────────

@layers_bp.route("/values/aal", methods=["GET"])
def get_aal_values():
    hazard  = _normalize_hazard(request.args.get("hazard", "flood"))
    climate = request.args.get("climate", "nonclimate").strip().lower()
    run_id  = request.args.get("run_id", type=int)

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400
    if climate not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown climate '{climate}'. Valid: {list(_SCENARIO_ID)}"}), 400

    hazard_id   = _HAZARD_ID[hazard]
    scenario_id = _SCENARIO_ID[climate]

    # run_id fallback requires a DB hit — resolve it before checking cache
    db = SessionLocal()
    try:
        if run_id is None:
            row = db.execute(text("SELECT id FROM runs ORDER BY id DESC LIMIT 1")).fetchone()
            run_id = int(row.id) if row else None
        if run_id is None:
            return jsonify({"error": "No runs found"}), 404

        cache_key = f"aal/{hazard_id}/{scenario_id}/{run_id}"
        cached = _values_cache.get(cache_key)
        if cached is not None:
            return _hit_response(cached)

        logger.debug(
            "Values AAL request: hazard=%s hazard_id=%s climate=%s scenario_id=%s run_id=%s",
            hazard, hazard_id, climate, scenario_id, run_id,
        )

        params = {"hazard_id": hazard_id, "scenario_id": scenario_id, "run_id": run_id}

        rows = db.execute(text("""
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(a.aal, 0)::float           AS aal,
                (a.id_kabkota IS NOT NULL)           AS has_data,
                MIN(CASE WHEN a.id_kabkota IS NOT NULL THEN ST_XMin(r.geom) END) OVER() AS minx,
                MIN(CASE WHEN a.id_kabkota IS NOT NULL THEN ST_YMin(r.geom) END) OVER() AS miny,
                MAX(CASE WHEN a.id_kabkota IS NOT NULL THEN ST_XMax(r.geom) END) OVER() AS maxx,
                MAX(CASE WHEN a.id_kabkota IS NOT NULL THEN ST_YMax(r.geom) END) OVER() AS maxy
            FROM regions_adm r
            LEFT JOIN aal a
                ON  r.id_kabkota  = a.id_kabkota
                AND a.hazard_id   = :hazard_id
                AND a.scenario_id = :scenario_id
                AND a.run_id      = :run_id
        """), params).fetchall()

        data = [
            {"id_kabkota": r.id_kabkota, "kab_kota": r.kab_kota, "prov": r.prov,
             "aal": r.aal, "has_data": r.has_data}
            for r in rows
        ]
        return _cached_response(cache_key, {"data": data, "data_bounds": _bounds_from_rows(rows)})
    except Exception:
        logger.exception("Values AAL request failed")
        return jsonify({"error": "Values AAL request failed"}), 500
    finally:
        db.close()


# ─── Hazard index ─────────────────────────────────────────────────────────────

@layers_bp.route("/values/hazard", methods=["GET"])
def get_hazard_values():
    """
    ?hazard=flood&scenario=<climate_value>&rp=rp100&run_id=<id>
    Note: 'scenario' param carries the climate value (nonclimate/climate).
    """
    hazard   = _normalize_hazard(request.args.get("hazard", "flood"))
    scenario = request.args.get("scenario", "nonclimate").strip().lower()  # = climate value
    rp_str   = request.args.get("rp", "rp100").strip().lower()
    run_id   = request.args.get("run_id", type=int)

    if run_id is None:
        return jsonify({"error": "run_id is required"}), 400

    try:
        rp = int(rp_str.replace("rp", ""))
    except ValueError:
        return jsonify({"error": f"Invalid rp '{rp_str}'. Must be rp25/rp50/rp100/rp250"}), 400

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400
    if scenario not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown climate '{scenario}'. Valid: {list(_SCENARIO_ID)}"}), 400
    if rp not in _RP_ID:
        return jsonify({"error": f"Unknown return period {rp}. Valid: {list(_RP_ID)}"}), 400

    hazard_id   = _HAZARD_ID[hazard]
    scenario_id = _SCENARIO_ID[scenario]
    rp_id       = _RP_ID[rp]

    cache_key = f"hazard/{hazard_id}/{scenario_id}/{rp_id}/{run_id}"
    cached = _values_cache.get(cache_key)
    if cached is not None:
        return _hit_response(cached)

    logger.debug(
        "Values hazard request: hazard=%s hazard_id=%s climate=%s scenario_id=%s rp=%s rp_id=%s run_id=%s",
        hazard, hazard_id, scenario, scenario_id, rp, rp_id, run_id,
    )

    params = {
        "hazard_id":   hazard_id,
        "scenario_id": scenario_id,
        "rp_id":       rp_id,
        "run_id":      run_id,
    }

    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(z.mean_value, 0)::float    AS mean_value,
                (z.id_kabkota IS NOT NULL)           AS has_data,
                MIN(CASE WHEN z.id_kabkota IS NOT NULL THEN ST_XMin(r.geom) END) OVER() AS minx,
                MIN(CASE WHEN z.id_kabkota IS NOT NULL THEN ST_YMin(r.geom) END) OVER() AS miny,
                MAX(CASE WHEN z.id_kabkota IS NOT NULL THEN ST_XMax(r.geom) END) OVER() AS maxx,
                MAX(CASE WHEN z.id_kabkota IS NOT NULL THEN ST_YMax(r.geom) END) OVER() AS maxy
            FROM regions_adm r
            LEFT JOIN zonal_kabupaten z
                ON  r.id_kabkota  = z.id_kabkota
                AND z.hazard_id   = :hazard_id
                AND z.scenario_id = :scenario_id
                AND z.rp_id       = :rp_id
                AND z.run_id      = :run_id
        """), params).fetchall()

        data = [
            {"id_kabkota": r.id_kabkota, "kab_kota": r.kab_kota, "prov": r.prov,
             "mean_value": r.mean_value, "has_data": r.has_data}
            for r in rows
        ]
        return _cached_response(cache_key, {"data": data, "data_bounds": _bounds_from_rows(rows)})
    except Exception:
        logger.exception("Values hazard request failed")
        return jsonify({"error": "Values hazard request failed"}), 500
    finally:
        db.close()


# ─── Production ───────────────────────────────────────────────────────────────

@layers_bp.route("/values/production", methods=["GET"])
def get_production_values():
    cache_key = "production"
    cached = _values_cache.get(cache_key)
    if cached is not None:
        return _hit_response(cached)

    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(p.total_prod, 0)::float AS total_prod,
                ST_X(ST_Centroid(r.geom))::float AS centroid_lng,
                ST_Y(ST_Centroid(r.geom))::float AS centroid_lat
            FROM regions_adm r
            LEFT JOIN (
                SELECT id_kabkota, SUM(total_prod)::float AS total_prod
                FROM production
                GROUP BY id_kabkota
            ) p ON r.id_kabkota = p.id_kabkota
        """)).fetchall()

        data = [
            {"id_kabkota": r.id_kabkota, "kab_kota": r.kab_kota, "prov": r.prov,
             "total_prod": r.total_prod, "centroid_lng": r.centroid_lng, "centroid_lat": r.centroid_lat}
            for r in rows
        ]
        return _cached_response(cache_key, {"data": data})
    except Exception:
        logger.exception("Values production request failed")
        return jsonify({"error": "Values production request failed"}), 500
    finally:
        db.close()
