"""
run_pipeline_external_raster.py

Jalankan pipeline lengkap (zonal → analysis → ETL) menggunakan raster
dari folder eksternal (mis. E:\\CAPSTONE\\data\\) tanpa menyentuh
folder processed/hazard yang ada dan tanpa perlu copy file.

Usage (dari backend/):
    python -m scripts.tools.run_pipeline_external_raster
    python -m scripts.tools.run_pipeline_external_raster --hazard flood
    python -m scripts.tools.run_pipeline_external_raster --skip-etl
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.scripts.core.zonal_engine import run_zonal
from backend.scripts.config.hazard import RASTER_HAZARDS
from backend.scripts.config.settings import DATA_DIR, ZONAL_CHUNK_SIZE
from backend.scripts.config.analysis_registry import (
    flood_pipeline,
    drought_pipeline,
    multihazard_pipeline,
)
from backend.scripts.utils import log

# ── Konfigurasi folder raster eksternal ──────────────────────────────────────
EXTERNAL_RASTER_DIR = r"E:\CAPSTONE\data"

VECTOR_PATH  = str(DATA_DIR / "processed" / "vector"  / "sawah_admin_intersection.geojson")
OUTPUT_ZONAL = str(DATA_DIR / "output"    / "zonal")
OUTPUT_ANALYSIS = str(DATA_DIR / "output" / "analysis")


def run_zonal_step(hazard: str) -> dict:
    """Jalankan zonal statistics dari folder raster eksternal."""
    log.header(f"ZONAL — {hazard.upper()} (raster dari {EXTERNAL_RASTER_DIR})")

    os.makedirs(OUTPUT_ZONAL, exist_ok=True)

    hazards = [h for h in RASTER_HAZARDS if hazard in ("multi", h["name"])]
    results = {}

    for h in hazards:
        name   = h["name"]
        suffix = h.get("suffix", "_reproj.tif")
        prefix = h["prefix"]

        # Pastikan ada raster dengan suffix yang benar di folder eksternal
        avail = [
            f for f in os.listdir(EXTERNAL_RASTER_DIR)
            if f.startswith(prefix) and f.endswith(suffix)
        ]
        if not avail:
            log.warn("ZONAL", f"Tidak ada raster {prefix}*{suffix} di {EXTERNAL_RASTER_DIR}")
            continue

        log.info("ZONAL", f"{name}: {len(avail)} raster ditemukan → {avail}")

        output_path = os.path.join(OUTPUT_ZONAL, f"{name}_stats.geojson")

        run_zonal(
            vector_path=VECTOR_PATH,
            raster_folder=EXTERNAL_RASTER_DIR,
            raster_prefix=prefix,
            raster_suffix=suffix,
            output_path=output_path,
            chunk_size=ZONAL_CHUNK_SIZE,
            overwrite=True,
        )
        results[name] = output_path
        log.ok("ZONAL", f"{name} selesai → {output_path}")

    return results


def run_analysis_step(hazard: str, zonal_results: dict) -> dict:
    """Jalankan analysis pipeline dari hasil zonal."""
    log.header("ANALYSIS")

    os.makedirs(OUTPUT_ANALYSIS, exist_ok=True)
    outputs = {}

    if hazard in ("flood", "multi") and "flood" in zonal_results:
        log.progress(1, 3, "Flood analysis")
        outputs["flood"] = flood_pipeline(zonal_results["flood"])
        log.ok("FLOOD", f"→ {outputs['flood']}")

    if hazard in ("drought", "multi") and "drought" in zonal_results:
        log.progress(2, 3, "Drought analysis")
        outputs["drought"] = drought_pipeline(zonal_results["drought"])
        log.ok("DROUGHT", f"→ {outputs['drought']}")

    if hazard == "multi" and "flood" in outputs and "drought" in outputs:
        log.progress(3, 3, "Multihazard analysis")
        outputs["multihazard"] = multihazard_pipeline("")
        log.ok("MULTIHAZARD", f"→ {outputs['multihazard']}")

    return outputs


def main():
    parser = argparse.ArgumentParser(
        description="Jalankan pipeline dengan raster dari folder eksternal."
    )
    parser.add_argument(
        "--hazard", choices=["flood", "drought", "multi"], default="multi",
        help="Hazard yang dijalankan (default: multi)"
    )
    parser.add_argument(
        "--skip-etl", action="store_true",
        help="Lewati step ETL (hanya zonal + analysis)"
    )
    parser.add_argument(
        "--operator", default="operator",
        help="Nama operator untuk ETL run (default: operator)"
    )
    args = parser.parse_args()

    log.header(f"PIPELINE DENGAN RASTER EKSTERNAL")
    log.info("CONFIG", f"Raster folder : {EXTERNAL_RASTER_DIR}")
    log.info("CONFIG", f"Hazard        : {args.hazard}")
    log.info("CONFIG", f"Skip ETL      : {args.skip_etl}")

    if not os.path.isdir(EXTERNAL_RASTER_DIR):
        log.error("CONFIG", f"Folder raster tidak ditemukan: {EXTERNAL_RASTER_DIR}")
        sys.exit(1)

    if not os.path.exists(VECTOR_PATH):
        log.error("CONFIG", f"Sawah intersection tidak ditemukan: {VECTOR_PATH}")
        sys.exit(1)

    # Step 1: Zonal
    zonal_results = run_zonal_step(args.hazard)
    if not zonal_results:
        log.error("PIPELINE", "Tidak ada hasil zonal — pipeline berhenti.")
        sys.exit(1)

    # Step 2: Analysis
    analysis_results = run_analysis_step(args.hazard, zonal_results)

    # Step 3: ETL (opsional)
    if not args.skip_etl:
        log.header("ETL")
        from backend.scripts.etl.run_all import run as run_etl
        run_etl(hazard=args.hazard)
        log.ok("ETL", "Selesai")

    log.header("PIPELINE SELESAI")
    for k, v in {**zonal_results, **analysis_results}.items():
        log.ok(k.upper(), str(v))


if __name__ == "__main__":
    main()
