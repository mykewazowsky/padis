import os

# ===============================
# ROOT
# ===============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

# ===============================
# DATA ROOT
# ===============================
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

# ===============================
# DATA STRUCTURE
# ===============================
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")

# ===============================
# RAW
# ===============================
RAW_HAZARD_DIR = os.path.join(RAW_DIR, "hazard")
RAW_ADMIN_DIR = os.path.join(RAW_DIR, "administrasi")
RAW_EXPOSURE_DIR = os.path.join(RAW_DIR, "exposure")

# ===============================
# PROCESSED
# ===============================
PROCESSED_HAZARD_DIR = os.path.join(PROCESSED_DIR, "hazard")
PROCESSED_VECTOR_DIR = os.path.join(PROCESSED_DIR, "vector")

# ===============================
# OUTPUT
# ===============================
OUTPUT_ZONAL_DIR = os.path.join(OUTPUT_DIR, "zonal")
OUTPUT_ANALYSIS_DIR = os.path.join(OUTPUT_DIR, "analysis")   # FIX: ditambahkan, dipakai analysis_registry
