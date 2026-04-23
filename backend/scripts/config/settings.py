# ===============================
# GENERAL
# ===============================
DEBUG = True
VERBOSE = True
OVERWRITE = False


# ===============================
# ZONAL SETTINGS
# ===============================
ZONAL_CHUNK_SIZE = 25
ZONAL_STATS = ["mean"]
ZONAL_ALL_TOUCHED = False


# ===============================
# RASTER SETTINGS
# ===============================
RASTER_NODATA = None
RASTER_RESAMPLING_METHOD = "bilinear"


# ===============================
# ANALYSIS SETTINGS
# ===============================
GABAH_KERING_PANEN = 6500000


# ===============================
# PIPELINE SETTINGS
# ===============================
ENABLE_TEMP_SAVE = True
ENABLE_LOG_STATS = True


# ===============================
# PERFORMANCE
# ===============================
USE_MULTIPROCESSING = False
MAX_WORKERS = 4


# ===============================
# CRS
# ===============================
DEFAULT_CRS = "EPSG:4326"


# ===============================
# PATH (DYNAMIC - NO HARDCODE)
# ===============================
from pathlib import Path

BASE_PROJECT = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_PROJECT / "data"

ANALYSIS_DIR = DATA_DIR / "output" / "analysis"
ZONAL_DIR = DATA_DIR / "output" / "zonal"

# ===============================
# FILES ANALYSIS
# ===============================
FILES_ANALYSIS = {
    "flood": ANALYSIS_DIR / "kabkota_flood_final.geojson",
    "drought": ANALYSIS_DIR / "kabkota_drought_final.geojson",
    "multihazard": ANALYSIS_DIR / "kabkota_multihazard_final.geojson",
}

# ===============================
# FILES ZONAL
# ===============================
FILES_ZONAL = [
    ZONAL_DIR / "flood_stats.geojson",
    ZONAL_DIR / "drought_stats.geojson",
]

# ===============================
# FILES PRODUCTION
# ===============================
FILES_PRODUCTION = {
    "padi": DATA_DIR / "raw" / "exposure" / "totalproduksipadi.csv"
}

# ===============================
# FILES ADMIN
# ===============================
FILES_ADMIN = {
    "regions": DATA_DIR / "raw" / "administrasi" / "regions.gpkg"
}

# ===============================
# FILE SAWAH
# ===============================
FILE_SAWAH = DATA_DIR / "processed" / "vector" / "sawah_admin_intersection.geojson"
