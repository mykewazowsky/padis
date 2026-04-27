import os

from backend.scripts.core.zonal_engine import run_zonal

from backend.scripts.config.paths import DATA_DIR
from backend.scripts.config.hazard import RASTER_HAZARDS
from backend.scripts.config.settings import ZONAL_CHUNK_SIZE
from backend.scripts.utils import log

# ===============================
# PATHS
# ===============================
VECTOR_PATH = os.path.join(
    DATA_DIR,
    "processed",
    "vector",
    "sawah_admin_intersection.geojson"
)

RASTER_FOLDER = os.path.join(
    DATA_DIR,
    "processed",
    "hazard"
)

OUTPUT_FOLDER = os.path.join(
    DATA_DIR,
    "output",
    "zonal"
)


# ===============================
# PIPELINE
# ===============================
def run_zonal_all(hazard: str = "multi") -> list[dict]:
    log.header("ZONAL PIPELINE")

    if not os.path.exists(VECTOR_PATH):
        raise FileNotFoundError(f"Vector tidak ditemukan: {VECTOR_PATH}")

    if not os.path.exists(RASTER_FOLDER):
        raise FileNotFoundError(f"Folder raster tidak ditemukan: {RASTER_FOLDER}")

    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    if hazard == "multi":
        hazards_to_run = RASTER_HAZARDS
    else:
        hazards_to_run = [h for h in RASTER_HAZARDS if h["name"] == hazard]

    results = []
    total = len(hazards_to_run)

    for i, h in enumerate(hazards_to_run, start=1):
        name = h["name"]

        log.progress(i, total, f"Zonal {name.upper()}")

        output_path = os.path.join(OUTPUT_FOLDER, f"{name}_stats.geojson")

        try:
            result = run_zonal(
                vector_path=VECTOR_PATH,
                raster_folder=RASTER_FOLDER,
                raster_prefix=h["prefix"],
                raster_suffix=h.get("suffix", "_reproj.tif"),
                output_path=output_path,
                chunk_size=ZONAL_CHUNK_SIZE,
                overwrite=True,
            )

            results.append({
                "hazard": name,
                "output": result,
                "status": "success"
            })

        except Exception as e:
            log.error("ZONAL", f"{name} gagal: {e}")
            raise

    log.ok("ZONAL", "Semua zonal selesai")
    return results
