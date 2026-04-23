import geopandas as gpd
import numpy as np
import rasterio
from rasterstats import zonal_stats

# =========================================================
# PATH
# =========================================================
raster_path = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\processed\hazard\drought_r25_norm.tif"

vector_path = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_drought_final.geojson"


# =========================================================
# POLYNOMIAL FUNCTION (LOP)
# =========================================================
def drought_polynomial(x):
    if x is None or np.isnan(x):
        return np.nan

    y = (
        -0.8381 * (x ** 3)
        + 0.8967 * (x ** 2)
        + 0.9064 * x
        - 0.0106
    )

    return max(0.0, min(1.0, y))


# =========================================================
# LOAD VECTOR
# =========================================================
print("\n📂 Load vector...")
gdf = gpd.read_file(vector_path)

print(f"Jumlah fitur: {len(gdf)}")
print("CRS vector :", gdf.crs)

# =========================================================
# LOAD RASTER
# =========================================================
with rasterio.open(raster_path) as src:
    raster_crs = src.crs
    raster_bounds = src.bounds

print("CRS raster :", raster_crs)

# =========================================================
# FIX CRS (WAJIB)
# =========================================================
if gdf.crs != raster_crs:
    print("⚠️ CRS berbeda → reprojection...")
    gdf = gdf.to_crs(raster_crs)

print("CRS setelah fix :", gdf.crs)

# =========================================================
# CLEAN GEOMETRY
# =========================================================
print("\n🧹 Cleaning geometry...")

gdf = gdf[~gdf.geometry.is_empty]
gdf = gdf[gdf.geometry.notnull()]
gdf = gdf[gdf.is_valid]

print(f"Sisa fitur valid: {len(gdf)}")

# =========================================================
# DEBUG EXTENT
# =========================================================
print("\n📦 EXTENT CHECK")
print("Vector bounds :", gdf.total_bounds)
print("Raster bounds :", raster_bounds)

# =========================================================
# ZONAL STATS → DI
# =========================================================
print("\n🧮 Hitung DI (zonal mean)...")

try:
    zs = zonal_stats(
        gdf,
        raster_path,
        stats=["mean"],
        nodata=np.nan,
        all_touched=True,
    )
except Exception as e:
    print(f"❌ Zonal error: {e}")
    exit()

gdf["di_test"] = [z["mean"] for z in zs]

# =========================================================
# CEK DI
# =========================================================
s = gdf["di_test"].replace([np.inf, -np.inf], np.nan).dropna()

print("\n=== DI (HASIL ZONAL) ===")

if s.empty:
    print("❌ Semua NaN → zonal gagal total")
else:
    print(f"Min   : {s.min():.4f}")
    print(f"Mean  : {s.mean():.4f}")
    print(f"Max   : {s.max():.4f}")
    print(f"% Nol : {(s == 0).sum() / len(s) * 100:.2f}%")

# =========================================================
# HITUNG LOP
# =========================================================
print("\n🔥 Hitung LOP (polynomial)...")

gdf["lop_test"] = gdf["di_test"].apply(drought_polynomial)

s = gdf["lop_test"].replace([np.inf, -np.inf], np.nan).dropna()

print("\n=== LOP ===")

if s.empty:
    print("❌ Semua NaN")
else:
    print(f"Min   : {s.min():.4f}")
    print(f"Mean  : {s.mean():.4f}")
    print(f"Max   : {s.max():.4f}")
    print(f"% Nol : {(s == 0).sum() / len(s) * 100:.2f}%")

# =========================================================
# DIAGNOSIS
# =========================================================
print("\n" + "=" * 80)
print("🧠 DIAGNOSIS")
print("=" * 80)

if gdf["di_test"].isna().all():
    print("❌ DI kosong → raster tidak overlap / CRS salah")
elif (gdf["di_test"] == 0).all():
    print("❌ DI = 0 semua → zonal gagal")
elif (gdf["lop_test"] == 0).all():
    print("❌ LOP = 0 semua → polynomial atau DI bermasalah")
else:
    print("✅ DI dan LOP berhasil dihitung dari raster")

print("\n✅ SELESAI")