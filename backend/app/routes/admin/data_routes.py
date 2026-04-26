import os
import csv
import json

from datetime import datetime
from werkzeug.utils import secure_filename
from flask import jsonify, request

from ..auth.auth_utils import admin_required, login_required
from . import admin_bp
from .admin_utils import (
    RAW_DIR,
    PROCESSED_DIR,
    OUTPUT_DIR,
    PROJECT_ROOT,
    build_dataset_item,
    is_allowed_flood_raster,
    is_allowed_drought_raster,
)

DATA_STATE_DIR = os.path.join(PROJECT_ROOT, "data", "_admin")
DATA_STATE_FILE = os.path.join(DATA_STATE_DIR, "active_sources.json")


def ensure_data_state_file():
    os.makedirs(DATA_STATE_DIR, exist_ok=True)

    if not os.path.exists(DATA_STATE_FILE):
        default_state = {
            "raw": {
                "admin_boundary": None,
                "sawah_layer": None,
                "total_prod_csv": "total_prod_padi.csv",
            },
            "processed": {},
        }
        with open(DATA_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(default_state, f, indent=2)


def load_data_state():
    ensure_data_state_file()
    with open(DATA_STATE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data_state(data):
    ensure_data_state_file()
    with open(DATA_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def list_files_by_prefix(folder: str, prefixes: list[str], allowed_exts: set[str] | None = None):
    if not os.path.exists(folder):
        return []

    result = []
    for name in os.listdir(folder):
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue

        lower = name.lower()
        if not any(lower.startswith(prefix.lower()) for prefix in prefixes):
            continue

        ext = os.path.splitext(lower)[1]
        if allowed_exts and ext not in allowed_exts:
            continue

        result.append(name)

    result.sort()
    return result


def resolve_active_or_first(folder: str, configured_name: str | None, candidates: list[str]) -> str | None:
    if configured_name:
        configured_path = os.path.join(folder, configured_name)
        if os.path.exists(configured_path):
            return configured_name

    return candidates[0] if candidates else None


def get_raw_datasets():
    state = load_data_state()
    datasets = []

    admin_candidates = list_files_by_prefix(
        RAW_DIR,
        prefixes=["batas_adm_kabkota"],
        allowed_exts={".shp", ".geojson", ".gpkg"},
    )
    sawah_candidates = list_files_by_prefix(
        RAW_DIR,
        prefixes=["lulc_sawah"],
        allowed_exts={".shp", ".geojson", ".gpkg"},
    )
    prod_candidates = list_files_by_prefix(
        RAW_DIR,
        prefixes=["total_prod_padi"],
        allowed_exts={".csv"},
    )

    active_admin = resolve_active_or_first(
        RAW_DIR,
        state.get("raw", {}).get("admin_boundary"),
        admin_candidates,
    )
    active_sawah = resolve_active_or_first(
        RAW_DIR,
        state.get("raw", {}).get("sawah_layer"),
        sawah_candidates,
    )
    active_prod = resolve_active_or_first(
        RAW_DIR,
        state.get("raw", {}).get("total_prod_csv"),
        prod_candidates,
    )

    admin_path = os.path.join(RAW_DIR, active_admin) if active_admin else os.path.join(RAW_DIR, "batas_adm_kabkota.shp")
    sawah_path = os.path.join(RAW_DIR, active_sawah) if active_sawah else os.path.join(RAW_DIR, "lulc_sawah.shp")
    prod_path = os.path.join(RAW_DIR, active_prod) if active_prod else os.path.join(RAW_DIR, "total_prod_padi.csv")

    flood_files = [
        "R25.tif", "R50.tif", "R100.tif", "R250.tif",
        "RC25.tif", "RC50.tif", "RC100.tif", "RC250.tif",
    ]
    drought_files = [
        "mme_rp25.tif", "mme_rp50.tif", "mme_rp100.tif", "mme_rp250.tif",
        "gpm_rp25.tif", "gpm_rp50.tif", "gpm_rp100.tif", "gpm_rp250.tif",
    ]

    flood_existing = [f for f in flood_files if os.path.exists(os.path.join(RAW_DIR, f))]
    drought_existing = [f for f in drought_files if os.path.exists(os.path.join(RAW_DIR, f))]

    flood_status = "active" if len(flood_existing) == len(flood_files) else ("partial" if flood_existing else "missing")
    drought_status = "active" if len(drought_existing) == len(drought_files) else ("partial" if drought_existing else "missing")

    datasets.append(build_dataset_item(
        dataset_id="raw-admin-boundary",
        name="Admin Boundary",
        group="raw",
        dtype="vector",
        category="supporting",
        folder="raw",
        filename=os.path.basename(admin_path),
        description="Batas administrasi kabupaten/kota yang digunakan sebagai referensi utama agregasi wilayah.",
        path=admin_path,
        active=os.path.exists(admin_path),
        tags=["admin", "vector", "boundary"],
        status="active" if os.path.exists(admin_path) else "missing",
    ))

    datasets.append(build_dataset_item(
        dataset_id="raw-sawah",
        name="Sawah Layer",
        group="raw",
        dtype="vector",
        category="supporting",
        folder="raw",
        filename=os.path.basename(sawah_path),
        description="Layer sawah sumber yang akan di-clean dan di-overlay dengan layer administrasi.",
        path=sawah_path,
        active=os.path.exists(sawah_path),
        tags=["sawah", "vector", "landuse"],
        status="active" if os.path.exists(sawah_path) else "missing",
    ))

    datasets.append(build_dataset_item(
        dataset_id="raw-total-prod",
        name="Total Produksi Padi",
        group="raw",
        dtype="table",
        category="supporting",
        folder="raw",
        filename=os.path.basename(prod_path),
        description="Data total produksi padi per kabupaten/kota yang dipakai untuk menghitung loss ekonomi.",
        path=prod_path,
        active=os.path.exists(prod_path),
        tags=["csv", "production", "supporting"],
        status="active" if os.path.exists(prod_path) else "missing",
    ))

    datasets.append(build_dataset_item(
        dataset_id="raw-flood-raster-set",
        name="Flood Raster Set",
        group="raw",
        dtype="bundle",
        category="flood",
        folder="raw",
        filename="R/RC raster bundle",
        description="Kumpulan raster flood current dan climate scenario (R25-R250, RC25-RC250).",
        path=os.path.join(RAW_DIR, flood_existing[0]) if flood_existing else None,
        active=(flood_status == "active"),
        status=flood_status,
        tags=["flood", "raster", "bundle"],
        files=flood_existing if flood_existing else flood_files,
        size_label=f"{len(flood_existing)}/{len(flood_files)} raster",
    ))

    datasets.append(build_dataset_item(
        dataset_id="raw-drought-raster-set",
        name="Drought Raster Set",
        group="raw",
        dtype="bundle",
        category="drought",
        folder="raw",
        filename="MME/GPM raster bundle",
        description="Kumpulan raster drought MME dan GPM scenario (RP25-RP250).",
        path=os.path.join(RAW_DIR, drought_existing[0]) if drought_existing else None,
        active=(drought_status == "active"),
        status=drought_status,
        tags=["drought", "raster", "bundle"],
        files=drought_existing if drought_existing else drought_files,
        size_label=f"{len(drought_existing)}/{len(drought_files)} raster",
    ))

    return datasets


def get_processed_datasets():
    datasets = []

    processed_files = [
        ("processed-admin-clean", "Admin Clean", "supporting", "admin_clean.geojson", "Layer admin hasil cleaning dan reprojection ke CRS target pipeline."),
        ("processed-sawah-clean", "Sawah Clean", "supporting", "sawah_clean.geojson", "Layer sawah hasil cleaning sebelum overlay dengan admin boundary."),
        ("processed-intersection", "Sawah Admin Intersection", "supporting", "sawah_admin_intersection.geojson", "Layer intersection sawah x admin yang menjadi basis zonal statistics."),
    ]

    for dataset_id, name, category, filename, description in processed_files:
        path = os.path.join(PROCESSED_DIR, filename)
        datasets.append(build_dataset_item(
            dataset_id=dataset_id,
            name=name,
            group="processed",
            dtype="vector",
            category=category,
            folder="processed",
            filename=filename,
            description=description,
            path=path,
            active=os.path.exists(path),
            tags=["processed", category],
            status="ready" if os.path.exists(path) else "missing",
        ))

    flood_reproj_files = [
        "reproj_R25.tif", "reproj_R50.tif", "reproj_R100.tif", "reproj_R250.tif",
        "reproj_RC25.tif", "reproj_RC50.tif", "reproj_RC100.tif", "reproj_RC250.tif",
    ]
    drought_reproj_files = [
        "reproj_mme_rp25.tif", "reproj_mme_rp50.tif", "reproj_mme_rp100.tif", "reproj_mme_rp250.tif",
        "reproj_gpm_rp25.tif", "reproj_gpm_rp50.tif", "reproj_gpm_rp100.tif", "reproj_gpm_rp250.tif",
    ]

    flood_existing = [f for f in flood_reproj_files if os.path.exists(os.path.join(PROCESSED_DIR, f))]
    drought_existing = [f for f in drought_reproj_files if os.path.exists(os.path.join(PROCESSED_DIR, f))]

    flood_status = "ready" if len(flood_existing) == len(flood_reproj_files) else ("partial" if flood_existing else "missing")
    drought_status = "ready" if len(drought_existing) == len(drought_reproj_files) else ("partial" if drought_existing else "missing")

    datasets.append(build_dataset_item(
        dataset_id="processed-flood-reproj",
        name="Flood Reprojected Raster Set",
        group="processed",
        dtype="bundle",
        category="flood",
        folder="processed",
        filename="reproj_R / reproj_RC bundle",
        description="Raster flood yang sudah direproject ke EPSG:4326 dan siap untuk zonal stats.",
        path=os.path.join(PROCESSED_DIR, flood_existing[0]) if flood_existing else None,
        active=(flood_status == "ready"),
        status=flood_status,
        tags=["processed", "flood", "raster"],
        files=flood_existing if flood_existing else flood_reproj_files,
        size_label=f"{len(flood_existing)}/{len(flood_reproj_files)} raster",
    ))

    datasets.append(build_dataset_item(
        dataset_id="processed-drought-reproj",
        name="Drought Reprojected Raster Set",
        group="processed",
        dtype="bundle",
        category="drought",
        folder="processed",
        filename="reproj_mme / reproj_gpm bundle",
        description="Raster drought yang sudah direproject ke EPSG:4326 dan siap untuk zonal stats.",
        path=os.path.join(PROCESSED_DIR, drought_existing[0]) if drought_existing else None,
        active=(drought_status == "ready"),
        status=drought_status,
        tags=["processed", "drought", "raster"],
        files=drought_existing if drought_existing else drought_reproj_files,
        size_label=f"{len(drought_existing)}/{len(drought_reproj_files)} raster",
    ))

    return datasets


def get_registry_datasets():
    flood_targets = [
        os.path.join(OUTPUT_DIR, "kabkota_flood_stats.geojson"),
        os.path.join(OUTPUT_DIR, "kabkota_flood_lop.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_flood_loss_std.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_flood_aal_v2.csv"),
    ]
    drought_targets = [
        os.path.join(OUTPUT_DIR, "kabkota_drought_stats.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_drought_di.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_drought_lop.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_drought_loss_std.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_drought_aal_v2.csv"),
    ]
    multi_targets = [
        os.path.join(OUTPUT_DIR, "kabkota_flood_loss.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_drought_loss.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_multihazard_clean.gpkg"),
        os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal_v2.csv"),
    ]

    def calc_status(paths):
        exists_count = sum(os.path.exists(p) for p in paths)
        if exists_count == len(paths):
            return "ready"
        if exists_count > 0:
            return "partial"
        return "missing"

    registry = [
        build_dataset_item(
            dataset_id="registry-flood",
            name="Flood Dataset Registry",
            group="registry",
            dtype="bundle",
            category="flood",
            folder="registry",
            filename="Flood pipeline bundle",
            description="Kesiapan dataset logis untuk pipeline flood: raw raster, zonal, loss, AAL, dan web layer.",
            path=next((p for p in flood_targets if os.path.exists(p)), None),
            active=(calc_status(flood_targets) == "ready"),
            status=calc_status(flood_targets),
            tags=["registry", "flood"],
            files=[
                "Raw flood raster set",
                "kabkota_flood_stats.geojson",
                "kabkota_flood_lop.gpkg",
                "kabkota_flood_loss_std.gpkg",
                "kabkota_flood_aal_v2.csv",
                "web_flood_*_v2.geojson",
            ],
            size_label="Complete bundle",
        ),
        build_dataset_item(
            dataset_id="registry-drought",
            name="Drought Dataset Registry",
            group="registry",
            dtype="bundle",
            category="drought",
            folder="registry",
            filename="Drought pipeline bundle",
            description="Kesiapan dataset logis untuk pipeline drought: raw raster, DI, LOP, loss, AAL, dan web layer.",
            path=next((p for p in drought_targets if os.path.exists(p)), None),
            active=(calc_status(drought_targets) == "ready"),
            status=calc_status(drought_targets),
            tags=["registry", "drought"],
            files=[
                "Raw drought raster set",
                "kabkota_drought_stats.gpkg",
                "kabkota_drought_di.gpkg",
                "kabkota_drought_lop.gpkg",
                "kabkota_drought_loss_std.gpkg",
                "kabkota_drought_aal_v2.csv",
                "web_drought_*_v2.geojson",
            ],
            size_label="Complete bundle",
        ),
        build_dataset_item(
            dataset_id="registry-multi",
            name="Multi-hazard Dataset Registry",
            group="registry",
            dtype="bundle",
            category="multi",
            folder="registry",
            filename="Multi-hazard pipeline bundle",
            description="Dataset logis multi-hazard yang bergantung pada ketersediaan output flood dan drought aktif.",
            path=next((p for p in multi_targets if os.path.exists(p)), None),
            active=(calc_status(multi_targets) == "ready"),
            status=calc_status(multi_targets),
            tags=["registry", "multi"],
            files=[
                "kabkota_flood_loss.gpkg",
                "kabkota_drought_loss.gpkg",
                "kabkota_multihazard_clean.gpkg",
                "kabkota_multihazard_aal_v2.csv",
                "web_multi_*_v2.geojson",
            ],
            size_label="Depends on flood+drought",
        ),
    ]

    return registry


@admin_bp.route("/api/admin/data/readiness", methods=["GET"])
@login_required
@admin_required
def admin_data_readiness():
    """
    Validates that all required pipeline input files are present in the correct
    subdirectories of backend/data/raw/.  Returns a per-group checklist.
    """
    raw_hazard_dir  = os.path.join(RAW_DIR, "hazard")
    raw_admin_dir   = os.path.join(RAW_DIR, "administrasi")
    raw_exposure_dir = os.path.join(RAW_DIR, "exposure")

    def _checks(folder, filenames):
        return [
            {"label": f, "exists": os.path.isfile(os.path.join(folder, f))}
            for f in filenames
        ]

    flood_checks = _checks(raw_hazard_dir, [
        "flood_r25.tif", "flood_r50.tif", "flood_r100.tif", "flood_r250.tif",
        "flood_rc25.tif", "flood_rc50.tif", "flood_rc100.tif", "flood_rc250.tif",
    ])
    drought_checks = _checks(raw_hazard_dir, [
        "drought_r25.tif", "drought_r50.tif", "drought_r100.tif", "drought_r250.tif",
        "drought_rc25.tif", "drought_rc50.tif", "drought_rc100.tif", "drought_rc250.tif",
    ])
    admin_checks   = _checks(raw_admin_dir,   ["regions.gpkg"])
    sawah_checks   = _checks(raw_exposure_dir, ["sawah_selected.gpkg"])
    prod_checks    = _checks(raw_exposure_dir, ["totalproduksipadi.csv"])

    groups = [
        {"label": "Raster Flood",        "folder": "raw/hazard/",        "checks": flood_checks,   "ok": all(c["exists"] for c in flood_checks)},
        {"label": "Raster Drought",       "folder": "raw/hazard/",        "checks": drought_checks, "ok": all(c["exists"] for c in drought_checks)},
        {"label": "Batas Administrasi",   "folder": "raw/administrasi/",  "checks": admin_checks,   "ok": all(c["exists"] for c in admin_checks)},
        {"label": "Layer Sawah",          "folder": "raw/exposure/",      "checks": sawah_checks,   "ok": all(c["exists"] for c in sawah_checks)},
        {"label": "Data Produksi Padi",   "folder": "raw/exposure/",      "checks": prod_checks,    "ok": all(c["exists"] for c in prod_checks)},
    ]

    return jsonify({
        "all_ok": all(g["ok"] for g in groups),
        "groups": groups,
    })


@admin_bp.route("/api/admin/data", methods=["GET"])
@login_required
@admin_required
def admin_data_registry():
    raw_items = get_raw_datasets()
    processed_items = get_processed_datasets()
    registry_items = get_registry_datasets()

    all_items = raw_items + processed_items + registry_items

    latest_update = None
    timestamps = [item.get("lastUpdated") for item in all_items if item.get("lastUpdated")]
    if timestamps:
        latest_update = sorted(timestamps, reverse=True)[0]

    return jsonify({
        "summary": {
            "raw_count": len(raw_items),
            "processed_count": len(processed_items),
            "registry_count": len(registry_items),
            "active_count": sum(1 for item in all_items if item.get("active")),
            "latest_update": latest_update,
        },
        "raw": raw_items,
        "processed": processed_items,
        "registry": registry_items,
    })


@admin_bp.route("/api/admin/data/preview", methods=["GET"])
@login_required
@admin_required
def admin_data_preview():
    filename = request.args.get("filename", "").strip()
    folder = request.args.get("folder", "").strip()

    if not filename:
        return jsonify({"error": "Filename wajib diisi"}), 400

    allowed_folders = {
        "raw": RAW_DIR,
        "processed": PROCESSED_DIR,
        "output": OUTPUT_DIR,
    }

    if folder not in allowed_folders:
        return jsonify({"error": "Folder tidak valid. Gunakan raw, processed, atau output"}), 400

    base_dir = allowed_folders[folder]
    file_path = os.path.join(base_dir, filename)

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "File tidak ditemukan"}), 404

    ext = os.path.splitext(filename)[1].lower()

    try:
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

            return jsonify({
                "type": "csv",
                "filename": filename,
                "folder": folder,
                "columns": columns,
                "rows": rows,
                "row_count_preview": len(rows),
            })

        if ext == ".geojson":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            features = data.get("features", [])
            sample_props = {}
            property_keys = []

            if features and isinstance(features[0], dict):
                sample_props = features[0].get("properties", {}) or {}
                property_keys = list(sample_props.keys())

            return jsonify({
                "type": "geojson",
                "filename": filename,
                "folder": folder,
                "feature_count": len(features),
                "property_keys": property_keys,
                "sample_properties": sample_props,
            })

        if ext in {".tif", ".tiff"}:
            try:
                import rasterio

                with rasterio.open(file_path) as src:
                    return jsonify({
                        "type": "raster",
                        "filename": filename,
                        "folder": folder,
                        "crs": src.crs.to_string() if src.crs else None,
                        "width": src.width,
                        "height": src.height,
                        "count": src.count,
                        "dtype": src.dtypes[0] if src.dtypes else None,
                        "nodata": src.nodata,
                        "bounds": list(src.bounds),
                    })
            except Exception as raster_error:
                return jsonify({
                    "type": "raster",
                    "filename": filename,
                    "folder": folder,
                    "message": f"Gagal membaca metadata raster: {str(raster_error)}",
                })

        if ext == ".gpkg":
            try:
                import fiona

                layers = fiona.listlayers(file_path)
                return jsonify({
                    "type": "gpkg",
                    "filename": filename,
                    "folder": folder,
                    "layers": layers,
                    "layer_count": len(layers),
                })
            except Exception as gpkg_error:
                return jsonify({
                    "type": "gpkg",
                    "filename": filename,
                    "folder": folder,
                    "message": f"Gagal membaca metadata GPKG: {str(gpkg_error)}",
                })

        return jsonify({
            "type": "unsupported",
            "filename": filename,
            "folder": folder,
            "message": "Preview belum tersedia untuk tipe file ini.",
        })

    except Exception as e:
        return jsonify({"error": f"Gagal membaca preview data: {str(e)}"}), 500


@admin_bp.route("/api/admin/upload-data", methods=["POST"])
@login_required
@admin_required
def admin_upload_data():
    data_type = (request.form.get("data_type") or "unknown").strip()
    scenario = (request.form.get("scenario") or "").strip().lower()
    climate_type = (request.form.get("climate_type") or "").strip().lower()
    notes = (request.form.get("notes") or "").strip()
    replace_existing = (request.form.get("replace_existing") or "true").strip().lower() == "true"
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "File tidak ditemukan"}), 400

    if not file.filename:
        return jsonify({"error": "Nama file tidak valid"}), 400

    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    original_filename = secure_filename(file.filename)
    ext = os.path.splitext(original_filename)[1].lower()

    allowed_vector_exts = {".shp", ".dbf", ".shx", ".prj", ".geojson", ".gpkg"}
    allowed_raster_exts = {".tif", ".tiff"}
    allowed_table_exts = {".csv"}

    save_dir = None
    save_filename = None

    if data_type == "admin_boundary":
        if ext not in allowed_vector_exts:
            return jsonify({
                "error": "Format file admin boundary tidak didukung. Gunakan .shp, .dbf, .shx, .prj, .geojson, atau .gpkg"
            }), 400
        save_dir = RAW_DIR
        save_filename = f"batas_adm_kabkota{ext}"

    elif data_type == "sawah_layer":
        if ext not in allowed_vector_exts:
            return jsonify({
                "error": "Format file sawah layer tidak didukung. Gunakan .shp, .dbf, .shx, .prj, .geojson, atau .gpkg"
            }), 400
        save_dir = RAW_DIR
        save_filename = f"lulc_sawah{ext}"

    elif data_type == "total_prod_csv":
        if ext not in allowed_table_exts:
            return jsonify({"error": "Format file total produksi harus .csv"}), 400
        save_dir = RAW_DIR
        save_filename = "total_prod_padi.csv"

    elif data_type == "flood_raster":
        if ext not in allowed_raster_exts:
            return jsonify({"error": "Format flood raster harus .tif atau .tiff"}), 400
        if not is_allowed_flood_raster(original_filename):
            return jsonify({
                "error": "Nama flood raster tidak valid. Gunakan nama seperti R25.tif, R50.tif, RC25.tif, dst."
            }), 400
        save_dir = RAW_DIR
        save_filename = original_filename

    elif data_type == "drought_raster":
        if ext not in allowed_raster_exts:
            return jsonify({"error": "Format drought raster harus .tif atau .tiff"}), 400
        if not is_allowed_drought_raster(original_filename):
            return jsonify({
                "error": "Nama drought raster tidak valid. Gunakan nama seperti mme_rp25.tif, gpm_rp25.tif, dst."
            }), 400
        save_dir = RAW_DIR
        save_filename = original_filename

    elif data_type == "processed_vector":
        if ext not in {".geojson", ".gpkg"}:
            return jsonify({"error": "Format processed vector harus .geojson atau .gpkg"}), 400
        save_dir = PROCESSED_DIR
        save_filename = original_filename

    else:
        return jsonify({"error": f"Data type tidak dikenali: {data_type}"}), 400

    save_path = os.path.join(save_dir, save_filename)

    if os.path.exists(save_path) and not replace_existing:
        return jsonify({
            "error": f"File sudah ada dan replace_existing=false: {save_filename}"
        }), 409

    file.save(save_path)

    stat = os.stat(save_path)

    state = load_data_state()

    if data_type == "admin_boundary":
        state["raw"]["admin_boundary"] = save_filename
    elif data_type == "sawah_layer":
        state["raw"]["sawah_layer"] = save_filename
    elif data_type == "total_prod_csv":
        state["raw"]["total_prod_csv"] = save_filename

    save_data_state(state)

    return jsonify({
        "message": "Upload berhasil",
        "data_type": data_type,
        "scenario": scenario,
        "climate_type": climate_type,
        "notes": notes,
        "original_filename": original_filename,
        "saved_filename": save_filename,
        "saved_path": save_path,
        "size_bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
    })


@admin_bp.route("/api/admin/data/delete", methods=["POST"])
@login_required
@admin_required
def admin_delete_data():
    data = request.get_json(silent=True) or {}
    filename = (data.get("filename") or "").strip()
    folder = (data.get("folder") or "").strip()

    if not filename:
        return jsonify({"error": "Filename wajib diisi"}), 400

    allowed_folders = {
        "raw": RAW_DIR,
        "processed": PROCESSED_DIR,
    }

    if folder not in allowed_folders:
        return jsonify({"error": "Folder tidak valid. Hanya raw dan processed yang boleh dihapus"}), 400

    file_path = os.path.join(allowed_folders[folder], filename)

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "File tidak ditemukan"}), 404

    os.remove(file_path)

    state = load_data_state()
    if folder == "raw":
        for key, value in state.get("raw", {}).items():
            if value == filename:
                state["raw"][key] = None
        save_data_state(state)

    return jsonify({
        "message": "File berhasil dihapus",
        "filename": filename,
        "folder": folder,
    })


@admin_bp.route("/api/admin/data/set-active", methods=["POST"])
@login_required
@admin_required
def admin_set_active_data():
    data = request.get_json(silent=True) or {}
    dataset_key = (data.get("dataset_key") or "").strip()
    filename = (data.get("filename") or "").strip()
    folder = (data.get("folder") or "").strip()

    if not dataset_key or not filename or not folder:
        return jsonify({"error": "dataset_key, filename, dan folder wajib diisi"}), 400

    if folder != "raw":
        return jsonify({"error": "Saat ini set-active hanya didukung untuk folder raw"}), 400

    allowed_dataset_keys = {"admin_boundary", "sawah_layer", "total_prod_csv"}
    if dataset_key not in allowed_dataset_keys:
        return jsonify({"error": f"dataset_key tidak didukung: {dataset_key}"}), 400

    file_path = os.path.join(RAW_DIR, filename)
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "File tidak ditemukan"}), 404

    state = load_data_state()
    state["raw"][dataset_key] = filename
    save_data_state(state)

    return jsonify({
        "message": "Active source berhasil diperbarui",
        "dataset_key": dataset_key,
        "filename": filename,
        "folder": folder,
    })
