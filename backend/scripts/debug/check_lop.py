import geopandas as gpd
import numpy as np

# =========================
# PATH FILE FINAL KAMU
# =========================
path = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_drought_final.geojson"

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
# DETEKSI KOLOM PENTING
# =========================
di_cols = [c for c in gdf.columns if "di" in c.lower()]
prod_cols = [c for c in gdf.columns if "prod" in c.lower() or "ton" in c.lower()]

print("\n=== KOLOM DI ===")
for c in di_cols:
    print("-", c)

print("\n=== KOLOM PRODUKSI ===")
for c in prod_cols:
    print("-", c)

# =========================
# SIMULASI LOP
# =========================
if di_cols and prod_cols:
    di_col = di_cols[0]
    prod_col = prod_cols[0]

    print(f"\n🔍 Menggunakan:")
    print(f"DI   : {di_col}")
    print(f"PROD : {prod_col}")

    gdf["lop_test"] = gdf[di_col] * gdf[prod_col]

    s = gdf["lop_test"].replace([np.inf, -np.inf], np.nan).dropna()

    print("\n=== HASIL LOP (SIMULASI) ===")

    if s.empty:
        print("❌ Semua NaN")
    else:
        print(f"Min   : {s.min():.2f}")
        print(f"Mean  : {s.mean():.2f}")
        print(f"Max   : {s.max():.2f}")
        print(f"% Nol : {(s == 0).sum() / len(s) * 100:.2f}%")

else:
    print("\n❌ Tidak cukup data untuk hitung LOP")
    print("👉 Kemungkinan:")
    print("- DI belum ada")
    print("- Data produksi belum ada")
