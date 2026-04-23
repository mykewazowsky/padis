import geopandas as gpd
import numpy as np

# =========================================================
# PATH FILE FINAL
# =========================================================
path = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_drought_final.geojson"

print("\n" + "=" * 100)
print(f"📂 MEMBACA FILE:\n{path}")
print("=" * 100)

gdf = gpd.read_file(path)

print(f"\nJumlah baris : {len(gdf)}")
print(f"Jumlah kolom : {len(gdf.columns)}")

# =========================================================
# DETEKSI KOLOM LOSS
# =========================================================
loss_cols = [c for c in gdf.columns if c.startswith("loss_drought_")]

print("\n=== KOLOM LOSS ===")
for c in loss_cols:
    print("-", c)

if not loss_cols:
    print("\n❌ Tidak ada kolom loss ditemukan")
    exit()

# =========================================================
# ANALISIS PER KOLOM
# =========================================================
for col in loss_cols:
    s = gdf[col].replace([np.inf, -np.inf], np.nan).dropna()

    print("\n" + "=" * 80)
    print(f"📊 {col}")
    print("=" * 80)

    if s.empty:
        print("❌ Semua NaN")
        continue

    zero_pct = (s == 0).sum() / len(s) * 100

    print(f"Min   : {s.min():.2f}")
    print(f"Mean  : {s.mean():.2f}")
    print(f"Max   : {s.max():.2f}")
    print(f"Std   : {s.std():.2f}")
    print(f"% Nol : {zero_pct:.2f}%")

# =========================================================
# PERBANDINGAN CLIMATE vs NON-CLIMATE
# =========================================================
print("\n" + "=" * 80)
print("🌦️ PERBANDINGAN CLIMATE vs NON-CLIMATE")
print("=" * 80)

rp_list = ["r25", "r50", "r100", "r250"]

for rp in rp_list:
    col_non = f"loss_drought_nonclimate_{rp}"
    col_clim = f"loss_drought_climate_{rp}"

    if col_non in gdf.columns and col_clim in gdf.columns:
        s1 = gdf[col_non].replace([np.inf, -np.inf], np.nan).dropna()
        s2 = gdf[col_clim].replace([np.inf, -np.inf], np.nan).dropna()

        print(f"\nRP: {rp}")
        print(f"Non-climate Mean : {s1.mean():.2f}")
        print(f"Climate Mean     : {s2.mean():.2f}")

        diff = s2.mean() - s1.mean()
        print(f"Selisih          : {diff:.2f}")

# =========================================================
# DETEKSI MASALAH
# =========================================================
print("\n" + "=" * 80)
print("🧠 DIAGNOSIS")
print("=" * 80)

all_zero = all((gdf[c] == 0).all() for c in loss_cols)

if all_zero:
    print("❌ Semua loss = 0 → DI tidak masuk atau zonal gagal")

elif all(gdf[c].mean() < 1 for c in loss_cols):
    print("⚠️ Loss sangat kecil → kemungkinan scaling salah")

else:
    print("✅ Loss terlihat masuk akal (cek distribusi detail di atas)")
