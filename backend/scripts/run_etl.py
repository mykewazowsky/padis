import sys
import os

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPTS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.scripts.etl.run_all import run as run_etl

if __name__ == "__main__":
    try:
        run_etl()
        print("[OK] ETL selesai — data dimuat ke database")
        sys.exit(0)
    except Exception as e:
        import traceback
        print(f"[ERROR] ETL gagal: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
