import os
import time

from backend.scripts.pipeline.preprocess_pipeline import run_preprocess
from backend.scripts.pipeline.zonal_pipeline import run_zonal_all, OUTPUT_FOLDER
from backend.scripts.config.analysis_registry import (
    flood_pipeline,
    drought_pipeline,
    multihazard_pipeline,
)
from backend.scripts.config.hazard import RASTER_HAZARDS
from backend.scripts.utils.run_manager import PipelineRunManager


# =============================================================================
# HELPERS
# =============================================================================

def _load_zonal_results_from_disk() -> list[dict]:
    """
    Rekonstruksi zonal_results dari file yang sudah ada di disk.
    Dipakai saat run_zonal_step=False tapi run_analysis_step=True
    (legacy path — dipertahankan untuk backward compat).
    """
    results = []
    for hazard in RASTER_HAZARDS:
        name = hazard["name"]
        output_path = os.path.join(OUTPUT_FOLDER, f"{name}_stats.geojson")
        if not os.path.exists(output_path):
            raise FileNotFoundError(
                f"Zonal output untuk '{name}' tidak ditemukan: {output_path}\n"
                f"Jalankan dengan run_zonal_step=True terlebih dahulu."
            )
        results.append({
            "hazard": name,
            "output": output_path,
            "status": "loaded_from_disk",
        })
        print(f"  [LOAD] {name}: {output_path}")
    return results


def _get_zonal_path(name: str, zonal_results: list[dict]) -> str:
    """
    Ambil path zonal stats untuk hazard tertentu.
    Cari dulu di zonal_results (dari step zonal yang baru saja jalan),
    jika tidak ada fallback ke disk.
    """
    for item in zonal_results:
        if item["hazard"] == name:
            return item["output"]

    # fallback ke disk
    path = os.path.join(OUTPUT_FOLDER, f"{name}_stats.geojson")
    if os.path.exists(path):
        return path

    raise FileNotFoundError(
        f"Zonal output '{name}' tidak ditemukan di memory maupun disk: {path}\n"
        f"Jalankan zonal step terlebih dahulu."
    )


def _run_analysis_for_hazard(hazard: str, zonal_results: list[dict]) -> list[dict]:
    """
    Jalankan analysis step sesuai hazard yang dipilih.

    - "flood"   : flood_pipeline saja
    - "drought" : drought_pipeline saja
    - "multi"   : flood -> drought -> multihazard  (membaca zonal dari disk jika perlu)

    Berbeda dari run_analysis() di analysis_pipeline.py yang selalu mencoba
    semua hazard dan bisa gagal saat single-hazard run.
    """
    results = []

    if hazard in ("flood", "multi"):
        print("\n[ANALYSIS] FLOOD")
        zonal_path = _get_zonal_path("flood", zonal_results)
        output_path = flood_pipeline(zonal_path)
        results.append({"hazard": "flood", "output": output_path, "status": "success"})

    if hazard in ("drought", "multi"):
        print("\n[ANALYSIS] DROUGHT")
        zonal_path = _get_zonal_path("drought", zonal_results)
        output_path = drought_pipeline(zonal_path)
        results.append({"hazard": "drought", "output": output_path, "status": "success"})

    if hazard == "multi":
        print("\n[ANALYSIS] MULTIHAZARD")
        output_path = multihazard_pipeline("")
        results.append({"hazard": "multihazard", "output": output_path, "status": "success"})

    return results


# =============================================================================
# MAIN ORCHESTRATOR
# =============================================================================

def run_padis_pipeline(
    run_preprocess_step: bool = True,
    run_zonal_step: bool = True,
    run_analysis_step: bool = True,
    hazard: str = "multi",
    run_etl_step: bool = False,
    operator_name: str = "operator",
) -> dict:
    """
    Jalankan PADIS pipeline sesuai kombinasi step dan hazard.

    Parameter:
        run_preprocess_step : jalankan raster reproject + vector intersection
        run_zonal_step      : jalankan zonal statistics
        run_analysis_step   : jalankan risk analysis (sesuai hazard)
        hazard              : "flood" | "drought" | "multi"  (default: "multi")
        run_etl_step        : push hasil ke Supabase via ETL
        operator_name       : nama operator untuk logging

    Backward compatible: panggilan lama run_padis_pipeline() tanpa args masih berfungsi
    (hazard="multi", tidak ada etl step).
    """
    print(f"PADIS PIPELINE  hazard={hazard}  operator={operator_name}")

    start_total = time.time()
    results = {}
    zonal_results: list[dict] = []

    # =========================================================================
    # RUN TRACKING
    # =========================================================================
    manager = PipelineRunManager(
        operator_name=operator_name,
        hazard=hazard,
        source="local",
    )
    manager.start()

    try:
        # =====================================================================
        # STEP 1 — PREPROCESS
        # =====================================================================
        if run_preprocess_step:
            print("\n[1] PREPROCESS")
            manager.update("preprocess", 5, "Preprocess dimulai")
            try:
                preprocess_result = run_preprocess()
                results["preprocess"] = preprocess_result
                manager.update("preprocess", 25, "Preprocess selesai")
            except Exception as e:
                print(f"Preprocess gagal: {e}")
                raise

        # =====================================================================
        # STEP 2 — ZONAL
        # =====================================================================
        if run_zonal_step:
            print("\n[2] ZONAL")
            manager.update("zonal", 30, "Zonal statistics dimulai")
            try:
                zonal_results = run_zonal_all()
                results["zonal"] = zonal_results
                manager.update("zonal", 50, "Zonal statistics selesai")
            except Exception as e:
                print(f"Zonal gagal: {e}")
                raise

        # =====================================================================
        # STEP 3 — ANALYSIS
        # Gunakan _run_analysis_for_hazard() agar single-hazard run tidak mencoba
        # menjalankan multihazard pass yang tidak relevan (dan gagal).
        # =====================================================================
        if run_analysis_step:
            print("\n[3] ANALYSIS")
            manager.update("analysis", 55, f"Analysis dimulai ({hazard})")
            try:
                analysis_results = _run_analysis_for_hazard(hazard, zonal_results)
                results["analysis"] = analysis_results
                manager.update("analysis", 75, "Analysis selesai")
            except Exception as e:
                print(f"Analysis gagal: {e}")
                raise

        # =====================================================================
        # STEP 4 — ETL  (push ke Supabase)
        # Import dilakukan di dalam blok agar ETL tidak di-load saat step ini di-skip.
        # Dengan begitu, environment tanpa DATABASE_URL tetap bisa menjalankan
        # preprocess/zonal/analysis tanpa error import.
        # =====================================================================
        if run_etl_step:
            print("\n[4] ETL — push ke database")
            manager.update("etl", 80, "ETL dimulai")
            try:
                from backend.scripts.etl.run_all import run as _run_etl
                _run_etl()
                results["etl"] = "success"
                manager.update("etl", 95, "ETL selesai")
            except Exception as e:
                print(f"ETL gagal: {e}")
                raise

        # =====================================================================
        # SELESAI
        # =====================================================================
        elapsed = time.time() - start_total
        print(f"\nPIPELINE SELESAI ({elapsed:.2f} detik)")
        manager.finish(success=True, message="Pipeline selesai")

        return {
            "status": "success",
            "hazard": hazard,
            "operator": operator_name,
            "execution_time": elapsed,
            "steps_run": {
                "preprocess": run_preprocess_step,
                "zonal": run_zonal_step,
                "analysis": run_analysis_step,
                "etl": run_etl_step,
            },
            "results": results,
        }

    except Exception as e:
        elapsed = time.time() - start_total
        manager.finish(success=False, message=str(e))
        raise
