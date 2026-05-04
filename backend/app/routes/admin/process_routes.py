"""
Pipeline status routes.

Pipeline dijalankan sebagai subprocess lokal oleh operator; Flask tidak terlibat
dalam eksekusi. Progress dilaporkan langsung ke tabel `runs` di database.

Endpoint:
    GET  /api/admin/run-status      — status pipeline dari tabel `runs`
    POST /api/admin/start-pipeline  — spawn pipeline CLI sebagai subprocess
    GET  /api/admin/process-status  — backward compat, shape lama
    GET  /api/admin/dependencies    — cek ketersediaan file output
    POST /api/admin/run-analysis    — 410 Gone
    POST /api/admin/finish-analysis — 410 Gone
"""

import os
import re
import subprocess
import sys

from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from sqlalchemy import text

from ..auth.auth_utils import admin_required
from .admin_utils import BACKEND_DIR, OUTPUT_DIR, PROJECT_ROOT, SCRIPTS_DIR
from ...db.session import SessionLocal

admin_process_bp = Blueprint("admin_process_bp", __name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_pipeline_python() -> str:
    """
    Resolve Python executable for the pipeline subprocess.

    Priority:
      1. PIPELINE_PYTHON env var (explicit override)
      2. venv inside backend/ or project root (standard locations)
      3. sys.executable (fallback — same Python running Flask)
    """
    from_env = os.getenv("PIPELINE_PYTHON", "").strip()
    if from_env and os.path.isfile(from_env):
        return from_env

    candidates = [
        os.path.join(BACKEND_DIR,   "venv", "Scripts", "python.exe"),  # Windows, backend/venv
        os.path.join(BACKEND_DIR,   "venv", "bin",     "python"),       # Unix,    backend/venv
        os.path.join(PROJECT_ROOT,  "venv", "Scripts", "python.exe"),   # Windows, root/venv
        os.path.join(PROJECT_ROOT,  "venv", "bin",     "python"),       # Unix,    root/venv
        os.path.join(PROJECT_ROOT,  ".venv","Scripts", "python.exe"),   # Windows, root/.venv
        os.path.join(PROJECT_ROOT,  ".venv","bin",     "python"),       # Unix,    root/.venv
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path

    return sys.executable


def _fetch_latest_run(session):
    """
    Ambil monitoring run terbaru (source='local') dari tabel runs.
    Filter source='local' mencegah ETL run (source=NULL) menyembunyikan
    monitoring run operator.
    Fallback ke query tanpa kolom baru jika migration 002/004 belum dijalankan.
    """
    try:
        row = session.execute(text("""
            SELECT id, run_name, created_at, finished_at, status, is_active,
                   step, progress, message, operator_name, source
            FROM runs
            WHERE source = 'local'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        """)).fetchone()
    except Exception:
        # Kolom baru (migration 002/004) belum ada — rollback dulu agar session valid
        try:
            session.rollback()
            row = session.execute(text("""
                SELECT id, run_name, created_at,
                       NULL AS finished_at,
                       status, is_active,
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


# A run still marked "running" after this many seconds is considered stale
# (subprocess crashed / was killed without updating the DB row).
_STALE_RUN_THRESHOLD_S = 7200  # 2 hours


def _get_blocking_run(session):
    """
    Return the latest monitoring run if it is actively running AND not stale.
    Return None when it is safe to start a new run:
      - no run exists
      - latest run is not in status 'running'
      - latest run is running but older than _STALE_RUN_THRESHOLD_S (crashed)
    """
    row = _fetch_latest_run(session)
    if row is None or row.status != "running":
        return None

    if row.created_at is None:
        # No timestamp — conservatively treat as active.
        return row

    created = row.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    age_s = (datetime.now(timezone.utc) - created).total_seconds()
    return None if age_s > _STALE_RUN_THRESHOLD_S else row


# =============================================================================
# GET /api/admin/run-status
# =============================================================================

@admin_process_bp.route("/api/admin/run-status", methods=["GET"])
@admin_required
def admin_run_status():
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
        "finished_at": row.finished_at.isoformat() if row.finished_at else None,
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
# GET /api/admin/process-status  (backward compat)
# =============================================================================

@admin_process_bp.route("/api/admin/process-status", methods=["GET"])
@admin_required
def admin_process_status():
    try:
        with SessionLocal() as session:
            row = _fetch_latest_run(session)
    except Exception as e:
        return jsonify({"error": "Gagal mengambil status proses", "detail": str(e)}), 500

    if row is None:
        return jsonify(_idle_state())

    db_status = row.status

    hazard = None
    if row.run_name:
        parts = row.run_name.split("_")
        if parts and parts[0] in ("flood", "drought", "multi", "multihazard"):
            hazard = parts[0]

    return jsonify({
        "status": db_status,
        "started_at": row.created_at.isoformat() if row.created_at else None,
        "finished_at": None,
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
# GET /api/admin/dependencies
# =============================================================================

@admin_process_bp.route("/api/admin/dependencies", methods=["GET"])
@admin_required
def admin_dependencies():
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
            try:
                rows = session.execute(text(f"""
                    SELECT id, run_name, created_at, finished_at, status, is_active,
                           step, progress, message, operator_name, source
                    FROM runs
                    WHERE {where_clause}
                    ORDER BY created_at DESC, id DESC
                    LIMIT :limit
                """), params).fetchall()
            except Exception:
                # Fallback jika migration 004 belum dijalankan (finished_at belum ada).
                session.rollback()
                rows = session.execute(text(f"""
                    SELECT id, run_name, created_at,
                           NULL AS finished_at,
                           status, is_active,
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
            "finished_at":   row.finished_at.isoformat() if row.finished_at else None,
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
# GET /api/admin/runs/active  — return the currently active run
# =============================================================================

@admin_process_bp.route("/api/admin/runs/active", methods=["GET"])
@admin_required
def admin_active_run():
    """
    Kembalikan run yang saat ini aktif (is_active=TRUE).
    Dipakai oleh halaman Outputs untuk menampilkan konteks sistem.

    Response:
        200  { "run": { ...fields... } }   — ada run aktif
        200  { "run": null }               — belum ada run yang diaktifkan
    """
    db = SessionLocal()
    try:
        try:
            row = db.execute(text("""
                SELECT id, run_name, created_at, finished_at, status, is_active,
                       step, progress, message, operator_name, source
                FROM   runs
                WHERE  is_active = TRUE
                LIMIT  1
            """)).fetchone()
        except Exception:
            db.rollback()
            row = db.execute(text("""
                SELECT id, run_name, created_at,
                       NULL AS finished_at,
                       status, is_active,
                       step, progress, message, operator_name, source
                FROM   runs
                WHERE  is_active = TRUE
                LIMIT  1
            """)).fetchone()

        if row is None:
            return jsonify({"run": None}), 200

        return jsonify({
            "run": {
                "id":            row.id,
                "run_name":      row.run_name,
                "created_at":    row.created_at.isoformat() if row.created_at else None,
                "finished_at":   row.finished_at.isoformat() if row.finished_at else None,
                "status":        row.status,
                "is_active":     row.is_active,
                "step":          row.step,
                "progress":      row.progress or 0,
                "message":       row.message,
                "operator_name": row.operator_name,
                "source":        row.source,
            }
        }), 200

    except Exception as e:
        return jsonify({"error": "Gagal mengambil run aktif", "detail": str(e)}), 500
    finally:
        db.close()


# =============================================================================
# GET /api/admin/runs/<id>/validate  — record-count check before activation
# =============================================================================

@admin_process_bp.route("/api/admin/runs/<int:run_id>/validate", methods=["GET"])
@admin_required
def admin_validate_run(run_id: int):
    """
    Periksa kelengkapan data sebuah run sebelum diaktifkan.

    Mengembalikan jumlah kabupaten dengan data per hazard pada tabel aal,
    losses, dan zonal_kabupaten. Frontend memakai informasi ini untuk
    menampilkan ringkasan validasi sebelum admin menekan tombol "Aktifkan".

    Response shape:
        {
          "run_id": int,
          "exists": bool,
          "status": str | null,
          "tables": {
            "aal":              [{ "hazard": str, "regions": int, "rows": int }, ...],
            "losses":           [...],
            "zonal_kabupaten":  [...]
          },
          "all_hazards_present": bool,   # true jika flood, drought, multihazard
                                         #   semua punya >0 region di aal
          "complete": bool               # true jika all_hazards_present untuk
                                         #   ketiga tabel
        }
    """
    db = SessionLocal()
    try:
        run_row = db.execute(
            text("SELECT id, status FROM runs WHERE id = :id"),
            {"id": run_id},
        ).fetchone()

        if run_row is None:
            return jsonify({"run_id": run_id, "exists": False}), 404

        result: dict = {
            "run_id": run_id,
            "exists": True,
            "status": run_row.status,
            "tables": {},
        }

        for table, value_col in (
            ("aal",             "aal"),
            ("losses",          "loss"),
            ("zonal_kabupaten", "mean_value"),
        ):
            rows = db.execute(
                text(f"""
                    SELECT h.name AS hazard,
                           COUNT(DISTINCT t.id_kabkota)
                               FILTER (WHERE t.{value_col} IS NOT NULL
                                         AND t.{value_col} > 0) AS regions,
                           COUNT(*) AS rows_total
                    FROM   {table} t
                    JOIN   hazards h ON t.hazard_id = h.id
                    WHERE  t.run_id = :run_id
                    GROUP  BY h.name
                    ORDER  BY h.name
                """),
                {"run_id": run_id},
            ).mappings().all()

            result["tables"][table] = [
                {
                    "hazard":  row["hazard"],
                    "regions": int(row["regions"] or 0),
                    "rows":    int(row["rows_total"] or 0),
                }
                for row in rows
            ]

        required_hazards = {"flood", "drought", "multihazard"}

        def _hazards_with_data(table_key: str) -> set:
            return {
                item["hazard"]
                for item in result["tables"].get(table_key, [])
                if item["regions"] > 0
            }

        aal_hazards    = _hazards_with_data("aal")
        losses_hazards = _hazards_with_data("losses")
        zonal_hazards  = _hazards_with_data("zonal_kabupaten")

        result["all_hazards_present"] = required_hazards.issubset(aal_hazards)
        result["complete"] = (
            required_hazards.issubset(aal_hazards)
            and required_hazards.issubset(losses_hazards)
            and required_hazards.issubset(zonal_hazards)
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "error":  "Gagal memvalidasi run",
            "detail": str(e),
        }), 500
    finally:
        db.close()


# =============================================================================
# PATCH /api/admin/runs/<id>/activate  — set this run as the active run
# =============================================================================

@admin_process_bp.route("/api/admin/runs/<int:run_id>/activate", methods=["PATCH"])
@admin_required
def admin_activate_run(run_id: int):
    """
    Tetapkan satu run sebagai run aktif yang dipakai dashboard.

    Body JSON (opsional):
        force  bool  jika true, lewati pengecekan status='success'
                     (default: false)

    Aturan:
      - Hanya run dengan status='success' yang boleh diaktifkan (kecuali force=true).
      - Atomic swap: matikan semua is_active=TRUE, lalu set target ke TRUE.
      - Karena satu run = semua hazard, hanya boleh ada satu is_active=TRUE
        di seluruh tabel pada satu waktu.

    Response: shape sama seperti GET /api/admin/run-status untuk run target.
    """
    body  = request.get_json(silent=True) or {}
    force = bool(body.get("force", False))

    db = SessionLocal()
    try:
        target = db.execute(
            text("SELECT id, status FROM runs WHERE id = :id"),
            {"id": run_id},
        ).fetchone()

        if target is None:
            return jsonify({"error": f"Run #{run_id} tidak ditemukan"}), 404

        if not force and target.status != "success":
            return jsonify({
                "error": (
                    f"Run #{run_id} belum sukses (status={target.status}). "
                    "Aktifkan hanya run dengan status 'success', atau gunakan force=true."
                ),
                "status": target.status,
            }), 409

        # Atomic swap dalam satu transaksi.
        db.execute(text("UPDATE runs SET is_active = FALSE WHERE is_active = TRUE"))
        db.execute(
            text("UPDATE runs SET is_active = TRUE WHERE id = :id"),
            {"id": run_id},
        )
        db.commit()

        # Ambil row lengkap untuk response.
        try:
            row = db.execute(text("""
                SELECT id, run_name, created_at, finished_at, status, is_active,
                       step, progress, message, operator_name, source
                FROM   runs
                WHERE  id = :id
            """), {"id": run_id}).fetchone()
        except Exception:
            db.rollback()
            row = db.execute(text("""
                SELECT id, run_name, created_at,
                       NULL AS finished_at,
                       status, is_active,
                       step, progress, message, operator_name, source
                FROM   runs
                WHERE  id = :id
            """), {"id": run_id}).fetchone()

        run = {
            "id":            row.id,
            "run_name":      row.run_name,
            "created_at":    row.created_at.isoformat() if row.created_at else None,
            "finished_at":   row.finished_at.isoformat() if row.finished_at else None,
            "status":        row.status,
            "is_active":     row.is_active,
            "step":          row.step,
            "progress":      row.progress or 0,
            "message":       row.message,
            "operator_name": row.operator_name,
            "source":        row.source,
        }
        return jsonify({
            "message": f"Run #{run_id} berhasil diaktifkan.",
            "run":     run,
        }), 200

    except Exception as e:
        db.rollback()
        return jsonify({"error": "Gagal mengaktifkan run", "detail": str(e)}), 500
    finally:
        db.close()


# =============================================================================
# DELETE /api/admin/runs/<id>  — hard delete run + all its child data
# =============================================================================

@admin_process_bp.route("/api/admin/runs/<int:run_id>", methods=["DELETE"])
@admin_required
def admin_delete_run(run_id: int):
    """
    Hapus permanen sebuah run beserta seluruh data turunannya di tabel
    aal, losses, dan zonal_kabupaten.

    Operasi destructive — irreversible. Frontend wajib menampilkan konfirmasi
    eksplisit beserta ringkasan jumlah baris yang akan terhapus.

    Guard rules:
      - Tolak jika run aktif (is_active=TRUE) — admin harus mengaktifkan
        run lain dulu.
      - Tolak jika status='running' — pipeline mungkin masih menulis ke
        tabel-tabel turunannya.

    Eksekusi dalam satu transaksi: bila salah satu DELETE gagal, seluruh
    perubahan di-rollback agar tidak meninggalkan data orphan.

    Response:
        200  { "message": ..., "deleted": { "aal": int, "losses": int,
                                            "zonal_kabupaten": int, "runs": 1 } }
        404  run tidak ditemukan
        409  run aktif atau sedang berjalan
        500  error database
    """
    db = SessionLocal()
    try:
        target = db.execute(
            text("SELECT id, status, is_active FROM runs WHERE id = :id"),
            {"id": run_id},
        ).fetchone()

        if target is None:
            return jsonify({"error": f"Run #{run_id} tidak ditemukan"}), 404

        if target.is_active:
            return jsonify({
                "error": (
                    f"Run #{run_id} sedang aktif. Aktifkan run lain "
                    "terlebih dahulu sebelum menghapus run ini."
                ),
            }), 409

        if target.status == "running":
            return jsonify({
                "error": (
                    f"Run #{run_id} sedang berjalan. Tunggu hingga selesai "
                    "atau gagal sebelum menghapus."
                ),
            }), 409

        # Single transaction — child tables first, then runs row.
        # FK belum dipasang di schema, jadi kita harus hapus manual
        # agar tidak meninggalkan baris orphan.
        deleted: dict[str, int] = {}

        for table in ("zonal_kabupaten", "losses", "aal"):
            res = db.execute(
                text(f"DELETE FROM {table} WHERE run_id = :id"),
                {"id": run_id},
            )
            deleted[table] = res.rowcount or 0

        res = db.execute(
            text("DELETE FROM runs WHERE id = :id"),
            {"id": run_id},
        )
        deleted["runs"] = res.rowcount or 0

        db.commit()

        return jsonify({
            "message": f"Run #{run_id} berhasil dihapus.",
            "deleted": deleted,
        }), 200

    except Exception as e:
        db.rollback()
        return jsonify({"error": "Gagal menghapus run", "detail": str(e)}), 500
    finally:
        db.close()


# =============================================================================
# POST /api/admin/start-pipeline
# =============================================================================

_VALID_MODES   = {"full", "preprocess", "analysis", "web"}
_VALID_HAZARDS = {"flood", "drought", "multi"}


@admin_process_bp.route("/api/admin/start-pipeline", methods=["POST"])
@admin_required
def admin_start_pipeline():
    """
    Spawn pipeline CLI sebagai subprocess terpisah (fire-and-forget).

    Body JSON:
        mode     str  "full" | "preprocess" | "analysis" | "web"  (default: "full")
        hazard   str  "flood" | "drought" | "multi"  (default: "multi")
        operator str  nama operator  (default: "operator")

    Returns:
        202  pipeline berhasil di-spawn
        400  parameter tidak valid
        409  ada pipeline yang sedang berjalan
        500  gagal spawn subprocess atau cek DB
    """
    body     = request.get_json(silent=True) or {}
    mode     = body.get("mode", "full")
    hazard   = body.get("hazard", "multi")
    operator = body.get("operator", "operator")

    if mode not in _VALID_MODES:
        return jsonify({
            "error": f"Mode tidak valid: '{mode}'. Pilih salah satu: {sorted(_VALID_MODES)}",
        }), 400

    if hazard not in _VALID_HAZARDS:
        return jsonify({
            "error": f"Hazard tidak valid: '{hazard}'. Pilih salah satu: {sorted(_VALID_HAZARDS)}",
        }), 400

    # Strip unsafe characters from operator name (alphanumeric, underscore, hyphen only)
    operator = re.sub(r"[^\w\-]", "_", operator.strip())[:50] or "operator"

    # Block if a non-stale run is already active
    try:
        with SessionLocal() as session:
            blocking = _get_blocking_run(session)
    except Exception as e:
        return jsonify({"error": "Gagal memeriksa status pipeline", "detail": str(e)}), 500

    if blocking is not None:
        return jsonify({
            "error": (
                "Pipeline sedang berjalan. "
                "Tunggu hingga selesai sebelum memulai yang baru."
            ),
            "active_run": {
                "id":            blocking.id,
                "run_name":      blocking.run_name,
                "created_at":    blocking.created_at.isoformat() if blocking.created_at else None,
                "operator_name": blocking.operator_name,
                "step":          blocking.step,
                "progress":      blocking.progress or 0,
            },
        }), 409

    # Spawn pipeline CLI — Windows: cmd /K agar console tetap terbuka + log tampil
    #                       Unix:    sesi baru + log ke file
    script_path = os.path.join(SCRIPTS_DIR, "main.py")
    python_exe  = _get_pipeline_python()

    # -u = unbuffered stdout/stderr; wajib agar print() muncul real-time di console
    pipeline_cmd = [python_exe, "-u", script_path,
                    "--mode", mode, "--hazard", hazard, "--operator", operator]

    log_dir  = os.path.join(BACKEND_DIR, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "subprocess.log")

    # Env: PYTHONUNBUFFERED=1 sebagai double-safety di samping flag -u
    child_env = {
        **os.environ,
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUNBUFFERED": "1",
    }

    try:
        # Tulis header audit ke log file (selalu, di semua platform)
        with open(log_path, "a", encoding="utf-8") as lf:
            lf.write(
                f"\n{'='*60}\n"
                f"[{_now_iso()}] python={python_exe}\n"
                f"mode={mode}  hazard={hazard}  operator={operator}\n"
                f"cwd={BACKEND_DIR}\n"
                f"{'='*60}\n"
            )

        if os.name == "nt":
            # Windows: tulis batch file lalu spawn "cmd /K batch_path".
            # Batch file menghindari quoting hell cmd.exe — path ditulis sebagai
            # teks plain di dalam file, bukan di-escape lewat command string.
            batch_path = os.path.join(log_dir, "run_pipeline.bat")
            with open(batch_path, "w", encoding="cp1252") as bf:
                bf.write("@echo off\n")
                bf.write("chcp 65001 > nul\n")
                bf.write(f"title PADIS Pipeline [{hazard}] [{mode}]\n")
                bf.write(f'cd /d "{BACKEND_DIR}"\n')
                bf.write(
                    f'"{python_exe}" -u "{script_path}"'
                    f" --mode {mode} --hazard {hazard} --operator {operator}\n"
                )
                bf.write("echo.\n")
                bf.write("echo Pipeline selesai. Tekan sembarang tombol untuk menutup...\n")
                bf.write("pause > nul\n")

            proc = subprocess.Popen(
                ["cmd", "/K", batch_path],
                cwd=BACKEND_DIR,
                env=child_env,
                creationflags=subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP,
            )
        else:
            # Unix/Linux: tidak ada window — arahkan stdout/stderr ke log file
            with open(log_path, "a", encoding="utf-8") as lf:
                proc = subprocess.Popen(
                    pipeline_cmd,
                    cwd=BACKEND_DIR,
                    stdout=lf,
                    stderr=lf,
                    env=child_env,
                    start_new_session=True,
                )

    except Exception as e:
        return jsonify({"error": "Gagal menjalankan pipeline", "detail": str(e)}), 500

    return jsonify({
        "message": "Pipeline berhasil dimulai.",
        "pid":      proc.pid,
        "mode":     mode,
        "hazard":   hazard,
        "operator": operator,
    }), 202


# =============================================================================
# POST /api/admin/run-analysis  (410 Gone)
# =============================================================================

@admin_process_bp.route("/api/admin/run-analysis", methods=["POST"])
@admin_required
def admin_run_analysis():
    return jsonify({
        "error": "Endpoint ini tidak lagi tersedia.",
        "message": (
            "Pipeline sekarang dijalankan secara lokal oleh operator via Docker. "
            "Gunakan: docker run padis-pipeline --mode full --hazard flood --operator <nama>"
        ),
        "docs": "Lihat Dockerfile.pipeline dan docs/refactor-pipeline-plan/pipeline-operation.md",
    }), 410


# =============================================================================
# POST /api/admin/finish-analysis  (410 Gone)
# =============================================================================

@admin_process_bp.route("/api/admin/finish-analysis", methods=["POST"])
@admin_required
def admin_finish_analysis():
    return jsonify({
        "error": "Endpoint ini tidak lagi tersedia.",
        "message": (
            "Status pipeline sekarang dibaca langsung dari tabel `runs`. "
            "Gunakan GET /api/admin/run-status untuk melihat status terbaru."
        ),
    }), 410
