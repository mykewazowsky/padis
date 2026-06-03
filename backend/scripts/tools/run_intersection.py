"""run_intersection.py — jalankan ulang intersection dengan metode baru"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.scripts.core.vector_engine import intersect_sawah_admin
from backend.scripts.config.settings import DATA_DIR

REGIONS = str(DATA_DIR / "raw" / "administrasi" / "regions.gpkg")
SAWAH   = str(DATA_DIR / "raw" / "exposure"     / "sawah_selected.gpkg")
OUTPUT  = str(DATA_DIR / "processed" / "vector"  / "sawah_admin_intersection.geojson")

result = intersect_sawah_admin(
    regions_path=REGIONS,
    sawah_path=SAWAH,
    output_path=OUTPUT,
    overwrite=True,
    verbose=True,
)
print(f"\nHasil: {result}")
