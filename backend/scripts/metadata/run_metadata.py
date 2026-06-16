import hashlib
import json
import math
import os
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.scripts.config import settings
from backend.scripts.config.hazard import RASTER_HAZARDS
from backend.scripts.config.paths import (
    DATA_DIR,
    OUTPUT_ANALYSIS_DIR,
    OUTPUT_DIR,
    OUTPUT_ZONAL_DIR,
    PROCESSED_HAZARD_DIR,
    PROCESSED_VECTOR_DIR,
    RAW_ADMIN_DIR,
    RAW_EXPOSURE_DIR,
    RAW_HAZARD_DIR,
)
from backend.scripts.utils import log


METADATA_VERSION = "1.0"
RUN_METADATA_DIR = os.path.join(OUTPUT_DIR, "runs")
_MAX_CHECKSUM_BYTES = 25 * 1024 * 1024
_MAX_VECTOR_INSPECT_BYTES = 25 * 1024 * 1024
_WORKSPACE_ROOT = Path(settings.BASE_PROJECT).parent


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _safe_call(default: Any, fn, *args, **kwargs) -> Any:
    try:
        return fn(*args, **kwargs)
    except Exception:
        return default


def _rel(path: str | os.PathLike | None) -> str | None:
    if path is None:
        return None
    try:
        return os.path.relpath(str(path), _WORKSPACE_ROOT)
    except Exception:
        return str(path)


def _format_from_path(path: str) -> str:
    ext = Path(path).suffix.lower()
    return {
        ".gpkg": "GeoPackage",
        ".tif": "GeoTIFF",
        ".tiff": "GeoTIFF",
        ".geojson": "GeoJSON",
        ".json": "JSON",
        ".csv": "CSV",
    }.get(ext, ext.lstrip(".").upper() or "unknown")


def _sha256(path: str) -> dict[str, Any]:
    size = os.path.getsize(path)
    if size > _MAX_CHECKSUM_BYTES:
        return {
            "sha256": None,
            "checksum_status": "skipped_large_file",
            "checksum_limit_bytes": _MAX_CHECKSUM_BYTES,
        }

    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"sha256": digest.hexdigest(), "checksum_status": "computed"}


def _inspect_vector(path: str) -> dict[str, Any]:
    import fiona

    with fiona.open(path) as src:
        bounds = src.bounds
        crs = src.crs_wkt or src.crs
        if hasattr(crs, "to_string"):
            crs = crs.to_string()
        if crs is not None:
            crs = str(crs)
        bbox = [float(v) for v in bounds] if bounds else None
        feature_count = len(src)
    return {
        "crs": crs,
        "bbox": bbox,
        "feature_count": int(feature_count),
    }


def _inspect_raster(path: str) -> dict[str, Any]:
    import rasterio

    with rasterio.open(path) as src:
        return {
            "crs": src.crs.to_string() if src.crs is not None else None,
            "bbox": [float(src.bounds.left), float(src.bounds.bottom), float(src.bounds.right), float(src.bounds.top)],
            "width": int(src.width),
            "height": int(src.height),
            "nodata": src.nodata,
        }


def describe_file(path: str | os.PathLike, role: str, dataset_id: str | None = None) -> dict[str, Any]:
    file_path = str(path)
    item: dict[str, Any] = {
        "dataset_id": dataset_id or Path(file_path).stem,
        "role": role,
        "path": _rel(file_path),
        "format": _format_from_path(file_path),
        "exists": os.path.exists(file_path),
    }

    if not item["exists"]:
        item["status"] = "missing"
        return item

    stat = os.stat(file_path)
    item.update({
        "status": "available",
        "size_bytes": int(stat.st_size),
        "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(timespec="seconds"),
    })

    ext = Path(file_path).suffix.lower()
    if ext in {".gpkg", ".geojson"}:
        if stat.st_size <= _MAX_VECTOR_INSPECT_BYTES:
            item.update(_safe_call({"inspect_error": "vector_inspection_failed"}, _inspect_vector, file_path))
        else:
            item.update({
                "inspect_status": "skipped_large_vector",
                "inspect_limit_bytes": _MAX_VECTOR_INSPECT_BYTES,
            })
    elif ext in {".tif", ".tiff"}:
        item.update(_safe_call({"inspect_error": "raster_inspection_failed"}, _inspect_raster, file_path))

    item.update(_safe_call({"sha256": None, "checksum_status": "failed"}, _sha256, file_path))
    return item


def _git_commit() -> str | None:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=str(_WORKSPACE_ROOT),
        capture_output=True,
        text=True,
        timeout=2,
        check=False,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


def _settings_snapshot() -> dict[str, Any]:
    return {
        "default_crs": settings.DEFAULT_CRS,
        "zonal_chunk_size": settings.ZONAL_CHUNK_SIZE,
        "zonal_stats": settings.ZONAL_STATS,
        "zonal_all_touched": settings.ZONAL_ALL_TOUCHED,
        "raster_resampling_method": settings.RASTER_RESAMPLING_METHOD,
        "gabah_kering_panen": settings.GABAH_KERING_PANEN,
    }


def _derive_metadata_status(metadata: dict[str, Any]) -> str:
    if metadata.get("metadata_status"):
        return str(metadata["metadata_status"])
    if metadata.get("status") == "failed":
        return "partial"
    validation = metadata.get("validation_summary") or {}
    if validation.get("input_complete") and validation.get("outputs_complete") and validation.get("pipeline_success"):
        return "complete"
    return "partial"


def sync_metadata_to_db(run_id: int | None, metadata_path: str | os.PathLike) -> None:
    """
    Upsert the full run metadata JSON to Supabase/Postgres.

    This is intentionally non-blocking. Missing DATABASE_URL, missing migration,
    or transient DB failures should never change the pipeline outcome.
    """
    if run_id is None:
        return

    conn = None
    cur = None
    try:
        from psycopg2.extras import Json
        from backend.scripts.utils.db import get_conn

        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        metadata = _sanitize_json(metadata)
        metadata_status = _derive_metadata_status(metadata)

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO run_metadata (
                run_id,
                hazard,
                status,
                metadata_version,
                metadata_status,
                metadata_path,
                metadata,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (run_id) DO UPDATE SET
                hazard = EXCLUDED.hazard,
                status = EXCLUDED.status,
                metadata_version = EXCLUDED.metadata_version,
                metadata_status = EXCLUDED.metadata_status,
                metadata_path = EXCLUDED.metadata_path,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            """,
            (
                run_id,
                metadata.get("hazard"),
                metadata.get("status"),
                metadata.get("metadata_version"),
                metadata_status,
                _rel(metadata_path),
                Json(metadata),
            ),
        )
        conn.commit()
        log.ok("METADATA", f"Metadata run #{run_id} tersinkron ke database")
    except Exception as e:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
        log.warn("METADATA", f"Sinkronisasi metadata ke DB gagal (non-fatal): {e}")
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def collect_input_datasets(hazard: str) -> list[dict[str, Any]]:
    items = [
        describe_file(os.path.join(RAW_ADMIN_DIR, "regions.gpkg"), "input_admin", "regions"),
        describe_file(os.path.join(RAW_EXPOSURE_DIR, "sawah_selected.gpkg"), "input_exposure", "sawah_selected"),
        describe_file(settings.FILES_PRODUCTION["padi"], "input_production", "total_produksi_padi"),
    ]

    hazards = RASTER_HAZARDS if hazard in ("multi", "multihazard") else [
        h for h in RASTER_HAZARDS if h["name"] == hazard
    ]
    for h in hazards:
        prefix = h["prefix"]
        if not prefix:
            continue
        for filename in sorted(os.listdir(RAW_HAZARD_DIR)) if os.path.isdir(RAW_HAZARD_DIR) else []:
            if filename.startswith(prefix) and filename.lower().endswith((".tif", ".tiff")):
                items.append(describe_file(
                    os.path.join(RAW_HAZARD_DIR, filename),
                    f"input_hazard_{h['name']}",
                    Path(filename).stem,
                ))
    return items


def collect_output_artifacts(hazard: str, include_processed: bool = True) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    if include_processed:
        items.append(describe_file(
            os.path.join(PROCESSED_VECTOR_DIR, "sawah_admin_intersection.geojson"),
            "processed_vector",
            "sawah_admin_intersection",
        ))
        for h in RASTER_HAZARDS:
            if hazard not in ("multi", "multihazard") and h["name"] != hazard:
                continue
            suffixes = ["_reproj.tif"]
            if h.get("normalize"):
                suffixes.append("_norm.tif")
            for filename in sorted(os.listdir(PROCESSED_HAZARD_DIR)) if os.path.isdir(PROCESSED_HAZARD_DIR) else []:
                if filename.startswith(h["prefix"]) and any(filename.endswith(s) for s in suffixes):
                    items.append(describe_file(
                        os.path.join(PROCESSED_HAZARD_DIR, filename),
                        f"processed_hazard_{h['name']}",
                        Path(filename).stem,
                    ))

    for name in ("flood", "drought"):
        if hazard in ("multi", "multihazard", name):
            items.append(describe_file(
                os.path.join(OUTPUT_ZONAL_DIR, f"{name}_stats.geojson"),
                "zonal_output",
                f"{name}_stats",
            ))

    analysis_names = {
        "flood": ["kabkota_flood_final.geojson"],
        "drought": ["kabkota_drought_final.geojson"],
        "multi": ["kabkota_multihazard_final.geojson"],
        "multihazard": ["kabkota_multihazard_final.geojson"],
    }
    selected = analysis_names.get(hazard, [])
    if hazard in ("multi", "multihazard"):
        selected = [
            "kabkota_flood_final.geojson",
            "kabkota_drought_final.geojson",
            "kabkota_multihazard_final.geojson",
        ]
    for filename in selected:
        items.append(describe_file(
            os.path.join(OUTPUT_ANALYSIS_DIR, filename),
            "analysis_output",
            Path(filename).stem,
        ))
    return items


class RunMetadataRecorder:
    """Non-blocking JSON metadata ledger for a PADIS pipeline run."""

    def __init__(
        self,
        run_id: int | None,
        hazard: str,
        operator_name: str,
        source: str = "local",
    ) -> None:
        self.run_id = run_id
        self.hazard = hazard
        self.operator_name = operator_name
        self.source = source
        self.run_key = str(run_id) if run_id is not None else f"local_{int(time.time())}"
        self.path = os.path.join(RUN_METADATA_DIR, f"run_{self.run_key}_metadata.json")

    def start(self, steps_run: dict[str, bool]) -> None:
        self._safe_update(lambda data: self._start(data, steps_run), "start")

    def record_stage(self, stage: str, status: str, details: Any = None) -> None:
        self._safe_update(lambda data: self._record_stage(data, stage, status, details), f"stage:{stage}")

    def refresh_outputs(self, include_processed: bool = True) -> None:
        self._safe_update(lambda data: self._refresh_outputs(data, include_processed), "outputs")

    def finish(self, status: str, message: str, elapsed_seconds: float | None = None) -> None:
        self._safe_update(lambda data: self._finish(data, status, message, elapsed_seconds), "finish")

    def mark_backfilled(self, message: str) -> None:
        self._safe_update(lambda data: self._mark_backfilled(data, message), "backfill")

    def _start(self, data: dict[str, Any], steps_run: dict[str, bool]) -> dict[str, Any]:
        now = utc_now()
        input_datasets = collect_input_datasets(self.hazard)
        data.update({
            "metadata_version": METADATA_VERSION,
            "run_id": self.run_id,
            "run_key": self.run_key,
            "hazard": self.hazard,
            "operator_name": self.operator_name,
            "source": self.source,
            "status": "running",
            "created_at": data.get("created_at") or now,
            "updated_at": now,
            "pipeline": {
                "name": "PADIS geospatial risk pipeline",
                "stages": [name for name, enabled in steps_run.items() if enabled],
                "code_commit": _safe_call(None, _git_commit),
            },
            "parameters": _settings_snapshot(),
            "environment": {
                "python_version": sys.version.split()[0],
                "platform": platform.platform(),
                "cwd": _rel(os.getcwd()),
            },
            "input_datasets": input_datasets,
            "process_lineage": data.get("process_lineage", []),
            "output_artifacts": data.get("output_artifacts", []),
            "validation_summary": {
                "metadata_recording": "non_blocking",
                "input_complete": all(item.get("exists") for item in input_datasets),
            },
            "warnings": data.get("warnings", []),
        })
        return data

    def _record_stage(self, data: dict[str, Any], stage: str, status: str, details: Any) -> dict[str, Any]:
        data.setdefault("process_lineage", []).append({
            "stage": stage,
            "status": status,
            "recorded_at": utc_now(),
            "details": _json_safe(details),
        })
        data["updated_at"] = utc_now()
        return data

    def _refresh_outputs(self, data: dict[str, Any], include_processed: bool) -> dict[str, Any]:
        data["output_artifacts"] = collect_output_artifacts(self.hazard, include_processed=include_processed)
        data.setdefault("validation_summary", {})["outputs_complete"] = all(
            item.get("exists") for item in data["output_artifacts"] if item.get("role") == "analysis_output"
        )
        data["updated_at"] = utc_now()
        return data

    def _finish(
        self,
        data: dict[str, Any],
        status: str,
        message: str,
        elapsed_seconds: float | None,
    ) -> dict[str, Any]:
        data["status"] = status
        data["message"] = message
        data["finished_at"] = utc_now()
        data["updated_at"] = data["finished_at"]
        if elapsed_seconds is not None:
            data["execution_time_seconds"] = round(float(elapsed_seconds), 3)
        data.setdefault("validation_summary", {})["pipeline_success"] = status == "success"
        data["metadata_status"] = _derive_metadata_status(data)
        return data

    def _mark_backfilled(self, data: dict[str, Any], message: str) -> dict[str, Any]:
        now = utc_now()
        data["status"] = "backfilled_partial"
        data["metadata_status"] = "backfilled_partial"
        data["message"] = message
        data["backfilled_at"] = now
        data["updated_at"] = now
        data.setdefault("validation_summary", {})["pipeline_success"] = None
        data.setdefault("warnings", []).append(
            "Metadata dibuat setelah run selesai; sebagian konteks historis tidak dapat dipastikan."
        )
        return data

    def _safe_update(self, updater, action: str) -> None:
        try:
            os.makedirs(RUN_METADATA_DIR, exist_ok=True)
            data = self._read()
            data = updater(data)
            self._write(data)
        except Exception as e:
            log.warn("METADATA", f"Pencatatan metadata {action} gagal (non-fatal): {e}")

    def _read(self) -> dict[str, Any]:
        if not os.path.exists(self.path):
            return {}
        with open(self.path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data: dict[str, Any]) -> None:
        tmp_path = f"{self.path}.tmp"
        data = _sanitize_json(data)
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str, allow_nan=False)
            f.write("\n")
        os.replace(tmp_path, self.path)


def _json_safe(value: Any) -> Any:
    try:
        json.dumps(value, default=str)
        return value
    except Exception:
        return str(value)


def _sanitize_json(value: Any) -> Any:
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _sanitize_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_json(v) for v in value]
    return value
