"""
compare_sawah_files.py — perbandingan langsung kedua file sawah
"""
import sys, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import geopandas as gpd
import pandas as pd

SAWAH_RAW = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\exposure\sawah_selected.gpkg"
SAWAH_INT = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\processed\vector\sawah_admin_intersection.geojson"
REGIONS   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\administrasi\regions.gpkg"

sep = "=" * 80

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    raw  = gpd.read_file(SAWAH_RAW)
    intr = gpd.read_file(SAWAH_INT)
    reg  = gpd.read_file(REGIONS)

# ── 1. Ringkasan dasar ───────────────────────────────────────────────────────
print(f"\n{sep}")
print("  1. RINGKASAN DASAR")
print(sep)
print(f"  {'':35} {'sawah_selected':>16} {'intersection':>14}")
print(f"  {'-'*35} {'-'*16} {'-'*14}")
print(f"  {'Jumlah fitur':35} {len(raw):>16,} {len(intr):>14,}")
print(f"  {'Kolom LUAS_HA ada?':35} {'Ya' if 'LUAS_HA' in raw.columns else 'Tidak':>16} "
      f"{'Ya' if 'LUAS_HA' in intr.columns else 'Tidak':>14}")

raw_luas  = raw["LUAS_HA"].sum()
intr_luas = intr["LUAS_HA"].sum()
print(f"  {'Total LUAS_HA (ha)':35} {raw_luas:>16,.2f} {intr_luas:>14,.2f}")
print(f"  {'Selisih LUAS_HA':35} {intr_luas - raw_luas:>16,.2f} ({(intr_luas-raw_luas)/raw_luas*100:+.1f}%)")

# ── 2. Luas geometri aktual (diproyeksi UTM) ─────────────────────────────────
print(f"\n{sep}")
print("  2. LUAS GEOMETRI AKTUAL (proyeksi UTM 49S = EPSG:32749)")
print(sep)

raw_utm  = raw.to_crs("EPSG:32749")
intr_utm = intr.to_crs("EPSG:32749")

raw_area_ha  = raw_utm.geometry.area.sum()  / 10_000
intr_area_ha = intr_utm.geometry.area.sum() / 10_000
delta_area   = intr_area_ha - raw_area_ha
pct_area     = delta_area / raw_area_ha * 100

print(f"  Luas geometri sawah_selected : {raw_area_ha:>15,.2f} ha")
print(f"  Luas geometri intersection   : {intr_area_ha:>15,.2f} ha")
print(f"  Selisih                      : {delta_area:>15,.2f} ha ({pct_area:+.1f}%)")

# ── 3. Diagnosa: mengapa LUAS_HA berbeda? ────────────────────────────────────
print(f"\n{sep}")
print("  3. DIAGNOSA LUAS_HA — dissolve aggfunc")
print(sep)

# Simulasikan overlay + dissolve tanpa aggfunc (perilaku saat ini)
print("  Pipeline saat ini: dissolve(by='id_kabkota') tanpa aggfunc")
print("  → aggfunc default = 'first' → LUAS_HA diambil dari polygon PERTAMA saja")
print()

# Buktikan: ambil 3 kabkota, bandingkan LUAS_HA di intr vs sum polygon raw yang cocok
# Kita perlu sjoin raw → regions untuk tahu id_kabkota tiap polygon raw
print("  Contoh: LUAS_HA di intersection vs SUM LUAS_HA polygon raw per kabkota")
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    raw_joined = gpd.sjoin(
        raw[["LUAS_HA","geometry"]].reset_index().rename(columns={"index":"raw_idx"}),
        reg[["id_kabkota","kab_kota","geometry"]],
        how="inner", predicate="intersects"
    )

raw_sum_per_kab = raw_joined.groupby("id_kabkota")["LUAS_HA"].sum().reset_index()
raw_sum_per_kab.columns = ["id_kabkota","luas_raw_sum"]

comparison = intr[["id_kabkota","kab_kota","LUAS_HA"]].merge(
    raw_sum_per_kab, on="id_kabkota", how="left"
)
comparison["selisih"] = comparison["LUAS_HA"] - comparison["luas_raw_sum"]
comparison["pct"]     = comparison["selisih"] / comparison["luas_raw_sum"] * 100

print(f"  {'id_kabkota':<12} {'kab_kota':<35} {'LUAS_intr':>12} {'LUAS_raw_sum':>14} {'selisih':>12} {'pct':>7}")
print(f"  {'-'*12} {'-'*35} {'-'*12} {'-'*14} {'-'*12} {'-'*7}")
worst = comparison.reindex(comparison["selisih"].abs().nlargest(15).index)
for _, r in worst.iterrows():
    print(f"  {r['id_kabkota']:<12} {r['kab_kota']:<35} {r['LUAS_HA']:>12,.1f} "
          f"{r['luas_raw_sum']:>14,.1f} {r['selisih']:>12,.1f} {r['pct']:>7.1f}%")

total_raw_sum  = comparison["luas_raw_sum"].sum()
total_intr_sum = comparison["LUAS_HA"].sum()
print(f"\n  TOTAL luas_raw_sum (via sjoin)  : {total_raw_sum:>15,.2f} ha")
print(f"  TOTAL LUAS_HA intersection      : {total_intr_sum:>15,.2f} ha")
print(f"  Selisih                         : {total_intr_sum - total_raw_sum:>15,.2f} ha")

# ── 4. Kabkota yang tidak ada di intersection ─────────────────────────────────
print(f"\n{sep}")
print("  4. KABKOTA DI REGIONS TAPI TIDAK ADA DI INTERSECTION")
print(sep)

reg_ids  = set(reg["id_kabkota"].astype(str).str.strip())
intr_ids = set(intr["id_kabkota"].astype(str).str.strip())
missing  = sorted(reg_ids - intr_ids)

print(f"  Kabkota di regions     : {len(reg_ids)}")
print(f"  Kabkota di intersection: {len(intr_ids)}")
print(f"  Tidak punya sawah      : {len(missing)}")

reg_lkp = reg.set_index(reg["id_kabkota"].astype(str).str.strip())[["kab_kota","prov"]]
print(f"\n  {'id_kabkota':<12} {'kab_kota':<40} {'prov'}")
print(f"  {'-'*12} {'-'*40} {'-'*25}")
for k in missing:
    if k in reg_lkp.index:
        row = reg_lkp.loc[k]
        print(f"  {k:<12} {row['kab_kota']:<40} {row['prov']}")

# ── 5. Kesimpulan ─────────────────────────────────────────────────────────────
print(f"\n{sep}")
print("  5. AKAR PENYEBAB")
print(sep)
print(f"""
  LUAS_HA di intersection ({intr_luas:,.0f} ha) jauh lebih kecil dari
  sawah_selected ({raw_luas:,.0f} ha) karena dissolve() di vector_engine.py
  tidak menyertakan aggfunc → LUAS_HA diambil dari polygon PERTAMA saja
  (default 'first'), bukan dijumlahkan dari semua polygon per kabkota.

  Geometri aktual intersection ({intr_area_ha:,.0f} ha) vs raw ({raw_area_ha:,.0f} ha):
  selisih geometri {pct_area:+.1f}% — ini wajar karena overlay memotong sawah
  yang melintas batas kabkota dan hasilnya hanya bagian yang berada di dalam.

  FIX: dissolve(by='id_kabkota', aggfunc={{'LUAS_HA': 'sum', ...}})
""")
