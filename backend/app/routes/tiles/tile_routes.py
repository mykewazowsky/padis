"""
MVT tile endpoint: GET /api/tiles/<layer>/<z>/<x>/<y>

Returns gzip-compressed binary (application/x-protobuf) for Leaflet.VectorGrid.
Geometry is stored as EPSG:4326 in regions_adm; we transform to 3857 for MVT.
Zoom-adaptive simplification avoids over-detailed geometry at low zoom levels.
"""

import gzip
import traceback

from flask import Response, jsonify, request
from sqlalchemy import text

from ...db.session import SessionLocal
from . import tiles_bp
from .tile_cache import tile_cache

# ─── Param normalization ─────────────────────────────────────────────────────

# Increment whenever the tile SQL schema changes (adds/removes columns).
# This changes every cache key so stale tiles are never served after a deploy.
_TILE_VERSION = "7"

_HAZARD_ALIAS = {"multi": "multihazard"}

# ── Source of truth: must match the database exactly. DO NOT edit. ────────────
# hazards table:        flood=1, drought=2, multihazard=3
# scenarios table:      nonclimate=1, climate=2
# return_periods table: 25→1, 50→2, 100→3, 250→4
_HAZARD_ID   = {"flood": 1, "drought": 2, "multihazard": 3}
_SCENARIO_ID = {"nonclimate": 1, "climate": 2}
_RP_ID       = {25: 1, 50: 2, 100: 3, 250: 4}

# ─── SQL helpers ─────────────────────────────────────────────────────────────


def _simplify(z: int, col: str = "r.geom") -> str:
    """Zoom-adaptive ST_SimplifyPreserveTopology (tolerance in degrees, WGS84)."""
    if z >= 10:
        return col
    if z >= 7:
        return f"ST_SimplifyPreserveTopology({col}, 0.001)"
    return f"ST_SimplifyPreserveTopology({col}, 0.005)"


def _mvt_geom(z: int, col: str = "r.geom") -> str:
    """Full ST_AsMVTGeom expression — transforms to 3857, clips to tile envelope."""
    return (
        f"ST_AsMVTGeom("
        f"ST_Transform({_simplify(z, col)}, 3857),"
        f" ST_TileEnvelope(:z, :x, :y),"
        f" 4096, 64, true)"
    )


def _bbox(col: str = "r.geom") -> str:
    """Spatial pre-filter: only rows whose bbox overlaps the tile envelope."""
    return f"ST_Intersects({col}, ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326))"


# ─── Per-layer query functions ────────────────────────────────────────────────


def _tile_loss(db, p: dict) -> bytes:
    sql = text(f"""
        SELECT ST_AsMVT(q.*, 'loss', 4096, 'geom') AS mvt
        FROM (
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(l.loss, 0)::float       AS loss,
                (l.id_kabkota IS NOT NULL)::int  AS has_data,
                {_mvt_geom(p['z'])} AS geom
            FROM regions_adm r
            LEFT JOIN losses l
                ON  r.id_kabkota  = l.id_kabkota
                AND l.hazard_id   = :hazard_id
                AND l.scenario_id = :scenario_id
                AND l.rp_id       = :rp_id
                AND l.run_id      = :run_id
            WHERE {_bbox()}
        ) q
        WHERE q.geom IS NOT NULL
    """)
    row = db.execute(sql, p).fetchone()
    return bytes(row.mvt) if row and row.mvt else b""


def _tile_aal(db, p: dict) -> bytes:
    sql = text(f"""
        SELECT ST_AsMVT(q.*, 'aal', 4096, 'geom') AS mvt
        FROM (
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(a.aal, 0)::float           AS aal,
                (a.id_kabkota IS NOT NULL)::int     AS has_data,
                {_mvt_geom(p['z'])} AS geom
            FROM regions_adm r
            LEFT JOIN aal a
                ON  r.id_kabkota  = a.id_kabkota
                AND a.hazard_id   = :hazard_id
                AND a.scenario_id = :scenario_id
                AND a.run_id      = :run_id
            WHERE {_bbox()}
        ) q
        WHERE q.geom IS NOT NULL
    """)
    row = db.execute(sql, p).fetchone()
    return bytes(row.mvt) if row and row.mvt else b""


def _tile_hazard(db, p: dict) -> bytes:
    # Uses integer IDs passed directly in p to avoid repeated subqueries per tile
    sql = text(f"""
        SELECT ST_AsMVT(q.*, 'hazard', 4096, 'geom') AS mvt
        FROM (
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(z.mean_value, 0)::float    AS mean_value,
                (z.id_kabkota IS NOT NULL)::int     AS has_data,
                {_mvt_geom(p['z'])} AS geom
            FROM regions_adm r
            LEFT JOIN zonal_kabupaten z
                ON  r.id_kabkota  = z.id_kabkota
                AND z.hazard_id   = :hazard_id
                AND z.scenario_id = :scenario_id
                AND z.rp_id       = :rp_id
                AND z.run_id      = :run_id
            WHERE {_bbox()}
        ) q
        WHERE q.geom IS NOT NULL
    """)
    row = db.execute(sql, p).fetchone()
    return bytes(row.mvt) if row and row.mvt else b""


def _tile_production(db, p: dict) -> bytes:
    geom_expr = _mvt_geom(p['z'], "s.geom")
    bbox_expr = _bbox("s.geom")
    sql = text(f"""
        SELECT ST_AsMVT(q.*, 'production', 4096, 'geom') AS mvt
        FROM (
            SELECT
                s.id_kabkota,
                r.kab_kota,
                r.prov,
                COALESCE(prod.total_prod, 0)::float AS total_prod,
                {geom_expr} AS geom
            FROM regions_sawah s
            JOIN regions_adm r ON s.id_kabkota = r.id_kabkota
            LEFT JOIN (
                SELECT id_kabkota, SUM(total_prod)::float AS total_prod
                FROM production
                GROUP BY id_kabkota
            ) prod ON s.id_kabkota = prod.id_kabkota
            WHERE {bbox_expr}
        ) q
        WHERE q.geom IS NOT NULL
    """)
    row = db.execute(sql, p).fetchone()
    return bytes(row.mvt) if row and row.mvt else b""


def _tile_regions(db, p: dict) -> bytes:
    sql = text(f"""
        SELECT ST_AsMVT(q.*, 'regions', 4096, 'geom') AS mvt
        FROM (
            SELECT
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                {_mvt_geom(p['z'])} AS geom
            FROM regions_adm r
            WHERE {_bbox()}
        ) q
        WHERE q.geom IS NOT NULL
    """)
    row = db.execute(sql, p).fetchone()
    return bytes(row.mvt) if row and row.mvt else b""


_HANDLERS = {
    "loss":       _tile_loss,
    "aal":        _tile_aal,
    "hazard":     _tile_hazard,
    "production": _tile_production,
    "regions":    _tile_regions,
}

_TILE_HEADERS = {
    "Content-Type":     "application/x-protobuf",
    "Content-Encoding": "gzip",
    "Cache-Control":    "public, max-age=3600",
    "Vary":             "Accept-Encoding",
}

# ─── Route ───────────────────────────────────────────────────────────────────


@tiles_bp.route("/<layer>/<int:z>/<int:x>/<int:y>", methods=["GET"])
def get_tile(layer: str, z: int, x: int, y: int):
    if layer not in _HANDLERS:
        return jsonify({"error": f"Unknown layer: {layer}"}), 404

    # ── Normalize: lowercase + strip then resolve aliases ────────────────────
    raw_hazard = request.args.get("hazard", "flood")
    hazard     = _HAZARD_ALIAS.get(raw_hazard.strip().lower(),
                                   raw_hazard.strip().lower())
    climate    = request.args.get("climate", "nonclimate").strip().lower()
    scenario   = request.args.get("scenario", "rp100").strip().lower()
    run_id     = request.args.get("run_id", type=int)

    # ── Parse return period — fail immediately on bad input ──────────────────
    try:
        rp = int(scenario.replace("rp", ""))
    except ValueError:
        return jsonify({"error": f"Invalid scenario '{scenario}'. Must be rp25/rp50/rp100/rp250"}), 400

    # ── Strict validation — no silent fallbacks ───────────────────────────────
    if layer in ("loss", "aal", "hazard") and run_id is None:
        return jsonify({"error": "run_id is required for this layer"}), 400

    if hazard not in _HAZARD_ID:
        return jsonify({"error": f"Unknown hazard '{hazard}'. Valid: {list(_HAZARD_ID)}"}), 400

    if climate not in _SCENARIO_ID:
        return jsonify({"error": f"Unknown climate '{climate}'. Valid: {list(_SCENARIO_ID)}"}), 400

    if rp not in _RP_ID:
        return jsonify({"error": f"Unknown return period {rp}. Valid: {list(_RP_ID)}"}), 400

    cache_key = f"v{_TILE_VERSION}/{layer}/{z}/{x}/{y}/{hazard}/{climate}/{rp}/{run_id}"
    cached = tile_cache.get(cache_key)
    if cached is not None:
        return Response(cached, 200, headers={**_TILE_HEADERS, "X-Cache": "HIT"})

    params: dict = {
        "z": z, "x": x, "y": y,
        "hazard": hazard, "climate": climate,
        "rp": rp, "run_id": run_id,
    }

    if layer in ["hazard", "loss", "aal"]:
        hazard_id   = _HAZARD_ID[hazard]    # never None — validated above
        scenario_id = _SCENARIO_ID[climate]  # never None — validated above
        rp_id       = _RP_ID[rp]             # never None — validated above

        print({
            "layer":       layer,
            "raw_hazard":  raw_hazard,
            "hazard":      hazard,
            "hazard_id":   hazard_id,
            "climate":     climate,
            "scenario_id": scenario_id,
            "rp":          rp,
            "rp_id":       rp_id,
            "run_id":      run_id,
        })

        params.update({
            "hazard_id":   hazard_id,
            "scenario_id": scenario_id,
            "rp_id":       rp_id,
        })

    db = SessionLocal()
    try:
        raw_mvt    = _HANDLERS[layer](db, params)
        compressed = gzip.compress(raw_mvt, compresslevel=6)
        tile_cache.set(cache_key, compressed)
        return Response(compressed, 200, headers={**_TILE_HEADERS, "X-Cache": "MISS"})
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Tile generation failed"}), 500
    finally:
        db.close()


# ─── Cache admin endpoints ────────────────────────────────────────────────────


@tiles_bp.route("/cache/stats", methods=["GET"])
def cache_stats():
    return jsonify({"size": tile_cache.size, "maxsize": tile_cache.maxsize})


@tiles_bp.route("/cache/clear", methods=["POST"])
def cache_clear():
    prefix = request.args.get("prefix", "")
    count  = tile_cache.invalidate(prefix)
    return jsonify({"cleared": count, "remaining": tile_cache.size})


# ─── Mapping verification endpoint ───────────────────────────────────────────
# GET /api/tiles/debug/losses?run_id=<id>
# Returns first 5 rows from losses so you can verify hazard_id/scenario_id/rp_id
# match your expectation (drought→2, flood→1, etc.).

@tiles_bp.route("/debug/losses", methods=["GET"])
def debug_losses():
    run_id = request.args.get("run_id", type=int)
    if run_id is None:
        return jsonify({"error": "run_id required"}), 400
    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT id_kabkota, hazard_id, scenario_id, rp_id, run_id, loss
            FROM losses
            WHERE run_id = :run_id
            LIMIT 10
        """), {"run_id": run_id}).fetchall()
        return jsonify({
            "mappings": {
                "hazards":        _HAZARD_ID,
                "scenarios":      _SCENARIO_ID,
                "return_periods": _RP_ID,
            },
            "sample_rows": [dict(r._mapping) for r in rows],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
