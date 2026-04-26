"""
Pipeline status routes — Phase 3 refactor.

Pipeline execution via subprocess/threading telah dihapus dari Flask.
Pipeline sekarang dijalankan secara lokal/Docker oleh operator menggunakan:
    docker run padis-pipeline --mode <mode> --hazard <hazard> --operator <name>

Endpoint yang tersedia:
    GET  /api/admin/run-status      (BARU) status pipeline dari tabel `runs`
    GET  /api/admin/process-status  (LAMA, backward compat) sama, shape lama
    GET  /api/admin/dependencies    (LAMA, disederhanakan) cek output files
    POST /api/admin/run-analysis    (DEPRECATED) returns 410 Gone
    POST /api/admin/finish-analysis (DEPRECATED) returns 410 Gone
"""

import os

from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from sqlalchemy import text

from ..auth.auth_utils import admin_required
from .admin_utils import OUTPUT_DIR
from ...db.session import SessionLocal

admin_process_bp = Blueprint("admin_process_bp", __name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fetch_latest_run(session):
    """
    Ambil monitoring run terbaru (source='local') dari tabel runs.
    Filter source='local' mencegah ETL run (source=NULL) menyembunyikan
    monitoring run operator.
    Fallback ke query tanpa kolom baru jika migration 002 belum dijalankan.
    """
    try:
        row = session.execute(text("""
            SELECT id, run_name, created_at, status, is_active,
                   step, progress, message, operator_name, source
            FROM runs
            WHERE source = 'local'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        """)).fetchone()
    except Exception:
        # Kolom baru (migration 002) belum ada — rollback dulu agar session valid
        try:
            session.rollback()
            row = session.execute(text("""
                SELECT id, run_name, created_at, status, is_active,
                       NULL AS step, 0 AS progress, NULL AS message,
                       NULL AS operator_name, NULL AS source
                FROM runs
                WHERE source = 'local'
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            """)).fetchone()
        except Exception:
            row = None
    return row


def _idle_state(message="Belum ada proses yang sedang berjalan.") -> dict:
    return {
        "status": "idle",
        "started_at": None,
        "finished_at": None,
        "last_result": None,
        "message": message,
        "hazard": None,
        "mode": None,
        "logs": [],
        "current_script": None,
        "current_step": 0,
        "total_steps": 0,
        "progress_percent": 0,
        "updated_outputs": [],
    }


# =============================================================================
# GET /api/admin/run-status  (BARU — clean DB-based endpoint)
# =============================================================================

@admin_process_bp.route("/api/admin/run-status", methods=["GET"])
@admin_required
def admin_run_status():
    """
    Mengembalikan status pipeline terbaru langsung dari tabel `runs`.
    Cocok digunakan oleh pipeline-monitor page.
    """
    try:
        with SessionLocal() as session:
            row = _fetch_latest_run(session)
    except Exception as e:
        return jsonify({"error": "Gagal mengambil status run", "detail": str(e)}), 500

    if row is None:
        return jsonify({"run": None, "message": "Belum ada pipeline run"}), 200

    run = {
        "id": row.id,
        "run_name": row.run_name,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "status": row.status,
        "is_active": row.is_active,
        "step": row.step,
        "progress": row.progress or 0,
        "message": row.message,
        "operator_name": row.operator_name,
        "source": row.source,
    }
    return jsonify({"run": run}), 200


# =============================================================================
# GET /api/admin/process-status  (LAMA — backward compat, shape tidak berubah)
# =============================================================================

@admin_process_bp.route("/api/admin/process-status", methods=["GET"])
@admin_required
def admin_process_status():
    """
    Mengembalikan status pipeline dalam format lama (PROCESS_STATE shape).
    Dipertahankan untuk backward compatibility dengan admin panel yang ada.
    Data sekarang dibaca dari tabel `runs`, bukan in-memory PROCESS_STATE.
    """
    try:
        with SessionLocal() as session:
            row = _fetch_latest_run(session)
    except Exception as e:
        return jsonify({"error": "Gagal mengambil status proses", "detail": str(e)}), 500

    if row is None:
        return jsonify(_idle_state())

    db_status = row.status  # one of: "running", "success", "failed", or None

    hazard = None
    if row.run_name:
        parts = row.run_name.split("_")
        if parts and parts[0] in ("flood", "drought", "multi", "multihazard"):
            hazard = parts[0]

    return jsonify({
        "status": db_status,
        "started_at": row.created_at.isoformat() if row.created_at else None,
        "finished_at": None,
        "last_result": None,
        "message": row.message or "",
        "hazard": hazard,
        "mode": None,
        "logs": [],
        "current_script": row.step,
        "current_step": 0,
        "total_steps": 0,
        "progress_percent": row.progress or 0,
        "updated_outputs": [],
    })


# =============================================================================
# GET /api/admin/dependencies  (LAMA — disederhanakan, cek output saja)
# =============================================================================

@admin_process_bp.route("/api/admin/dependencies", methods=["GET"])
@admin_required
def admin_dependencies():
    """
    Cek keberadaan file output yang diperlukan per hazard.
    Script pipeline tidak lagi dicek di sini (pipeline berjalan via Docker).
    """
    hazard = request.args.get("hazard", "multi")
    if hazard not in {"flood", "drought", "multi"}:
        return jsonify({"error": "Hazard tidak valid"}), 400

    targets = []

    if hazard in ("flood", "multi"):
        targets += [
            ("output", "Flood loss std",  os.path.join(OUTPUT_DIR, "kabkota_flood_loss_std.gpkg")),
            ("output", "Flood AAL",       os.path.join(OUTPUT_DIR, "kabkota_flood_aal.csv")),
        ]
    if hazard in ("drought", "multi"):
        targets += [
            ("output", "Drought loss std", os.path.join(OUTPUT_DIR, "kabkota_drought_loss_std.gpkg")),
            ("output", "Drought AAL",      os.path.join(OUTPUT_DIR, "kabkota_drought_aal.csv")),
        ]
    if hazard == "multi":
        targets += [
            ("output", "Multihazard clean", os.path.join(OUTPUT_DIR, "kabkota_multihazard_clean.gpkg")),
            ("output", "Multihazard AAL",   os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal.csv")),
        ]

    checks = [
        {"type": t, "label": label, "exists": os.path.exists(path)}
        for t, label, path in targets
    ]
    return jsonify({
        "hazard": hazard,
        "all_ok": all(c["exists"] for c in checks),
        "checks": checks,
        "note": "Pipeline sekarang dijalankan via Docker — script tidak lagi dicek di sini.",
    })


# =============================================================================
# GET /api/admin/runs  — list recent monitoring runs
# =============================================================================

@admin_process_bp.route("/api/admin/runs", methods=["GET"])
@admin_required
def admin_list_runs():
    """
    Mengembalikan daftar monitoring run terbaru (source='local').

    Query params:
        limit         int  1–50, default 10
        operator_name str  filter exact match
        hazard        str  filter by run_name prefix (flood/drought/multi)
    """
    try:
        raw_limit = request.args.get("limit", 10, type=int)
        limit = max(1, min(raw_limit, 50))

        operator_filter = request.args.get("operator_name", "").strip()
        hazard_filter   = request.args.get("hazard", "").strip()

        conditions = ["source = 'local'"]
        params: dict = {"limit": limit}

        if operator_filter:
            conditions.append("operator_name = :operator_name")
            params["operator_name"] = operator_filter

        if hazard_filter and hazard_filter in ("flood", "drought", "multi"):
            conditions.append("run_name LIKE :run_name_prefix")
            params["run_name_prefix"] = f"{hazard_filter}_%"

        where_clause = " AND ".join(conditions)

        with SessionLocal() as session:
            rows = session.execute(text(f"""
                SELECT id, run_name, created_at, status, is_active,
                       step, progress, message, operator_name, source
                FROM runs
                WHERE {where_clause}
                ORDER BY created_at DESC, id DESC
                LIMIT :limit
            """), params).fetchall()

    except Exception as e:
        return jsonify({"error": "Gagal mengambil daftar runs", "detail": str(e)}), 500

    runs = [
        {
            "id":            row.id,
            "run_name":      row.run_name,
            "created_at":    row.created_at.isoformat() if row.created_at else None,
            "status":        row.status,
            "is_active":     row.is_active,
            "step":          row.step,
            "progress":      row.progress if row.progress is not None else 0,
            "message":       row.message,
            "operator_name": row.operator_name,
            "source":        row.source,
        }
        for row in rows
    ]

    return jsonify({
        "runs":  runs,
        "count": len(runs),
        "limit": limit,
    }), 200


# =============================================================================
# POST /api/admin/run-analysis  (DEPRECATED — 410 Gone)
# =============================================================================

@admin_process_bp.route("/api/admin/run-analysis", methods=["POST"])
@admin_required
def admin_run_analysis():
    """
    DEPRECATED: Pipeline tidak lagi dijalankan dari Flask.
    Gunakan Docker CLI:
        docker run padis-pipeline --mode <mode> --hazard <hazard> --operator <name>
    """
    return jsonify({
        "error": "Endpoint ini tidak lagi tersedia.",
        "message": (
            "Pipeline sekarang dijalankan secara lokal oleh operator via Docker. "
            "Gunakan: docker run padis-pipeline --mode full --hazard flood --operator <nama>"
        ),
        "docs": "Lihat Dockerfile.pipeline dan docs/refactor-pipeline-plan/pipeline-operation.md",
    }), 410


# =============================================================================
# POST /api/admin/finish-analysis  (DEPRECATED — 410 Gone)
# =============================================================================

@admin_process_bp.route("/api/admin/finish-analysis", methods=["POST"])
@admin_required
def admin_finish_analysis():
    """
    DEPRECATED: Pipeline state sekarang dikelola langsung di tabel `runs`.
    """
    return jsonify({
        "error": "Endpoint ini tidak lagi tersedia.",
        "message": (
            "Status pipeline sekarang dibaca langsung dari tabel `runs`. "
            "Gunakan GET /api/admin/run-status untuk melihat status terbaru."
        ),
    }), 410
