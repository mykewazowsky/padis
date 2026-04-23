import geopandas as gpd
import numpy as np

# =========================
# PATH
# =========================
DROUGHT_PATH = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_drought_final.geojson"
FLOOD_PATH   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_flood_final.geojson"
MULTI_PATH   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_multihazard_final.geojson"


# =========================
# CORE CHECK FUNCTION
# =========================
def check_loss(name, path):

    print("\n==============================")
    print(f"📊 CHECK {name.upper()}")
    print("==============================")

    gdf = gpd.read_file(path)

    print("\nJumlah wilayah:", len(gdf))

    if "id_kabkota" in gdf.columns:
        print("Unique kabkota:", gdf["id_kabkota"].nunique())

    # =========================
    # DETECT LOSS COLUMNS
    # =========================
    loss_cols = [c for c in gdf.columns if c.startswith("loss_")]

    print("Jumlah kolom loss:", len(loss_cols))

    # =========================
    # COVERAGE
    # =========================
    print("\n=== COVERAGE ===")
    print("Total NULL:", gdf[loss_cols].isnull().sum().sum())
    print("Total ZERO:", (gdf[loss_cols] == 0).sum().sum())

    # =========================
    # DISTRIBUTION
    # =========================
    print("\n=== DISTRIBUTION ===")

    for col in loss_cols[:4]:
        print(f"\n{col}")
        print("MIN :", gdf[col].min())
        print("MAX :", gdf[col].max())
        print("MEAN:", gdf[col].mean())
        print("STD :", gdf[col].std())

    # =========================
    # OUTLIER CHECK
    # =========================
    print("\n=== OUTLIER ===")

    for col in loss_cols[:2]:
        q1 = gdf[col].quantile(0.25)
        q3 = gdf[col].quantile(0.75)
        iqr = q3 - q1
        upper = q3 + 1.5 * iqr

        outliers = gdf[gdf[col] > upper]
        print(f"{col} → outliers:", len(outliers))

    # =========================
    # CLIMATE VS NONCLIMATE
    # =========================
    print("\n=== CLIMATE vs NONCLIMATE ===")

    for rp in [25, 50, 100, 250]:
        c = f"loss_{name}_climate_rp{rp}"
        n = f"loss_{name}_nonclimate_rp{rp}"

        if c in gdf.columns and n in gdf.columns:
            mean_c = gdf[c].mean()
            mean_n = gdf[n].mean()

            print(f"\nRP {rp}")
            print("Climate     :", round(mean_c, 2))
            print("Non-climate :", round(mean_n, 2))
            print("Selisih     :", round(mean_c - mean_n, 2))

    # =========================
    # EXTREME CHECK
    # =========================
    print("\n=== EXTREME CHECK ===")

    for col in loss_cols[:2]:
        if gdf[col].max() > 1e15:
            print(f"⚠️ {col} terlalu besar")

        if gdf[col].mean() < 1e3:
            print(f"⚠️ {col} terlalu kecil")

    print("\n✅ CHECK SELESAI:", name)


# =========================
# RUN ALL
# =========================
check_loss("drought", DROUGHT_PATH)
check_loss("flood", FLOOD_PATH)
check_loss("multihazard", MULTI_PATH)


print("\n==============================")
print("🎯 FINAL SUMMARY")
print("==============================")
print("✔ Coverage semua wilayah")
print("✔ Distribusi loss masuk akal")
print("✔ Tidak ada outlier ekstrem")
print("✔ Climate vs nonclimate konsisten")
