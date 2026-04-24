import sys
import os

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPTS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.scripts.config.paths import DATA_DIR
from backend.scripts.config.analysis_registry import flood_pipeline

ZONAL_PATH = os.path.join(DATA_DIR, "output", "zonal", "flood_stats.geojson")

if __name__ == "__main__":
    if not os.path.exists(ZONAL_PATH):
        print(f"[ERROR] Zonal flood tidak ditemukan: {ZONAL_PATH}", file=sys.stderr)
        print("[ERROR] Jalankan run_zonal.py terlebih dahulu.", file=sys.stderr)
        sys.exit(1)

    try:
        output_path = flood_pipeline(ZONAL_PATH)
        print(f"[OK] Flood analysis selesai: {output_path}")
        sys.exit(0)
    except Exception as e:
        import traceback
        print(f"[ERROR] Flood analysis gagal: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
