import geopandas as gpd
import numpy as np

# =========================
# PATH FILE ZONAL KAMU
# =========================
path = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\zonal\drought_stats.geojson"

print(f"\n📂 Membaca file:\n{path}")

gdf = gpd.read_file(path)

print("\nJumlah baris:", len(gdf))
print("Jumlah kolom:", len(gdf.columns))

# =========================
# PRINT SEMUA KOLOM
# =========================
print("\n=== SEMUA KOLOM ===")
for col in gdf.columns:
    print("-", col)

# =========================
# CARI KOLOM DROUGHT
# =========================
drought_cols = [c for c in gdf.columns if "drought" in c.lower()]

print("\n=== KOLOM TERKAIT DROUGHT ===")
for col in drought_cols:
    print("-", col)

# =========================
# HITUNG DI (SIMULASI)
# =========================
found = False

for col in drought_cols:
    if col.startswith("mean"):
        found = True
        di_col = col.replace("mean_", "di_")
        gdf[di_col] = gdf[col]

        s = gdf[di_col].replace([np.inf, -np.inf], np.nan).dropna()

        print("\n" + "="*60)
        print(f"DI: {di_col}")
        print("="*60)

        if s.empty:
            print("❌ Semua NaN")
            continue

        print(f"Min   : {s.min():.4f}")
        print(f"Mean  : {s.mean():.4f}")
        print(f"Max   : {s.max():.4f}")
        print(f"% Nol : {(s == 0).sum() / len(s) * 100:.2f}%")

if not found:
    print("\n❌ TIDAK ADA mean_drought_* → ZONAL KAMU BERMASALAH")
