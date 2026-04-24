import sys
import os

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPTS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.scripts.config.paths import OUTPUT_ANALYSIS_DIR
from backend.scripts.config.analysis_registry import multihazard_pipeline

FLOOD_PATH = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_flood_final.geojson")
DROUGHT_PATH = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_drought_final.geojson")

if __name__ == "__main__":
    missing = []
    if not os.path.exists(FLOOD_PATH):
        missing.append(f"Flood: {FLOOD_PATH}")
    if not os.path.exists(DROUGHT_PATH):
        missing.append(f"Drought: {DROUGHT_PATH}")

    if missing:
        for m in missing:
            print(f"[ERROR] File tidak ditemukan: {m}", file=sys.stderr)
        print("[ERROR] Jalankan run_analysis_flood.py dan run_analysis_drought.py terlebih dahulu.", file=sys.stderr)
        sys.exit(1)

    try:
        output_path = multihazard_pipeline("")
        print(f"[OK] Multihazard analysis selesai: {output_path}")
        sys.exit(0)
    except Exception as e:
        import traceback
        print(f"[ERROR] Multihazard analysis gagal: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
