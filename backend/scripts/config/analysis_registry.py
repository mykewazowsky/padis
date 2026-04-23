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

EXPOSURE_PATH = os.path.join(
    DATA_DIR, "raw", "exposure", "totalproduksipadi.csv"
)


# ===============================
# LOAD PRODUKSI
# ===============================
def _load_prod() -> pd.DataFrame:
    if not os.path.exists(EXPOSURE_PATH):
        raise FileNotFoundError(f"File produksi tidak ditemukan: {EXPOSURE_PATH}")
    return pd.read_csv(EXPOSURE_PATH)


# ===============================
# FLOOD PIPELINE (FIXED)
# ===============================
def flood_pipeline(zonal_path: str) -> str:
    print("\n=== FLOOD ANALYSIS ===")

    os.makedirs(OUTPUT_ANALYSIS_DIR, exist_ok=True)

    gdf = gpd.read_file(zonal_path)

    # 1. LOP (masih sawah)
    print("  [1/4] LOP")
    gdf = compute_lop_flood(gdf)

    # 2. LOSS (langsung ke kab/kota)
    print("  [2/4] Loss (kab/kota)")
    prod = _load_prod()
    gdf = compute_loss_flood_kab(gdf, prod, gabah=GABAH_KERING_PANEN)

    # 3. AAL (sudah di kab)
    print("  [3/4] AAL")
    gdf = compute_aal_flood(gdf)

    # 4. AGGREGATE (opsional, hanya merapikan kolom)
    print("  [4/4] Aggregate")
    gdf = aggregate_flood(gdf)

    output_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_flood_final.geojson")
    gdf.to_file(output_path, driver="GeoJSON")

    print(f"  ✅ Flood → {output_path}")
    return output_path


# ===============================
# DROUGHT PIPELINE (FIXED)
# ===============================
def drought_pipeline(zonal_path: str) -> str:
    print("\n=== DROUGHT ANALYSIS ===")

    os.makedirs(OUTPUT_ANALYSIS_DIR, exist_ok=True)

    gdf = gpd.read_file(zonal_path)

    # 1. DI
    print("  [1/4] DI")
    gdf = compute_di_drought(gdf)

    # 2. LOP
    print("  [2/4] LOP")
    gdf = compute_lop_drought(gdf)

    # 3. LOSS (kab/kota)
    print("  [3/4] Loss (kab/kota)")
    prod = _load_prod()
    gdf = compute_loss_drought_kab(gdf, prod, gabah=GABAH_KERING_PANEN)

    # 4. AAL
    print("  [4/4] AAL")
    gdf = compute_aal_drought(gdf)

    # 5. AGGREGATE
    print("  [5/4] Aggregate")
    gdf = aggregate_drought(gdf)

    output_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_drought_final.geojson")
    gdf.to_file(output_path, driver="GeoJSON")

    print(f"  ✅ Drought → {output_path}")
    return output_path


# ===============================
# MULTIHAZARD PIPELINE (TIDAK DIUBAH)
# ===============================
def multihazard_pipeline(zonal_path: str) -> str:
    print("\n=== MULTIHAZARD ANALYSIS ===")

    flood_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_flood_final.geojson")
    drought_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_drought_final.geojson")

    for p, label in [(flood_path, "flood_final"), (drought_path, "drought_final")]:
        if not os.path.exists(p):
            raise FileNotFoundError(
                f"File {label} tidak ditemukan: {p}\n"
                f"Pastikan flood dan drought pipeline sudah selesai."
            )

    print("  [1/4] Merge hazards")
    flood = gpd.read_file(flood_path)
    drought = gpd.read_file(drought_path)
    gdf = merge_hazards(flood, drought)

    print("  [2/4] Compute loss")
    gdf = compute_multihazard_loss(gdf, gabah=GABAH_KERING_PANEN)

    print("  [3/4] Compute AAL")
    gdf = compute_aal_multihazard(gdf)

    print("  [4/4] Aggregate")
    gdf = aggregate_multihazard(gdf)

    output_path = os.path.join(OUTPUT_ANALYSIS_DIR, "kabkota_multihazard_final.geojson")
    gdf.to_file(output_path, driver="GeoJSON")

    print(f"  ✅ Multihazard → {output_path}")
    return output_path


# ===============================
# REGISTRY
# ===============================
ANALYSIS_REGISTRY = {
    "flood": flood_pipeline,
    "drought": drought_pipeline,
    "multihazard": multihazard_pipeline,
}   
