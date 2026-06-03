import os
import geopandas as gpd
import pandas as pd

# ===============================
# FLOOD
# ===============================
from backend.scripts.analysis.flood.lop import compute_lop_flood
from backend.scripts.analysis.flood.loss_kabkota import compute_loss_flood_kab
from backend.scripts.analysis.flood.aal import compute_aal_flood
from backend.scripts.analysis.flood.aggregate import aggregate_flood

# ===============================
# DROUGHT
# ===============================
from backend.scripts.analysis.drought.di import compute_di_drought
from backend.scripts.analysis.drought.lop import compute_lop_drought
from backend.scripts.analysis.drought.loss_kabkota import compute_loss_drought_kab
from backend.scripts.analysis.drought.aal import compute_aal_drought
from backend.scripts.analysis.drought.aggregate import aggregate_drought

# ===============================
# MULTIHAZARD
# ===============================
from backend.scripts.analysis.multihazard.multihazard import (
    merge_hazards,
    compute_multihazard_loss
)
from backend.scripts.analysis.multihazard.aal import compute_aal_multihazard
from backend.scripts.analysis.multihazard.aggregate import aggregate_multihazard

# ===============================
# CONFIG
# ===============================
from backend.scripts.config.paths import DATA_DIR, OUTPUT_ANALYSIS_DIR
from backend.scripts.config.settings import GABAH_KERING_PANEN
from backend.scripts.utils import log
from backend.scripts.etl.load_production import format_id_kabkota

EXPOSURE_PATH = os.path.join(
    DATA_DIR, "raw", "exposure", "totalproduksipadi.csv"
)


# ===============================
# LOAD PRODUKSI
# ===============================
def _load_prod() -> pd.DataFrame:
    if not os.path.exists(EXPOSURE_PATH):
        raise FileNotFoundError(f"File produksi tidak ditemukan: {EXPOSURE_PATH}")
    # dtype=str wajib agar "33.20" tidak di-truncate pandas menjadi "33.2".
    # format_id_kabkota menormalisasi ke format XX.XX sehingga join ke GeoDataFrame
    # yang berasal dari Supabase (sudah ternormalisasi) maupun dari file lokal
    # (mungkin belum ternormalisasi) selalu konsisten.
    df = pd.read_csv(EXPOSURE_PATH, dtype={"id_kabkota": str})
    df["id_kabkota"] = df["id_kabkota"].apply(format_id_kabkota)
    return df


# ===============================
# FLOOD PIPELINE (FIXED)
# ===============================
def flood_pipeline(zonal_path: str) -> str:
    """
    Flood analysis chain:
    zonal mean depth -> flood LOP -> district loss -> AAL -> final layer.
    """
    log.header("FLOOD ANALYSIS")

    os.makedirs(OUTPUT_ANALYSIS_DIR, exist_ok=True)

    gdf = gpd.read_file(zonal_path)

    log.progress(1, 4, "LOP")
    gdf = compute_lop_flood(gdf)

    log.progress(2, 4, "Loss (kab/kota)")
    prod = _load_prod()
    gdf = compute_loss_flood_kab(gdf, prod, gabah=GABAH_KERING_PANEN)

    log.progress(3, 4, "AAL")
    gdf = compute_aal_flood(gdf)

    log.progress(4, 4, "Aggregate")
    gdf = aggregate_flood(gdf)

    output_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_flood_final.geojson")
    gdf.to_file(output_path, driver="GeoJSON")

    log.ok("FLOOD", f"Selesai → {output_path}")
    return output_path


# ===============================
# DROUGHT PIPELINE (FIXED)
# ===============================
def drought_pipeline(zonal_path: str) -> str:
    """
    Drought analysis chain:
    zonal drought index -> drought intensity -> LOP -> district loss -> AAL.
    """
    log.header("DROUGHT ANALYSIS")

    os.makedirs(OUTPUT_ANALYSIS_DIR, exist_ok=True)

    gdf = gpd.read_file(zonal_path)

    log.progress(1, 5, "DI")
    gdf = compute_di_drought(gdf)

    log.progress(2, 5, "LOP")
    gdf = compute_lop_drought(gdf)

    log.progress(3, 5, "Loss (kab/kota)")
    prod = _load_prod()
    gdf = compute_loss_drought_kab(gdf, prod, gabah=GABAH_KERING_PANEN)

    log.progress(4, 5, "AAL")
    gdf = compute_aal_drought(gdf)

    log.progress(5, 5, "Aggregate")
    gdf = aggregate_drought(gdf)

    output_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_drought_final.geojson")
    gdf.to_file(output_path, driver="GeoJSON")

    log.ok("DROUGHT", f"Selesai → {output_path}")
    return output_path


# ===============================
# MULTIHAZARD PIPELINE (TIDAK DIUBAH)
# ===============================
def multihazard_pipeline(zonal_path: str) -> str:
    """
    Multi-hazard analysis uses completed flood and drought final outputs.

    It intentionally does not recompute single-hazard pipelines here, so the
    operator must run flood and drought first and then combine those results.
    """
    log.header("MULTIHAZARD ANALYSIS")

    flood_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_flood_final.geojson")
    drought_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_drought_final.geojson")

    for p, label in [(flood_path, "flood_final"), (drought_path, "drought_final")]:
        if not os.path.exists(p):
            raise FileNotFoundError(
                f"File {label} tidak ditemukan: {p}\n"
                f"Pastikan flood dan drought pipeline sudah selesai."
            )

    # Reject stale inputs: flood and drought must have been produced within
    # _MAX_INPUT_AGE_DIFF_S seconds of each other to avoid mixing runs.
    _MAX_INPUT_AGE_DIFF_S = 3600  # 1 hour
    flood_mtime  = os.path.getmtime(flood_path)
    drought_mtime = os.path.getmtime(drought_path)
    if abs(flood_mtime - drought_mtime) > _MAX_INPUT_AGE_DIFF_S:
        import datetime
        fmt = lambda t: datetime.datetime.fromtimestamp(t).strftime("%Y-%m-%d %H:%M:%S")
        raise ValueError(
            f"Input flood dan drought berasal dari run berbeda "
            f"(flood: {fmt(flood_mtime)}, drought: {fmt(drought_mtime)}, "
            f"selisih {abs(flood_mtime - drought_mtime):.0f}s > {_MAX_INPUT_AGE_DIFF_S}s). "
            f"Jalankan ulang flood dan drought dari run yang sama sebelum multi-hazard."
        )

    log.progress(1, 4, "Merge hazards")
    flood = gpd.read_file(flood_path)
    drought = gpd.read_file(drought_path)
    gdf = merge_hazards(flood, drought)

    log.progress(2, 4, "Compute loss")
    gdf = compute_multihazard_loss(gdf, gabah=GABAH_KERING_PANEN)

    log.progress(3, 4, "Compute AAL")
    gdf = compute_aal_multihazard(gdf)

    log.progress(4, 4, "Aggregate")
    gdf = aggregate_multihazard(gdf)

    output_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_multihazard_final.geojson")
    gdf.to_file(output_path, driver="GeoJSON")

    log.ok("MULTIHAZARD", f"Selesai → {output_path}")
    return output_path


# ===============================
# REGISTRY
# ===============================
ANALYSIS_REGISTRY = {
    # Central dispatch table used by pipeline runners. Adding a hazard requires
    # registering its callable here so orchestration and admin execution agree.
    "flood": flood_pipeline,
    "drought": drought_pipeline,
    "multihazard": multihazard_pipeline,
}   
