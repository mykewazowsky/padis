"""
run_pipeline_external_raster.py

Jalankan zonal + analysis dengan raster dari folder eksternal
(misal E:\\CAPSTONE\\data\\) tanpa memindahkan file ke backend/data.

Cara pakai (dari root project):

  # Step 1 — Flood
  python -m backend.scripts.tools.run_pipeline_external_raster --hazard flood --raster-dir "E:\\CAPSTONE\\data"

  # Step 2 — Drought
  python -m backend.scripts.tools.run_pipeline_external_raster --hazard drought --raster-dir "E:\\CAPSTONE\\data"

  # Step 3 — Multihazard (tidak butuh --raster-dir)
  python -m backend.scripts.tools.run_pipeline_external_raster --hazard multi

  # Step 4 — ETL / Load ke DB
  python -m backend.scripts.tools.run_pipeline_external_raster --hazard etl
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[4]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from backend.scripts.config.settings import DATA_DIR, ZONAL_CHUNK_SIZE
from backend.scripts.config.analysis_registry import flood_pipeline, drought_pipeline, multihazard_pipeline
from backend.scripts.core.zonal_engine import run_zonal
from backend.scripts.core.vector_engine import intersect_sawah_admin
from backend.scripts.utils import log

REGIONS_PATH = str(DATA_DIR / "raw" / "administrasi" / "regions.gpkg")
SAWAH_PATH   = str(DATA_DIR / "raw" / "exposure"     / "sawah_selected.gpkg")
VECTOR_PATH  = str(DATA_DIR / "processed" / "vector" / "sawah_admin_intersection.geojson")
ZONAL_DIR    = str(DATA_DIR / "output" / "zonal")
ANALYSIS_DIR = str(DATA_DIR / "output" / "analysis")

HAZARD_PREFIX = {"flood": "flood_",   "drought": "drought_"}
HAZARD_SUFFIX = {"flood": "_reproj.tif", "drought": "_norm.tif"}


# =============================================================================

def _ensure_vector(rerun: bool = False) -> None:
    if os.path.exists(VECTOR_PATH) and not rerun:
        log.info("VECTOR", f"Sudah ada → {VECTOR_PATH}")
        return
    log.info("VECTOR", "Menjalankan intersection sawah-administrasi (clip baru)...")
    intersect_sawah_admin(
        regions_path=REGIONS_PATH,
        sawah_path=SAWAH_PATH,
        output_path=VECTOR_PATH,
        overwrite=True,
    )


def _run_zonal(hazard: str, raster_dir: str) -> str:
    prefix = HAZARD_PREFIX[hazard]
    suffix = HAZARD_SUFFIX[hazard]
    output = os.path.join(ZONAL_DIR, f"{hazard}_stats.geojson")
    os.makedirs(ZONAL_DIR, exist_ok=True)

    avail = [f for f in os.listdir(raster_dir) if f.startswith(prefix) and f.endswith(suffix)]
    if not avail:
        raise FileNotFoundError(f"Tidak ada raster {prefix}*{suffix} di: {raster_dir}")
    log.info("ZONAL", f"{hazard}: {len(avail)} raster ditemukan")

    run_zonal(
        vector_path=VECTOR_PATH,
        raster_folder=raster_dir,
        raster_prefix=prefix,
        raster_suffix=suffix,
        output_path=output,
        chunk_size=ZONAL_CHUNK_SIZE,
        overwrite=True,
    )
    return output


def _run_analysis(hazard: str) -> str:
    zonal_path = os.path.join(ZONAL_DIR, f"{hazard}_stats.geojson")
    if hazard == "flood":
        return flood_pipeline(zonal_path)
    if hazard == "drought":
        return drought_pipeline(zonal_path)
    if hazard == "multi":
        flood_final   = os.path.join(ANALYSIS_DIR, "kabkota_flood_final.geojson")
        drought_final = os.path.join(ANALYSIS_DIR, "kabkota_drought_final.geojson")
        missing = [p for p in (flood_final, drought_final) if not os.path.exists(p)]
        if missing:
            raise FileNotFoundError(
                "Multihazard butuh flood+drought final yang belum ada:\n" +
                "\n".join(f"  {p}" for p in missing) +
                "\nJalankan --hazard flood lalu --hazard drought terlebih dahulu."
            )
        return multihazard_pipeline("")
    raise ValueError(f"Hazard tidak dikenal: {hazard}")


# =============================================================================

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="run_pipeline_external_raster",
        description="Pipeline PADIS dengan raster dari folder eksternal.",
    )
    parser.add_argument(
        "--hazard", choices=["flood", "drought", "multi", "etl"], default="flood",
        help="flood | drought | multi | etl  (default: flood)",
    )
    parser.add_argument(
        "--raster-dir", default=None,
        metavar="PATH",
        help='Folder raster, mis. "E:\\CAPSTONE\\data". Wajib untuk flood/drought.',
    )
    parser.add_argument("--operator", default="operator")
    parser.add_argument(
        "--rerun-vector", action="store_true",
        help="Paksa re-run intersection sawah meski file sudah ada.",
    )
    args = parser.parse_args(argv)

    t0 = time.time()
    print("=" * 60)
    print("  PADIS — External Raster Runner")
    print(f"  hazard     : {args.hazard}")
    print(f"  raster-dir : {args.raster_dir or '(tidak dipakai)'}")
    print(f"  operator   : {args.operator}")
    print("=" * 60)

    try:
        if args.hazard == "etl":
            log.header("ETL")
            from backend.scripts.etl.run_all import run as etl_run
            etl_run(hazard="multi")

        elif args.hazard == "multi":
            log.header("ANALYSIS — MULTIHAZARD")
            out = _run_analysis("multi")
            log.ok("MULTIHAZARD", f"→ {out}")

        else:
            if not args.raster_dir:
                print("[ERROR] --raster-dir wajib diisi untuk flood/drought", file=sys.stderr)
                return 1

            raster_dir = args.raster_dir.strip('"').strip("'")
            if not os.path.isdir(raster_dir):
                print(f"[ERROR] Folder tidak ditemukan: {raster_dir}", file=sys.stderr)
                return 1

            log.header(f"PIPELINE — {args.hazard.upper()}")

            _ensure_vector(rerun=args.rerun_vector)
            log.info("ZONAL", f"Membaca raster dari: {raster_dir}")
            zonal_out = _run_zonal(args.hazard, raster_dir)
            log.ok("ZONAL", f"→ {zonal_out}")

            log.info("ANALYSIS", f"Menjalankan analysis {args.hazard}...")
            analysis_out = _run_analysis(args.hazard)
            log.ok("ANALYSIS", f"→ {analysis_out}")

        print(f"\n✅ Selesai dalam {time.time() - t0:.1f} detik")
        return 0

    except Exception as exc:
        import traceback
        print(f"\n❌ GAGAL: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
