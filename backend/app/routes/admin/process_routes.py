import os
import sys
import traceback
import subprocess
import threading

from datetime import datetime, timezone
from flask import Blueprint, jsonify, request

from ..auth.auth_utils import admin_required
from .admin_utils import (
    PROCESS_LOCK,
    PROCESS_STATE,
    PIPELINE_REGISTRY,
    SCRIPTS_DIR,
    OUTPUT_DIR,
    update_process_state,
    append_process_log,
    get_recent_outputs,
)

admin_process_bp = Blueprint("admin_process_bp", __name__)

SCRIPT_TIMEOUT_SECONDS = 3600
MAX_LOG_CHARS = 5000


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def trim_text(value: str | None, max_chars: int = MAX_LOG_CHARS) -> str:
    if not value:
        return ""
    return value[-max_chars:]


def run_pipeline_scripts(script_names, hazard, mode):
    try:
        total_scripts = len(script_names)
        scripts_root = os.path.abspath(SCRIPTS_DIR)

        print("=" * 80)
        print("[PADIS] START PIPELINE")
        print(f"[PADIS] hazard={hazard}")
        print(f"[PADIS] mode={mode}")
        print(f"[PADIS] total_scripts={total_scripts}")
        print(f"[PADIS] scripts={script_names}")
        print("=" * 80)

        if total_scripts == 0:
            update_process_state(
                status="idle",
                finished_at=now_iso(),
                last_result="failed",
                message=f"Tidak ada script untuk hazard={hazard}, mode={mode}",
                current_script=None,
                current_step=0,
                total_steps=0,
                progress_percent=0,
                updated_outputs=[],
            )
            return

        for index, script_name in enumerate(script_names, start=1):
            script_path = os.path.abspath(os.path.join(SCRIPTS_DIR, script_name))

            print("-" * 80)
            print(f"[PADIS] RUNNING SCRIPT {index}/{total_scripts}")
            print(f"[PADIS] script_name={script_name}")
            print(f"[PADIS] script_path={script_path}")
            print("-" * 80)

            if not script_path.startswith(scripts_root + os.sep):
                raise RuntimeError(f"Path script tidak valid: {script_name}")

            if not os.path.exists(script_path):
                raise FileNotFoundError(f"Script tidak ditemukan: {script_name}")

            if not os.path.isfile(script_path):
                raise RuntimeError(f"Path bukan file script valid: {script_name}")

            update_process_state(
                current_script=script_name,
                current_step=index,
                total_steps=total_scripts,
                message=f"Menjalankan {script_name}",
                progress_percent=int(((index - 1) / total_scripts) * 100),
            )

            try:
                result = subprocess.run(
                    [sys.executable, "-u", script_path],
                    cwd=SCRIPTS_DIR,
                    capture_output=True,
                    text=True,
                    timeout=SCRIPT_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                append_process_log(
                    script=script_name,
                    returncode=124,
                    stdout_text="",
                    stderr_text=f"Script timeout setelah {SCRIPT_TIMEOUT_SECONDS} detik",
                    timestamp=now_iso(),
                )
                raise RuntimeError(
                    f"Script timeout: {script_name} setelah {SCRIPT_TIMEOUT_SECONDS} detik"
                )

            print(f"[PADIS] FINISHED SCRIPT: {script_name}")
            print(f"[PADIS] returncode={result.returncode}")

            if result.stdout:
                print("[PADIS][STDOUT][tail]")
                print(result.stdout[-1500:])

            if result.stderr:
                print("[PADIS][STDERR][tail]")
                print(result.stderr[-1500:])

            append_process_log(
                script=script_name,
                returncode=result.returncode,
                stdout_text=trim_text(result.stdout),
                stderr_text=trim_text(result.stderr),
                timestamp=now_iso(),
            )

            if result.returncode != 0:
                raise RuntimeError(
                    f"Script gagal: {script_name}\n{trim_text((result.stderr or '').strip(), 1000)}"
                )

            update_process_state(
                progress_percent=int((index / total_scripts) * 100),
            )

        print("=" * 80)
        print("[PADIS] PIPELINE SUCCESS")
        print("=" * 80)

        update_process_state(
            status="idle",
            finished_at=now_iso(),
            last_result="success",
            message=f"Pipeline {hazard} - {mode} selesai",
            current_script=None,
            current_step=total_scripts,
            total_steps=total_scripts,
            progress_percent=100,
            updated_outputs=get_recent_outputs(minutes=10),
        )

    except Exception as e:
        print("=" * 80)
        print("[PADIS] PIPELINE FAILED")
        print(str(e))
        print(traceback.format_exc())
        print("=" * 80)

        with PROCESS_LOCK:
            current_step = PROCESS_STATE.get("current_step", 0)
            total_steps = PROCESS_STATE.get("total_steps", 0)
            progress_percent = PROCESS_STATE.get("progress_percent", 0)

        update_process_state(
            status="idle",
            finished_at=now_iso(),
            last_result="failed",
            message=str(e),
            current_script=None,
            current_step=current_step,
            total_steps=total_steps,
            progress_percent=progress_percent,
            updated_outputs=[],
        )

        append_process_log(
            script="system",
            returncode=1,
            stdout_text="",
            stderr_text=trim_text(traceback.format_exc()),
            timestamp=now_iso(),
        )


@admin_process_bp.route("/api/admin/process-status", methods=["GET"])
@admin_required
def admin_process_status():
    with PROCESS_LOCK:
        return jsonify(PROCESS_STATE)


@admin_process_bp.route("/api/admin/dependencies", methods=["GET"])
@admin_required
def admin_dependencies():
    hazard = request.args.get("hazard", "multi")

    allowed_hazards = {"flood", "drought", "multi"}
    if hazard not in allowed_hazards:
        return jsonify({"error": "Hazard tidak valid"}), 400

    script_paths = PIPELINE_REGISTRY.get(hazard, {}).get("full", [])
    checks = []

    for script_rel_path in script_paths:
        full_path = os.path.abspath(os.path.join(SCRIPTS_DIR, script_rel_path))
        checks.append(
            {
                "type": "script",
                "label": f"Script: {script_rel_path}",
                "path": full_path,
                "exists": os.path.exists(full_path),
            }
        )

    extra_targets = []

    if hazard == "flood":
        extra_targets = [
            ("input", "Raw raster folder", os.path.join(os.path.dirname(OUTPUT_DIR), "raw")),
            ("output", "Flood loss std", os.path.join(OUTPUT_DIR, "kabkota_flood_loss_std.gpkg")),
            ("output", "Flood AAL v2", os.path.join(OUTPUT_DIR, "kabkota_flood_aal_v2.csv")),
        ]
    elif hazard == "drought":
        extra_targets = [
            ("input", "Raw raster folder", os.path.join(os.path.dirname(OUTPUT_DIR), "raw")),
            ("output", "Drought loss std", os.path.join(OUTPUT_DIR, "kabkota_drought_loss_std.gpkg")),
            ("output", "Drought AAL v2", os.path.join(OUTPUT_DIR, "kabkota_drought_aal_v2.csv")),
        ]
    else:
        extra_targets = [
            ("input", "Flood loss source", os.path.join(OUTPUT_DIR, "kabkota_flood_loss.gpkg")),
            ("input", "Drought loss source", os.path.join(OUTPUT_DIR, "kabkota_drought_loss.gpkg")),
            ("output", "Multihazard clean", os.path.join(OUTPUT_DIR, "kabkota_multihazard_clean.gpkg")),
            ("output", "Multihazard AAL v2", os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal_v2.csv")),
        ]

    for item_type, label, path in extra_targets:
        checks.append(
            {
                "type": item_type,
                "label": label,
                "path": path,
                "exists": os.path.exists(path),
            }
        )

    all_ok = all(item["exists"] for item in checks)

    return jsonify(
        {
            "hazard": hazard,
            "all_ok": all_ok,
            "checks": checks,
        }
    )


@admin_process_bp.route("/api/admin/run-analysis", methods=["POST"])
@admin_required
def admin_run_analysis():
    data = request.get_json(silent=True) or {}
    hazard = data.get("hazard", "multi")
    mode = data.get("mode", "full")

    allowed_hazards = {"flood", "drought", "multi"}
    allowed_modes = {"full", "preprocess", "analysis", "web"}

    if hazard not in allowed_hazards:
        return jsonify({"error": "Hazard tidak valid"}), 400

    if mode not in allowed_modes:
        return jsonify({"error": "Mode tidak valid"}), 400

    with PROCESS_LOCK:
        if PROCESS_STATE.get("status") == "running":
            return jsonify({"error": "Masih ada proses yang sedang berjalan"}), 409

    scripts = PIPELINE_REGISTRY.get(hazard, {}).get(mode, [])
    if not scripts:
        return jsonify(
            {
                "error": f"Tidak ada script untuk hazard={hazard}, mode={mode}"
            }
        ), 400

    update_process_state(
        status="running",
        started_at=now_iso(),
        finished_at=None,
        last_result="running",
        message=f"Menjalankan pipeline {hazard} - {mode}",
        hazard=hazard,
        mode=mode,
        logs=[],
        current_script=None,
        current_step=0,
        total_steps=len(scripts),
        progress_percent=0,
        updated_outputs=[],
    )

    worker = threading.Thread(
        target=run_pipeline_scripts,
        args=(scripts, hazard, mode),
        daemon=True,
    )
    worker.start()

    return jsonify(
        {
            "message": "Pipeline berhasil dimulai",
            "hazard": hazard,
            "mode": mode,
            "scripts": scripts,
        }
    )


@admin_process_bp.route("/api/admin/finish-analysis", methods=["POST"])
@admin_required
def admin_finish_analysis():
    with PROCESS_LOCK:
        total_steps = PROCESS_STATE.get("total_steps", 0)

    update_process_state(
        status="idle",
        finished_at=now_iso(),
        last_result="manual_finish",
        message="Analisis ditandai selesai secara manual oleh admin",
        current_script=None,
        current_step=total_steps,
        total_steps=total_steps,
        progress_percent=100,
    )

    return jsonify(
        {
            "message": "Analisis ditandai selesai secara manual"
        }
    )
