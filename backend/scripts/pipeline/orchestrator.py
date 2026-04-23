import os
import time

from backend.scripts.pipeline.preprocess_pipeline import run_preprocess
from backend.scripts.pipeline.zonal_pipeline import run_zonal_all, OUTPUT_FOLDER
from backend.scripts.pipeline.analysis_pipeline import run_analysis
from backend.scripts.config.hazard import RASTER_HAZARDS


# ===============================
# HELPER: load zonal results dari disk
# FIX #7: orchestrator bisa jalankan analysis tanpa re-run zonal
# ===============================
def _load_zonal_results_from_disk() -> list[dict]:
    """
    Rekonstruksi zonal_results dari file yang sudah ada di disk.
    Dipakai saat run_zonal_step=False tapi run_analysis_step=True.
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


# ===============================
# MAIN ORCHESTRATOR
# ===============================
def run_padis_pipeline(
    run_preprocess_step: bool = True,
    run_zonal_step: bool = True,
    run_analysis_step: bool = True,
) -> dict:

    print("🚀 PADIS FULL PIPELINE")

    start_total = time.time()
    results = {}
    zonal_results = None

    steps = [
        ("preprocess", run_preprocess_step),
        ("zonal", run_zonal_step),
        ("analysis", run_analysis_step),
    ]
    total_steps = sum(1 for _, enabled in steps if enabled)
    current_step = 0

    # ===============================
    # PREPROCESS
    # ===============================
    if run_preprocess_step:
        current_step += 1
        print(f"\n[{current_step}/{total_steps}] PREPROCESS")

        try:
            preprocess_result = run_preprocess()
            results["preprocess"] = preprocess_result
        except Exception as e:
            print(f"❌ Preprocess gagal: {e}")
            raise

    # ===============================
    # ZONAL
    # ===============================
    if run_zonal_step:
        current_step += 1
        print(f"\n[{current_step}/{total_steps}] ZONAL")

        try:
            zonal_results = run_zonal_all()
            results["zonal"] = zonal_results
        except Exception as e:
            print(f"❌ Zonal gagal: {e}")
            raise

    # ===============================
    # ANALYSIS
    # FIX #7: jika zonal di-skip, load dari disk
    # ===============================
    if run_analysis_step:
        current_step += 1
        print(f"\n[{current_step}/{total_steps}] ANALYSIS")

        if zonal_results is None:
            print("  [INFO] Zonal step dilewati — memuat hasil dari disk...")
            zonal_results = _load_zonal_results_from_disk()

        try:
            analysis_results = run_analysis(zonal_results)
            results["analysis"] = analysis_results
        except Exception as e:
            print(f"❌ Analysis gagal: {e}")
            raise

    # ===============================
    # FINAL
    # ===============================
    elapsed = time.time() - start_total
    print(f"\n🎉 PIPELINE SELESAI ({elapsed:.2f} detik)")

    return {
        "status": "success",
        "execution_time": elapsed,
        "steps_run": {
            "preprocess": run_preprocess_step,
            "zonal": run_zonal_step,
            "analysis": run_analysis_step,
        },
        "results": results,
    }
