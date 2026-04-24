import os
import threading

from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROUTES_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
APP_DIR = os.path.abspath(os.path.join(ROUTES_DIR, ".."))
BACKEND_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))

# Data lives inside backend/, not at project root
RAW_DIR = os.path.join(BACKEND_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BACKEND_DIR, "data", "processed")
OUTPUT_DIR = os.path.join(BACKEND_DIR, "data", "output", "analysis")

SCRIPTS_DIR = os.path.join(BACKEND_DIR, "scripts")

PROCESS_STATE = {
    "status": "idle",
    "started_at": None,
    "finished_at": None,
    "last_result": None,
    "message": "Belum ada proses yang sedang berjalan.",
    "hazard": None,
    "mode": None,
    "logs": [],
    "current_script": None,
    "current_step": 0,
    "total_steps": 0,
    "progress_percent": 0,
    "updated_outputs": [],
}

PROCESS_LOCK = threading.Lock()
MAX_PROCESS_LOG_ITEMS = 100

PIPELINE_REGISTRY = {
    "flood": {
        "full": [
            "run_preprocess.py",
            "run_zonal.py",
            "run_analysis_flood.py",
            "run_etl.py",
        ],
        "preprocess": [
            "run_preprocess.py",
        ],
        "analysis": [
            "run_zonal.py",
            "run_analysis_flood.py",
        ],
        "web": [
            "run_etl.py",
        ],
    },
    "drought": {
        "full": [
            "run_preprocess.py",
            "run_zonal.py",
            "run_analysis_drought.py",
            "run_etl.py",
        ],
        "preprocess": [
            "run_preprocess.py",
        ],
        "analysis": [
            "run_zonal.py",
            "run_analysis_drought.py",
        ],
        "web": [
            "run_etl.py",
        ],
    },
    "multi": {
        "full": [
            "run_analysis_flood.py",
            "run_analysis_drought.py",
            "run_analysis_multi.py",
            "run_etl.py",
        ],
        "preprocess": [],
        "analysis": [
            "run_analysis_flood.py",
            "run_analysis_drought.py",
            "run_analysis_multi.py",
        ],
        "web": [
            "run_etl.py",
        ],
    },
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def update_process_state(**kwargs):
    with PROCESS_LOCK:
        PROCESS_STATE.update(kwargs)


def append_process_log(script, returncode, stdout_text="", stderr_text="", timestamp=None):
    with PROCESS_LOCK:
        PROCESS_STATE["logs"].append({
            "script": script,
            "returncode": returncode,
            "stdout": (stdout_text or "")[-4000:],
            "stderr": (stderr_text or "")[-4000:],
            "timestamp": timestamp or now_iso(),
        })
        PROCESS_STATE["logs"] = PROCESS_STATE["logs"][-MAX_PROCESS_LOG_ITEMS:]


def safe_stat(path: str):
    if not path or not os.path.exists(path):
        return None

    stat = os.stat(path)
    return {
        "size_bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(
            stat.st_mtime, tz=timezone.utc
        ).isoformat(),
    }


def infer_dataset_status(path: str, active: bool = False) -> str:
    if not path or not os.path.exists(path):
        return "missing"
    if active:
        return "active"
    return "ready"


def build_dataset_item(
    *,
    dataset_id: str,
    name: str,
    group: str,
    dtype: str,
    category: str,
    folder: str,
    filename: str,
    description: str,
    path: str | None = None,
    active: bool = False,
    tags: list[str] | None = None,
    files: list[str] | None = None,
    size_label: str | None = None,
    status: str | None = None,
):
    info = safe_stat(path) if path else None

    if status is None:
        status = infer_dataset_status(path, active=active) if path else "ready"

    if size_label is None:
        if files:
            size_label = f"{len(files)} file"
        elif info:
            size_label = f"{info['size_bytes']} bytes"
        else:
            size_label = "-"

    return {
        "id": dataset_id,
        "name": name,
        "group": group,
        "type": dtype,
        "category": category,
        "folder": folder,
        "filename": filename,
        "status": status,
        "active": active,
        "lastUpdated": info["modified_at"] if info else None,
        "sizeLabel": size_label,
        "description": description,
        "tags": tags or [],
        "files": files or [],
        "path": path,
        "exists": os.path.exists(path) if path else False,
        "size_bytes": info["size_bytes"] if info else 0,
    }


def normalize_output_name(filename: str) -> str:
    name, ext = os.path.splitext(filename)
    lower_name = name.lower()
    lower_ext = ext.lower()

    if lower_name.endswith("_v2"):
        lower_name = lower_name[:-3]

    return f"{lower_name}{lower_ext}"


def is_v2_file(filename: str) -> bool:
    name, _ext = os.path.splitext(filename)
    return name.lower().endswith("_v2")


def categorize_output(filename: str) -> str:
    name = filename.lower()

    if "aal" in name:
        return "aal"
    if name.startswith("web_flood") or "kabkota_flood" in name:
        return "flood"
    if name.startswith("web_drought") or "kabkota_drought" in name:
        return "drought"
    if (
        name.startswith("web_multi")
        or name.startswith("web_multihazard")
        or "kabkota_multihazard" in name
    ):
        return "multi"
    if (
        name.startswith("_report")
        or name.startswith("_temp_report")
        or name.endswith(".pdf")
        or name.endswith(".png")
    ):
        return "report"
    return "other"


def get_output_status(filename: str, all_files: list[str]) -> str:
    name = filename.lower()

    if "_temp" in name or name.startswith("_temp_report"):
        return "temp"

    if name.startswith("_report") or name.endswith(".pdf") or name.endswith(".png"):
        return "report"

    normalized = normalize_output_name(filename)
    current_is_v2 = is_v2_file(filename)

    has_v2_pair = any(
        other.lower() != filename.lower()
        and normalize_output_name(other) == normalized
        and is_v2_file(other)
        for other in all_files
    )

    if current_is_v2:
        return "active"

    if has_v2_pair:
        return "legacy"

    if filename.lower() == "temp_download.csv":
        return "system"

    return "active"


def should_skip_output(filename: str, all_files: list[str]) -> bool:
    name = filename.lower()

    if "_temp" in name:
        return True
    if name.startswith("_report"):
        return True
    if name.startswith("_temp_report"):
        return True
    if name == "temp_download.csv":
        return True

    normalized = normalize_output_name(filename)
    current_is_v2 = is_v2_file(filename)

    has_v2_pair = any(
        other.lower() != filename.lower()
        and normalize_output_name(other) == normalized
        and is_v2_file(other)
        for other in all_files
    )

    if not current_is_v2 and has_v2_pair:
        return True

    return False


def get_recent_outputs(minutes=10):
    if not os.path.exists(OUTPUT_DIR):
        return []

    all_files = os.listdir(OUTPUT_DIR)
    now_ts = datetime.now(timezone.utc).timestamp()
    recent = []

    for name in all_files:
        path = os.path.join(OUTPUT_DIR, name)

        if not os.path.isfile(path):
            continue

        if should_skip_output(name, all_files):
            continue

        stat = os.stat(path)
        age_seconds = now_ts - stat.st_mtime

        if age_seconds <= minutes * 60:
            recent.append({
                "filename": name,
                "modified_at": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
                "size_bytes": stat.st_size,
            })

    recent.sort(key=lambda x: x["modified_at"], reverse=True)
    return recent


def is_allowed_flood_raster(filename: str) -> bool:
    allowed = {
        "r25.tif", "r50.tif", "r100.tif", "r250.tif",
        "rc25.tif", "rc50.tif", "rc100.tif", "rc250.tif",
        "r25.tiff", "r50.tiff", "r100.tiff", "r250.tiff",
        "rc25.tiff", "rc50.tiff", "rc100.tiff", "rc250.tiff",
    }
    return filename.lower() in allowed


def is_allowed_drought_raster(filename: str) -> bool:
    allowed = {
        "mme_rp25.tif", "mme_rp50.tif", "mme_rp100.tif", "mme_rp250.tif",
        "gpm_rp25.tif", "gpm_rp50.tif", "gpm_rp100.tif", "gpm_rp250.tif",
        "mme_rp25.tiff", "mme_rp50.tiff", "mme_rp100.tiff", "mme_rp250.tiff",
        "gpm_rp25.tiff", "gpm_rp50.tiff", "gpm_rp100.tiff", "gpm_rp250.tiff",
    }
    return filename.lower() in allowed
