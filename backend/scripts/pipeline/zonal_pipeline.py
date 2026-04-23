import os

from scripts.core.zonal_engine import run_zonal

from scripts.config.paths import DATA_DIR
from scripts.config.hazard import RASTER_HAZARDS
from scripts.config.settings import ZONAL_CHUNK_SIZE

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
def run_zonal_all() -> list[dict]:
    print("=== ZONAL PIPELINE ===")

    if not os.path.exists(VECTOR_PATH):
        raise FileNotFoundError(f"Vector tidak ditemukan: {VECTOR_PATH}")

    if not os.path.exists(RASTER_FOLDER):
        raise FileNotFoundError(f"Folder raster tidak ditemukan: {RASTER_FOLDER}")

    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    results = []

    for i, hazard in enumerate(RASTER_HAZARDS, start=1):
        name = hazard["name"]

        print(f"\n[{i}/{len(RASTER_HAZARDS)}] ZONAL {name.upper()}")

        output_path = os.path.join(OUTPUT_FOLDER, f"{name}_stats.geojson")

        try:
            result = run_zonal(
                vector_path=VECTOR_PATH,
                raster_folder=RASTER_FOLDER,
                raster_prefix=hazard["prefix"],
                raster_suffix=hazard.get("suffix", "_reproj.tif"),
                output_path=output_path,
                chunk_size=ZONAL_CHUNK_SIZE,
                overwrite=True  # 🔥 penting biar rerun tidak skip
            )

            results.append({
                "hazard": name,
                "output": result,
                "status": "success"
            })

        except Exception as e:
            print(f"❌ Zonal {name} gagal: {e}")
            raise

    print("\n✅ Semua zonal selesai")

    return results
