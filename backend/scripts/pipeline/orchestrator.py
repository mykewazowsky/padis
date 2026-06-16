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
from backend.scripts.metadata.run_metadata import RunMetadataRecorder, sync_metadata_to_db
from backend.scripts.utils.run_manager import PipelineRunManager
from backend.scripts.utils import log


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
        log.info("LOAD", f"{name}: {output_path}")
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
    Jalankan analysis step sesuai hazard yang dipilih (single-hazard execution).

    - "flood"             : flood_pipeline saja
    - "drought"           : drought_pipeline saja
    - "multi"/"multihazard": multihazard_pipeline saja
                             (membutuhkan kabkota_flood_final.geojson dan
                              kabkota_drought_final.geojson sudah ada di disk;
                              flood/drought TIDAK dijalankan ulang di sini)

    Berbeda dari run_analysis() di analysis_pipeline.py yang selalu mencoba
    semua hazard dan bisa gagal saat single-hazard run.
    """
    results = []

    if hazard == "flood":
        zonal_path = _get_zonal_path("flood", zonal_results)
        output_path = flood_pipeline(zonal_path)
        results.append({"hazard": "flood", "output": output_path, "status": "success"})
        return results

    if hazard == "drought":
        zonal_path = _get_zonal_path("drought", zonal_results)
        output_path = drought_pipeline(zonal_path)
        results.append({"hazard": "drought", "output": output_path, "status": "success"})
        return results

    if hazard in ("multi", "multihazard"):
        # Validasi eksplisit: multihazard butuh hasil flood & drought final.
        # Jangan jalankan ulang flood/drought — operator harus melakukannya
        # secara terpisah (mode full+flood, full+drought) sebelum ini.
        from backend.scripts.config.paths import OUTPUT_ANALYSIS_DIR
        flood_final   = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_flood_final.geojson")
        drought_final = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_drought_final.geojson")
        missing = [p for p in (flood_final, drought_final) if not os.path.exists(p)]
        if missing:
            raise FileNotFoundError(
                "Multihazard membutuhkan file final hazard tunggal yang belum tersedia:\n"
                + "\n".join(f"  - {p}" for p in missing)
                + "\nJalankan terlebih dahulu 'full --hazard flood' dan 'full --hazard drought'."
            )

        output_path = multihazard_pipeline("")
        results.append({"hazard": "multihazard", "output": output_path, "status": "success"})
        return results

    raise ValueError(f"Hazard tidak dikenal: '{hazard}'")


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
    log.info("PIPELINE", f"hazard={hazard}  operator={operator_name}")

    start_total = time.time()
    results = {}
    zonal_results: list[dict] = []
    steps_run = {
        "preprocess": run_preprocess_step,
        "zonal": run_zonal_step,
        "analysis": run_analysis_step,
        "etl": run_etl_step,
    }

    manager = PipelineRunManager(
        operator_name=operator_name,
        hazard=hazard,
        source="local",
    )
    manager.start()
    metadata = RunMetadataRecorder(
        run_id=manager.run_id,
        hazard=hazard,
        operator_name=operator_name,
        source="local",
    )
    metadata.start(steps_run)

    try:
        if run_preprocess_step:
            manager.update("preprocess", 5, "Preprocess dimulai")
            metadata.record_stage("preprocess", "started", {"message": "Preprocess dimulai"})
            try:
                preprocess_result = run_preprocess(hazard)
                results["preprocess"] = preprocess_result
                metadata.record_stage("preprocess", "success", preprocess_result)
                metadata.refresh_outputs(include_processed=True)
                manager.update("preprocess", 25, "Preprocess selesai")
            except Exception as e:
                metadata.record_stage("preprocess", "failed", {"error": str(e)})
                log.error("PREPROCESS", f"Gagal: {e}")
                raise

        if run_zonal_step:
            manager.update("zonal", 30, "Zonal statistics dimulai")
            metadata.record_stage("zonal", "started", {"message": "Zonal statistics dimulai"})
            try:
                zonal_results = run_zonal_all(hazard)
                results["zonal"] = zonal_results
                metadata.record_stage("zonal", "success", zonal_results)
                metadata.refresh_outputs(include_processed=True)
                manager.update("zonal", 50, "Zonal statistics selesai")
            except Exception as e:
                metadata.record_stage("zonal", "failed", {"error": str(e)})
                log.error("ZONAL", f"Gagal: {e}")
                raise

        if run_analysis_step:
            manager.update("analysis", 55, f"Analysis dimulai ({hazard})")
            metadata.record_stage("analysis", "started", {"hazard": hazard})
            try:
                analysis_results = _run_analysis_for_hazard(hazard, zonal_results)
                results["analysis"] = analysis_results
                metadata.record_stage("analysis", "success", analysis_results)
                metadata.refresh_outputs(include_processed=True)
                manager.update("analysis", 75, "Analysis selesai")
            except Exception as e:
                metadata.record_stage("analysis", "failed", {"error": str(e)})
                log.error("ANALYSIS", f"Gagal: {e}")
                raise

        if run_etl_step:
            manager.update("etl", 80, "ETL dimulai")
            metadata.record_stage("etl", "started", {"message": "ETL dimulai"})
            try:
                from backend.scripts.etl.run_all import run as _run_etl
                _run_etl(hazard, run_id=manager.run_id)
                results["etl"] = "success"
                metadata.record_stage("etl", "success", {"run_id": manager.run_id})
                metadata.refresh_outputs(include_processed=True)
                manager.update("etl", 95, "ETL selesai")
            except Exception as e:
                metadata.record_stage("etl", "failed", {"error": str(e)})
                log.error("ETL", f"Gagal: {e}")
                raise

        elapsed = time.time() - start_total
        log.ok("PIPELINE", f"Selesai ({elapsed:.2f} detik)")
        metadata.finish("success", "Pipeline selesai", elapsed)
        sync_metadata_to_db(manager.run_id, metadata.path)
        manager.finish(success=True, message="Pipeline selesai")

        return {
            "status": "success",
            "hazard": hazard,
            "operator": operator_name,
            "execution_time": elapsed,
            "steps_run": steps_run,
            "metadata_path": metadata.path,
            "results": results,
        }

    except Exception as e:
        elapsed = time.time() - start_total
        metadata.record_stage("pipeline", "failed", {"error": str(e)})
        metadata.refresh_outputs(include_processed=True)
        metadata.finish("failed", str(e), elapsed)
        sync_metadata_to_db(manager.run_id, metadata.path)
        manager.finish(success=False, message=str(e))
        raise
