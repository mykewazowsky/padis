"""
PADIS Pipeline CLI — entrypoint utama untuk menjalankan pipeline secara lokal/Docker.

Penggunaan:
  python scripts/main.py --mode full --hazard flood --operator mitra_bandung
  python scripts/main.py --mode analysis --hazard drought
  python scripts/main.py --mode web
  python scripts/main.py --mode preprocess
"""

import sys
import os
import argparse
import time
import json

# Pastikan project root ada di sys.path agar import 'backend.*' berjalan
# dari direktori mana pun (backend/, root, atau Docker workdir)
_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPTS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.scripts.pipeline.orchestrator import run_padis_pipeline
from backend.scripts.config.settings import DEBUG, VERBOSE


VALID_HAZARDS = {"flood", "drought", "multi"}
VALID_MODES   = {"full", "preprocess", "analysis", "web"}


# =============================================================================
# ARGUMENT PARSING
# =============================================================================

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="padis-pipeline",
        description="PADIS Pipeline CLI — analisis risiko kerugian padi",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Mode x Hazard -- step yang dijalankan:
  full + flood/drought  : preprocess, zonal, analysis, etl
  full + multi          : analysis (flood+drought+multi), etl
  preprocess            : preprocess saja (hazard diabaikan)
  analysis + flood      : zonal, analysis(flood)
  analysis + drought    : zonal, analysis(drought)
  analysis + multi      : analysis(flood+drought+multi)  [baca dari disk]
  web                   : etl saja (hazard diabaikan)

Contoh:
  python scripts/main.py --mode full --hazard flood --operator mitra_bandung
  python scripts/main.py --mode analysis --hazard drought
  python scripts/main.py --mode web
        """,
    )
    parser.add_argument(
        "--mode",
        choices=sorted(VALID_MODES),
        default="full",
        help="Mode pipeline: full | preprocess | analysis | web  (default: full)",
    )
    parser.add_argument(
        "--hazard",
        choices=sorted(VALID_HAZARDS),
        default="multi",
        help="Hazard target: flood | drought | multi  (default: multi)",
    )
    parser.add_argument(
        "--operator",
        default="operator",
        metavar="NAMA",
        help="Nama operator yang menjalankan pipeline  (default: operator)",
    )
    return parser


# =============================================================================
# STEP RESOLUTION
# Menentukan step mana yang dijalankan berdasarkan kombinasi mode × hazard.
# Konsisten dengan PIPELINE_REGISTRY di Flask admin (admin_utils.py).
# =============================================================================

def _resolve_steps(mode: str, hazard: str) -> tuple[bool, bool, bool, bool]:
    """
    Return (run_preprocess, run_zonal, run_analysis, run_etl).

    multi tidak punya raster sendiri — ia membaca output flood+drought dari disk,
    sehingga preprocess dan zonal tidak dijalankan untuk hazard multi.
    """
    if mode == "preprocess":
        return (True, False, False, False)

    if mode == "web":
        return (False, False, False, True)

    if mode == "analysis":
        run_zonal = (hazard != "multi")   # multi membaca dari disk, tidak perlu zonal baru
        return (False, run_zonal, True, False)

    # mode == "full"
    run_preprocess = (hazard != "multi")
    run_zonal      = (hazard != "multi")
    return (run_preprocess, run_zonal, True, True)


# =============================================================================
# OUTPUT SUMMARY
# =============================================================================

def _print_results(results: dict) -> None:
    print("\n=== HASIL PIPELINE ===")
    for stage, value in results.items():
        print(f"\n[{stage.upper()}]")
        if isinstance(value, list):
            for item in value:
                print(f"  - {item.get('hazard', '-')}: {item.get('status', '-')}")
                if VERBOSE and item.get("output"):
                    print(f"    output: {item['output']}")
        elif isinstance(value, dict):
            for k, v in value.items():
                print(f"  {k}: {v}")
        else:
            print(f"  {value}")


# =============================================================================
# ENTRYPOINT
# =============================================================================

def main() -> None:
    # Paksa stdout/stderr ke line-buffered agar print() muncul real-time di console.
    # Ini backup dari flag -u dan PYTHONUNBUFFERED=1 yang di-set oleh Flask subprocess.
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)

    parser = _build_parser()
    args = parser.parse_args()

    run_preprocess, run_zonal, run_analysis, run_etl = _resolve_steps(
        args.mode, args.hazard
    )

    print("=" * 60)
    print("  PADIS PIPELINE")
    print(f"  mode     : {args.mode}")
    print(f"  hazard   : {args.hazard}")
    print(f"  operator : {args.operator}")
    print(f"  steps    : preprocess={run_preprocess}  zonal={run_zonal}"
          f"  analysis={run_analysis}  etl={run_etl}")
    print("=" * 60)

    start = time.time()

    try:
        result = run_padis_pipeline(
            hazard=args.hazard,
            run_preprocess_step=run_preprocess,
            run_zonal_step=run_zonal,
            run_analysis_step=run_analysis,
            run_etl_step=run_etl,
            operator_name=args.operator,
        )

        elapsed = time.time() - start

        if VERBOSE:
            _print_results(result.get("results", {}))

        print(f"\n⏱  Total waktu: {elapsed:.2f} detik")
        print("✅ Pipeline selesai")

        if DEBUG:
            with open("pipeline_result.json", "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, default=str)

        sys.exit(0)

    except Exception as e:
        import traceback
        print(f"\n❌ PIPELINE GAGAL: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
