import geopandas as gpd
import numpy as np

# =========================
# PATH
# =========================
DROUGHT_PATH = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\zonal\drought_stats.geojson"
FLOOD_PATH   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\zonal\flood_stats.geojson"


# =========================
# GENERIC CHECK FUNCTION
# =========================
def check_hazard(name, path, prefix):

    print("\n==============================")
    print(f"🚀 CHECK {name.upper()}")
    print("==============================")

    gdf = gpd.read_file(path)

    print("\nJumlah fitur:", len(gdf))

    # detect columns
    zonal_cols = [c for c in gdf.columns if c.startswith(f"mean_{prefix}")]
    di_cols = [c for c in gdf.columns if c.startswith(f"di_{prefix}")]
    lop_cols = [c for c in gdf.columns if c.startswith(f"lop_{prefix}")]

    print("Zonal:", len(zonal_cols))
    print("DI   :", len(di_cols))
    print("LOP  :", len(lop_cols))

    # =========================
    # RANGE CHECK
    # =========================
    def check_range(cols, label):
        print(f"\n=== {label} RANGE ===")
        for col in cols[:4]:
            print(f"\n{col}")
            print("MIN :", gdf[col].min())
            print("MAX :", gdf[col].max())
            print("MEAN:", gdf[col].mean())

            if gdf[col].min() < 0 or gdf[col].max() > 1:
                print("❌ OUT OF RANGE")

    check_range(zonal_cols, "ZONAL")
    check_range(di_cols, "DI")
    check_range(lop_cols, "LOP")

    # =========================
    # CLIMATE VS NONCLIMATE
    # =========================
    print("\n=== CLIMATE vs NONCLIMATE ===")

    for rp in [25, 50, 100, 250]:
        c = f"mean_{prefix}_rc{rp}"
        n = f"mean_{prefix}_r{rp}"

        if c in gdf.columns and n in gdf.columns:
            mean_c = gdf[c].mean()
            mean_n = gdf[n].mean()

            print(f"\nRP {rp}")
            print("Climate     :", round(mean_c, 4))
            print("Non-climate :", round(mean_n, 4))
            print("Selisih     :", round(mean_c - mean_n, 4))

    # =========================
    # MONOTONIC CHECK
    # =========================
    print("\n=== MONOTONIC CHECK (DI → LOP) ===")

    for rp in [25]:
        di = f"di_{prefix}_r{rp}"
        lop = f"lop_{prefix}_r{rp}"

        if di in gdf.columns and lop in gdf.columns:
            corr = np.corrcoef(gdf[di].fillna(0), gdf[lop].fillna(0))[0, 1]
            print(f"Correlation RP{rp}:", round(corr, 4))

            if corr < 0:
                print("❌ NOT MONOTONIC")
            else:
                print("✅ MONOTONIC")

    # =========================
    # DATA QUALITY
    # =========================
    print("\n=== DATA QUALITY ===")
    print("Total NULL:", gdf.isnull().sum().sum())

    if "id_kabkota" in gdf.columns:
        dup = gdf["id_kabkota"].duplicated().sum()
        print("Duplicate kabkota:", dup)


# =========================
# RUN ALL
# =========================
check_hazard("drought", DROUGHT_PATH, "drought")
check_hazard("flood", FLOOD_PATH, "flood")


print("\n==============================")
print("🎯 FINAL SUMMARY")
print("==============================")
print("✔ Semua hazard sudah dicek")
print("✔ Cek range, monotonic, dan consistency")
print("✔ Siap validasi sebelum Supabase")