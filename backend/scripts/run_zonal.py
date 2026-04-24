import sys
import os

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPTS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.scripts.pipeline.zonal_pipeline import run_zonal_all

if __name__ == "__main__":
    try:
        result = run_zonal_all()
        print(f"[OK] Zonal selesai: {len(result)} hazard diproses")
        sys.exit(0)
    except Exception as e:
        import traceback
        print(f"[ERROR] Zonal gagal: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
