import os

from backend.scripts.core.raster_engine import run_reproject_batch, run_normalize_batch
from backend.scripts.core.vector_engine import intersect_sawah_admin

from backend.scripts.config.paths import DATA_DIR
from backend.scripts.config.hazard import HAZARDS
from backend.scripts.utils import log

# ===============================
# PATHS
# ===============================
RAW_HAZARD_FOLDER = os.path.join(DATA_DIR, "raw", "hazard")
PROCESSED_HAZARD_FOLDER = os.path.join(DATA_DIR, "processed", "hazard")
PROCESSED_VECTOR_FOLDER = os.path.join(DATA_DIR, "processed", "vector")

REGIONS_PATH = os.path.join(DATA_DIR, "raw", "administrasi", "regions.gpkg")
SAWAH_PATH = os.path.join(DATA_DIR, "raw", "exposure", "sawah_selected.gpkg")

OUTPUT_VECTOR = os.path.join(
    PROCESSED_VECTOR_FOLDER,
    "sawah_admin_intersection.geojson"
)


# ===============================
# PIPELINE
# ===============================
def run_preprocess(hazard: str = "multi") -> dict:
    log.header("PREPROCESS PADIS")

    os.makedirs(PROCESSED_HAZARD_FOLDER, exist_ok=True)
    os.makedirs(PROCESSED_VECTOR_FOLDER, exist_ok=True)

    results = {}

    for h in HAZARDS:
        name = h["name"]

        if h.get("derived", False):
            log.info(name.upper(), "Dilewati (derived)")
            results[name] = "skipped"
            continue

        if hazard != "multi" and name != hazard:
            log.info(name.upper(), f"Dilewati (hazard={hazard})")
            results[name] = "skipped"
            continue

        log.info(name.upper(), "Reproject...")

        try:
            run_reproject_batch(
                input_folder=RAW_HAZARD_FOLDER,
                output_folder=PROCESSED_HAZARD_FOLDER,
                prefix=h["prefix"]
            )

            if h.get("normalize", False):
                log.info(name.upper(), "Normalisasi...")
                run_normalize_batch(
                    input_folder=PROCESSED_HAZARD_FOLDER,
                    output_folder=PROCESSED_HAZARD_FOLDER,
                    prefix=h["prefix"]
                )

            results[name] = "success"

        except Exception as e:
            log.error("PREPROCESS", f"{name} gagal: {e}")
            raise

    log.info("VEKTOR", "Interseksi sawah-administrasi...")
    intersect_sawah_admin(
        regions_path=REGIONS_PATH,
        sawah_path=SAWAH_PATH,
        output_path=OUTPUT_VECTOR
    )
    results["vector"] = OUTPUT_VECTOR

    log.ok("PREPROCESS", "Selesai")
    return results
