"""
analyse_sawah_bleed.py
Analisis sawah yang "bleeding" keluar batas kabkota setelah metode
largest-overlap sjoin.

Ukur:
1. Berapa sawah polygon yang sebagian areanya masuk ke kabkota lain?
2. Berapa total area bleed (ha) dan persentasenya?
3. Di provinsi/kabkota mana bleed paling banyak?
4. Perbandingan: old method (clip) vs new method (largest-overlap)
"""
import sys, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import geopandas as gpd
import pandas as pd

SAWAH_INT  = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\processed\vector\sawah_admin_intersection.geojson"
SAWAH_RAW  = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\exposure\sawah_selected.gpkg"
REGIONS    = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\administrasi\regions.gpkg"

sep = "=" * 80

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    raw   = gpd.read_file(SAWAH_RAW)
    intr  = gpd.read_file(SAWAH_INT)
    reg   = gpd.read_file(REGIONS)

proj_crs = "EPSG:32749"
raw_proj = raw.to_crs(proj_crs).reset_index(drop=True)
reg_proj = reg[["id_kabkota","kab_kota","prov","geometry"]].to_crs(proj_crs)

print(f"\n{sep}")
print("  1. UKURAN DATASET")
print(sep)
print(f"  sawah_selected (raw)    : {len(raw_proj):,} polygon")
print(f"  sawah_intersection (new): {len(intr):,} kabkota (dissolved)")
print(f"  regions                 : {len(reg_proj):,} kabkota")

# ── Berapa sawah polygon lintas batas? ───────────────────────────────────────
print(f"\n{sep}")
print("  2. DETEKSI SAWAH YANG LINTAS BATAS ADMIN")
print(sep)

# Untuk setiap sawah, hitung berapa kabkota yang diirisnya
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    raw_proj["_idx"] = raw_proj.index
    joined = gpd.sjoin(
        raw_proj[["_idx","KODE_PROV","geometry"]],
        reg_proj[["id_kabkota","geometry"]],
        how="left", predicate="intersects"
    )

kabkota_per_sawah = joined.groupby("_idx")["id_kabkota"].nunique()
single  = (kabkota_per_sawah == 1).sum()
multi   = (kabkota_per_sawah > 1).sum()
no_kab  = (kabkota_per_sawah == 0).sum()

print(f"  Sawah dalam 1 kabkota   : {single:,} ({single/len(raw_proj)*100:.1f}%)")
print(f"  Sawah lintas ≥2 kabkota : {multi:,} ({multi/len(raw_proj)*100:.1f}%)")
print(f"  Sawah tanpa kabkota     : {no_kab:,}")

# ── Area bleed per sawah lintas batas ────────────────────────────────────────
print(f"\n{sep}")
print("  3. KUANTIFIKASI AREA BLEED")
print(sep)

multi_idx  = kabkota_per_sawah[kabkota_per_sawah > 1].index
multi_saw  = raw_proj.loc[multi_idx]

# Untuk setiap sawah lintas batas: hitung area dalam assigned kabkota vs total
# Kita butuh tahu kabkota mana yang diassign (largest overlap)
multi_joined = joined[joined["_idx"].isin(multi_idx)].copy()

# Hitung area intersection per pasangan
bleed_rows = []
for sawah_i, group in multi_joined.groupby("_idx"):
    s_geom = raw_proj.loc[sawah_i, "geometry"]
    s_area = s_geom.area

    best_kab = None
    best_area = 0
    others_area = 0

    for _, row in group.iterrows():
        kab_id = row["id_kabkota"]
        kab_geom = reg_proj.loc[reg_proj["id_kabkota"] == kab_id, "geometry"]
        if kab_geom.empty:
            continue
        try:
            inter_area = s_geom.intersection(kab_geom.iloc[0]).area
        except Exception:
            inter_area = 0

        if inter_area > best_area:
            best_area = inter_area
            best_kab = kab_id

    others_area = s_area - best_area
    bleed_rows.append({
        "_idx":       sawah_i,
        "KODE_PROV":  raw_proj.loc[sawah_i, "KODE_PROV"],
        "total_area": s_area,
        "best_area":  best_area,
        "bleed_area": others_area,
        "pct_bleed":  others_area / s_area * 100 if s_area > 0 else 0,
        "n_kabkota":  kabkota_per_sawah[sawah_i],
    })

bleed_df = pd.DataFrame(bleed_rows)

total_raw_area  = raw_proj.geometry.area.sum() / 10_000
total_bleed_ha  = bleed_df["bleed_area"].sum() / 10_000
single_raw_area = raw_proj.loc[raw_proj.index.isin(
    kabkota_per_sawah[kabkota_per_sawah == 1].index
)].geometry.area.sum() / 10_000

print(f"  Total area sawah raw          : {total_raw_area:>12,.0f} ha")
print(f"  Area sawah lintas batas       : {bleed_df['total_area'].sum()/10000:>12,.0f} ha ({bleed_df['total_area'].sum()/raw_proj.geometry.area.sum()*100:.1f}%)")
print(f"  Area bleed (keluar batas)     : {total_bleed_ha:>12,.0f} ha ({total_bleed_ha/total_raw_area*100:.1f}%)")
print(f"  Rata-rata bleed per polygon   : {bleed_df['pct_bleed'].mean():.1f}%")
print(f"  Median bleed per polygon      : {bleed_df['pct_bleed'].median():.1f}%")
print(f"  Max bleed per polygon         : {bleed_df['pct_bleed'].max():.1f}%")

# ── Distribusi bleed ──────────────────────────────────────────────────────────
print(f"\n  Distribusi persentase bleed per polygon:")
bins = [0,5,10,20,30,50,100]
labels = ["0-5%","5-10%","10-20%","20-30%","30-50%","50-100%"]
bleed_df["bleed_bin"] = pd.cut(bleed_df["pct_bleed"], bins=bins, labels=labels)
dist = bleed_df["bleed_bin"].value_counts().sort_index()
for lbl, cnt in dist.items():
    print(f"    {lbl:<12}: {cnt:>5,} polygon ({cnt/len(bleed_df)*100:.1f}%)")

# ── Per provinsi ──────────────────────────────────────────────────────────────
print(f"\n{sep}")
print("  4. BLEED PER PROVINSI (top 10 terbesar)")
print(sep)
prov_bleed = bleed_df.groupby("KODE_PROV").agg(
    n_sawah_bleed=("_idx","count"),
    bleed_ha=("bleed_area", lambda x: x.sum()/10000),
).sort_values("bleed_ha", ascending=False).head(10)
print(prov_bleed.to_string())

# ── Dampak terhadap zonal statistics ─────────────────────────────────────────
print(f"\n{sep}")
print("  5. DAMPAK TERHADAP ZONAL STATISTICS")
print(sep)
print(f"""
  Metode new (largest-overlap sjoin):
    + Area retensi 100% (tidak ada area hilang)
    - {multi:,} sawah ({multi/len(raw_proj)*100:.1f}%) geometrinya tidak terpotong di batas admin
    - Bleed total {total_bleed_ha:,.0f} ha ({total_bleed_ha/total_raw_area*100:.1f}% dari total area sawah)
    - Saat zonal stats, sawah Jember yang bleed ke Bondowoso
      akan menyample pixel raster dari area Bondowoso

  Metode old (strict clip intersection):
    + Sawah tepat di batas admin, tidak ada bleed
    - 31.9% area hilang (2,591,176 ha)
    - Zonal stats undercount exposure

  Pilihan terbaik tergantung prioritas metodologi:
    a) Jika akurasi batas spatial prioritas → old method (clip)
    b) Jika kelengkapan area sawah prioritas → new method (sjoin)
    c) Hybrid: clip untuk sawah dengan bleed < 20%, sjoin untuk sisanya
""")
