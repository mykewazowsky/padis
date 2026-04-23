import os

from scripts.core.raster_engine import run_reproject_batch, run_normalize_batch
from scripts.core.vector_engine import intersect_sawah_admin

from scripts.config.paths import DATA_DIR
from scripts.config.hazard import HAZARDS

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
def run_preprocess() -> dict:
    print("=== PREPROCESS PADIS ===")

    os.makedirs(PROCESSED_HAZARD_FOLDER, exist_ok=True)
    os.makedirs(PROCESSED_VECTOR_FOLDER, exist_ok=True)

    results = {}

    # ===============================
    # RASTER PROCESSING
    # ===============================
    for hazard in HAZARDS:
        name = hazard["name"]

        if hazard.get("derived", False):
            print(f"\n--- {name.upper()} SKIPPED (DERIVED) ---")
            results[name] = "skipped"
            continue

        print(f"\n--- {name.upper()} REPROJECT ---")

        try:
            run_reproject_batch(
                input_folder=RAW_HAZARD_FOLDER,
                output_folder=PROCESSED_HAZARD_FOLDER,
                prefix=hazard["prefix"]
            )

            # optional step (only if defined)
            if hazard.get("normalize", False):
                print(f"\n--- {name.upper()} NORMALIZATION ---")

                run_normalize_batch(
                    input_folder=PROCESSED_HAZARD_FOLDER,
                    output_folder=PROCESSED_HAZARD_FOLDER,
                    prefix=hazard["prefix"]
                )

            results[name] = "success"

        except Exception as e:
            print(f"❌ Preprocess {name} gagal: {e}")
            raise

    # ===============================
    # VECTOR PROCESSING
    # ===============================
    print("\n--- VECTOR INTERSECTION ---")

    intersect_sawah_admin(
        regions_path=REGIONS_PATH,
        sawah_path=SAWAH_PATH,
        output_path=OUTPUT_VECTOR
    )

    results["vector"] = OUTPUT_VECTOR

    print("\n✅ Preprocess selesai")

    return results
