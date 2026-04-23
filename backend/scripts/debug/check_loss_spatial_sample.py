import geopandas as gpd
import numpy as np

# =========================================================
# PATH
# =========================================================
path = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_drought_final.geojson"

print("\n📂 Load data...")
gdf = gpd.read_file(path)

print(f"Jumlah fitur: {len(gdf)}")

# =========================================================
# PILIH RETURN PERIOD
# =========================================================
rp = "rp100"  # bisa ganti rp25, rp50, rp250

col_non = f"loss_drought_nonclimate_{rp}"
col_clim = f"loss_drought_climate_{rp}"

# =========================================================
# CEK KOLOM
# =========================================================
if col_non not in gdf.columns or col_clim not in gdf.columns:
    raise ValueError("Kolom tidak ditemukan")

# =========================================================
# 1. TOP 10 LOSS TERBESAR
# =========================================================
print("\n" + "="*80)
print("🏆 TOP 10 LOSS TERBESAR (NON-CLIMATE)")
print("="*80)

top10 = gdf.sort_values(col_non, ascending=False).head(10)

for i, row in top10.iterrows():
    print(f"{row['kab_kota']} | Non: {row[col_non]:.0f} | Clim: {row[col_clim]:.0f}")

# =========================================================
# 2. SAMPEL ACAK
# =========================================================
print("\n" + "="*80)
print("🎲 SAMPEL ACAK (10 WILAYAH)")
print("="*80)

sample = gdf.sample(10, random_state=42)

for i, row in sample.iterrows():
    diff = row[col_clim] - row[col_non]
    print(f"{row['kab_kota']}")
    print(f"  Non  : {row[col_non]:.0f}")
    print(f"  Clim : {row[col_clim]:.0f}")
    print(f"  Diff : {diff:.0f}")
    print("-"*40)

# =========================================================
# 3. CEK WILAYAH LOSS = 0
# =========================================================
print("\n" + "="*80)
print("🧊 WILAYAH DENGAN LOSS = 0")
print("="*80)

zero_loss = gdf[gdf[col_non] == 0]

print(f"Jumlah wilayah: {len(zero_loss)}")

for i, row in zero_loss.head(10).iterrows():
    print(row["kab_kota"])

# =========================================================
# 4. DISTRIBUSI KUANTIL
# =========================================================
print("\n" + "="*80)
print("📊 DISTRIBUSI KUANTIL")
print("="*80)

quantiles = [0, 0.25, 0.5, 0.75, 0.9, 1.0]

print("\nNON-CLIMATE:")
for q in quantiles:
    print(f"Q{int(q*100)} : {gdf[col_non].quantile(q):.0f}")

print("\nCLIMATE:")
for q in quantiles:
    print(f"Q{int(q*100)} : {gdf[col_clim].quantile(q):.0f}")

# =========================================================
# 5. RATIO CLIMATE / NON
# =========================================================
print("\n" + "="*80)
print("⚖️ RATIO CLIMATE / NON-CLIMATE")
print("="*80)

gdf["ratio"] = gdf[col_clim] / gdf[col_non].replace(0, np.nan)

ratio = gdf["ratio"].dropna()

print(f"Mean ratio : {ratio.mean():.3f}")
print(f"Min ratio  : {ratio.min():.3f}")
print(f"Max ratio  : {ratio.max():.3f}")

# =========================================================
# 6. CEK ANOMALI (CLIMATE >> NON)
# =========================================================
print("\n" + "="*80)
print("🚨 ANOMALI (CLIMATE > NON)")
print("="*80)

anomali = gdf[gdf[col_clim] > gdf[col_non]]

print(f"Jumlah wilayah: {len(anomali)}")

for i, row in anomali.head(10).iterrows():
    print(f"{row['kab_kota']} | Non: {row[col_non]:.0f} | Clim: {row[col_clim]:.0f}")