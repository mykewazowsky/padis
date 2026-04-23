import os
import numpy as np
import geopandas as gpd


# =========================================================
# RINGKASAN STATISTIK
# =========================================================
def summarize_series(name: str, s) -> None:
    s = s.replace([np.inf, -np.inf], np.nan).dropna()

    print("\n" + "=" * 80)
    print(f"KOLOM: {name}")
    print("=" * 80)

    if s.empty:
        print("Semua nilai kosong / NaN")
        return

    neg_count = (s < 0).sum()
    zero_count = (s == 0).sum()
    pos_count = (s > 0).sum()

    print(f"Jumlah valid   : {len(s)}")
    print(f"Min            : {s.min():.6f}")
    print(f"Q1 (25%)       : {s.quantile(0.25):.6f}")
    print(f"Median         : {s.median():.6f}")
    print(f"Mean           : {s.mean():.6f}")
    print(f"Q3 (75%)       : {s.quantile(0.75):.6f}")
    print(f"Max            : {s.max():.6f}")
    print(f"Std            : {s.std():.6f}")
    print(f"Negatif (<0)   : {neg_count}")
    print(f"Nol (=0)       : {zero_count}")
    print(f"Positif (>0)   : {pos_count}")
    print(f"% Negatif      : {neg_count / len(s) * 100:.2f}%")
    print(f"% Nol          : {zero_count / len(s) * 100:.2f}%")
    print(f"% Positif      : {pos_count / len(s) * 100:.2f}%")


# =========================================================
# CEK SEMUA KOLOM DI
# =========================================================
def compare_pairs(gdf: gpd.GeoDataFrame) -> None:
    di_cols = [c for c in gdf.columns if c.startswith("di_drought_")]

    if not di_cols:
        print("❌ Tidak ada kolom di_drought_* ditemukan")
        return

    print("\nDAFTAR KOLOM DI_DROUGHT:")
    for c in di_cols:
        print(f"- {c}")

    print("\nRINGKASAN SEMUA KOLOM:")
    for col in di_cols:
        summarize_series(col, gdf[col])

    climate_cols = [c for c in di_cols if "climate" in c.lower()]
    non_climate_cols = [c for c in di_cols if "non" in c.lower()]

    if climate_cols:
        print("\n" + "#" * 80)
        print("KHUSUS KOLOM CLIMATE")
        print("#" * 80)
        for col in climate_cols:
            summarize_series(col, gdf[col])

    if non_climate_cols:
        print("\n" + "#" * 80)
        print("KHUSUS KOLOM NON-CLIMATE")
        print("#" * 80)
        for col in non_climate_cols:
            summarize_series(col, gdf[col])


# =========================================================
# PROSES FILE
# =========================================================
def process_file(path):
    print("\n" + "=" * 100)
    print(f"📂 MEMPROSES FILE: {path}")
    print("=" * 100)

    try:
        gdf = gpd.read_file(path)
    except Exception as e:
        print(f"❌ Gagal membaca file: {e}")
        return

    print(f"Jumlah baris : {len(gdf)}")
    print(f"Jumlah kolom : {len(gdf.columns)}")

    compare_pairs(gdf)


# =========================================================
# MAIN
# =========================================================
def main():
    # 🔥 PATH UTAMA KAMU
    processed_dir = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\processed"

    zonal_file = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\zonal\drought_stats.geojson"

    analysis_file = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_drought_final.geojson"

    input_paths = []

    # =====================================================
    # 1. FILE ZONAL & FINAL
    # =====================================================
    input_paths.append(zonal_file)
    input_paths.append(analysis_file)

    # =====================================================
    # 2. SCAN FOLDER PROCESSED
    # =====================================================
    if os.path.exists(processed_dir):
        for file in os.listdir(processed_dir):
            if file.endswith(".gpkg") or file.endswith(".geojson"):
                full_path = os.path.join(processed_dir, file)
                input_paths.append(full_path)

    else:
        print("⚠️ Folder processed tidak ditemukan")

    # =====================================================
    # EKSEKUSI SEMUA FILE
    # =====================================================
    for path in input_paths:
        process_file(path)


# =========================================================
if __name__ == "__main__":
    main()
