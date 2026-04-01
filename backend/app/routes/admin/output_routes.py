import os
import csv
import json

from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, send_file

from app.routes.auth.auth_utils import admin_required
from .admin_utils import (
    OUTPUT_DIR,
    should_skip_output,
    categorize_output,
    get_output_status,
    is_v2_file,
    normalize_output_name,
)

admin_output_bp = Blueprint("admin_output_bp", __name__)

MAX_PREVIEW_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def safe_output_path(filename: str) -> str | None:
    if not filename:
        return None

    base_dir = os.path.abspath(OUTPUT_DIR)
    target_path = os.path.abspath(os.path.join(base_dir, filename))

    if not target_path.startswith(base_dir + os.sep):
        return None

    return target_path


@admin_output_bp.route("/api/admin/outputs", methods=["GET"])
@admin_required
def admin_outputs():
    if not os.path.exists(OUTPUT_DIR):
        return jsonify([])

    files = []
    all_files = os.listdir(OUTPUT_DIR)

    for name in all_files:
        path = os.path.join(OUTPUT_DIR, name)

        if not os.path.isfile(path):
            continue

        if should_skip_output(name, all_files):
            continue

        stat = os.stat(path)
        ext = os.path.splitext(name)[1].lower().replace(".", "") or "unknown"

        files.append(
            {
                "filename": name,
                "extension": ext,
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
                "category": categorize_output(name),
                "status": get_output_status(name, all_files),
                "is_v2": is_v2_file(name),
                "has_v2_pair": any(
                    other.lower() != name.lower()
                    and normalize_output_name(other) == normalize_output_name(name)
                    and is_v2_file(other)
                    for other in all_files
                ),
                "preview_supported": ext in {"csv", "geojson"},
            }
        )

    files.sort(key=lambda x: x["modified_at"], reverse=True)
    return jsonify(files)


@admin_output_bp.route("/api/admin/outputs/download", methods=["GET"])
@admin_required
def admin_download_output():
    filename = request.args.get("filename", "").strip()

    if not filename:
        return jsonify({"error": "Filename wajib diisi"}), 400

    file_path = safe_output_path(filename)
    if not file_path:
        return jsonify({"error": "Filename tidak valid"}), 400

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "File tidak ditemukan"}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=os.path.basename(file_path),
    )


@admin_output_bp.route("/api/admin/outputs/preview", methods=["GET"])
@admin_required
def admin_preview_output():
    filename = request.args.get("filename", "").strip()

    if not filename:
        return jsonify({"error": "Filename wajib diisi"}), 400

    file_path = safe_output_path(filename)
    if not file_path:
        return jsonify({"error": "Filename tidak valid"}), 400

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "File tidak ditemukan"}), 404

    if os.path.getsize(file_path) > MAX_PREVIEW_FILE_SIZE_BYTES:
        return jsonify(
            {
                "error": "File terlalu besar untuk preview langsung",
                "filename": filename,
                "max_preview_size_bytes": MAX_PREVIEW_FILE_SIZE_BYTES,
            }
        ), 413

    ext = os.path.splitext(filename)[1].lower()

    try:
        if ext == ".geojson":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            features = data.get("features", [])
            sample_props = {}
            property_keys = []

            if features and isinstance(features[0], dict):
                sample_props = features[0].get("properties", {}) or {}
                property_keys = list(sample_props.keys())

            return jsonify(
                {
                    "type": "geojson",
                    "filename": filename,
                    "feature_count": len(features),
                    "property_keys": property_keys,
                    "sample_properties": sample_props,
                }
            )

        if ext == ".csv":
            rows = []
            columns = []

            with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
                reader = csv.DictReader(f)
                columns = reader.fieldnames or []

                for i, row in enumerate(reader):
                    rows.append(row)
                    if i >= 4:
                        break

            return jsonify(
                {
                    "type": "csv",
                    "filename": filename,
                    "columns": columns,
                    "rows": rows,
                    "row_count_preview": len(rows),
                }
            )

        return jsonify(
            {
                "type": "unsupported",
                "filename": filename,
                "message": "Preview belum tersedia untuk tipe file ini.",
            }
        )

    except Exception as e:
        return jsonify({"error": f"Gagal membaca preview: {str(e)}"}), 500