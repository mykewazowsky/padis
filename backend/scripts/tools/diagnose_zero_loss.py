"""
diagnose_zero_loss.py

Cek penyebab loss = 0 di run 44 untuk kabkota yang di CSV punya loss > 0.
Periksa apakah karena: (1) total_prod = 0, (2) mean_flood = 0/NaN, atau (3) keduanya.
"""

import sys
from pathlib import Path
_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd
import geopandas as gpd

CSV_PATH      = r"C:\Users\Asus\Downloads\loss_baseline_rp25.csv"
FLOOD_FINAL   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_flood_final.geojson"
FLOOD_ZONAL   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\zonal\flood_stats_from_db.geojson"

sep = "=" * 80

# ── Load CSV, ambil kabkota yang punya loss di CSV ────────────────────────
csv = pd.read_csv(CSV_PATH)
csv["kab_kota"] = csv["kab_kota"].str.strip()
csv["prov"]     = csv["prov"].str.strip()
csv["tinggi_genangan"] = pd.to_numeric(csv["tinggi_genangan"], errors="coerce")

def parse_rupiah(val):
    if not isinstance(val, str):
        return float(val) if pd.notna(val) else np.nan
    val = (val.replace("Rp","").replace(" ","").replace(",","")
              .replace("\xa0","").strip())
    if val in ["-", "", "Rp-"]:
        return 0.0
    try:
        return float(val)
    except ValueError:
        return np.nan

csv["loss_banjir_lama"] = csv["loss_banjir"].apply(parse_rupiah)

# Kabkota yang di CSV punya loss > 0 (bukan #NUM! dan bukan 0)
has_csv_loss = csv[(csv["tinggi_genangan"] > 0) & (csv["loss_banjir_lama"] > 0)].copy()

# ── Load flood final run 44 ───────────────────────────────────────────────
gdf = gpd.read_file(FLOOD_FINAL)
gdf["kab_kota"] = gdf["kab_kota"].str.strip()
gdf["prov"]     = gdf["prov"].str.strip()

merged = has_csv_loss.merge(
    gdf[["kab_kota","prov","total_prod","loss_flood_nonclimate_rp25"]],
    on=["kab_kota","prov"], how="left"
)
merged.rename(columns={"loss_flood_nonclimate_rp25": "loss_run44"}, inplace=True)

# Kabkota yang loss run 44 = 0 atau NaN
zero_loss = merged[merged["loss_run44"].fillna(0) == 0].copy()

# ── Load zonal from DB (mean_flood_r25) ───────────────────────────────────
zonal = gpd.read_file(FLOOD_ZONAL)
zonal["kab_kota"] = zonal["kab_kota"].str.strip()
zonal["prov"]     = zonal["prov"].str.strip()

flood_col = "mean_flood_r25"
if flood_col not in zonal.columns:
    print(f"Kolom {flood_col} tidak ada. Kolom tersedia: {[c for c in zonal.columns if c.startswith('mean_')]}")
    sys.exit(1)

zero_loss = zero_loss.merge(
    zonal[["kab_kota","prov", flood_col]],
    on=["kab_kota","prov"], how="left"
)
zero_loss.rename(columns={flood_col: "mean_flood_r25_db"}, inplace=True)

# ── Klasifikasi penyebab ──────────────────────────────────────────────────
def diagnosa(row):
    flood_ok = pd.notna(row["mean_flood_r25_db"]) and row["mean_flood_r25_db"] > 0
    prod_ok  = pd.notna(row["total_prod"]) and row["total_prod"] > 0
    if not flood_ok and not prod_ok:
        return "KEDUANYA (no flood + no prod)"
    elif not flood_ok:
        return "NO FLOOD DATA (mean_flood=0/NaN)"
    elif not prod_ok:
        return "NO PROD DATA (total_prod=0/NaN)"
    else:
        return "LAINNYA (ada flood+prod tapi loss=0?)"

zero_loss["penyebab"] = zero_loss.apply(diagnosa, axis=1)

# ── Print ─────────────────────────────────────────────────────────────────
pd.set_option("display.float_format", "{:,.2f}".format)
pd.set_option("display.max_rows", 999)
pd.set_option("display.width", 120)
pd.set_option("display.max_colwidth", 35)

print(f"\n{sep}")
print("  RINGKASAN — kabkota di CSV punya loss > 0, tapi run 44 = 0")
print(sep)
print(f"  Total kabkota dengan loss di CSV : {len(has_csv_loss)}")
print(f"  Yang menjadi 0 di run 44         : {len(zero_loss)}")

print(f"\n{sep}")
print("  DISTRIBUSI PENYEBAB")
print(sep)
print(zero_loss["penyebab"].value_counts().to_string())

print(f"\n{sep}")
print("  DETAIL — NO FLOOD DATA (mean_flood_r25 = 0 atau NaN di Supabase run 41)")
print(sep)
no_flood = zero_loss[zero_loss["penyebab"] == "NO FLOOD DATA (mean_flood=0/NaN)"]
if no_flood.empty:
    print("  Tidak ada.")
else:
    print(no_flood[["prov","kab_kota","tinggi_genangan","mean_flood_r25_db","total_prod","loss_banjir_lama"]].to_string(index=False))

print(f"\n{sep}")
print("  DETAIL — NO PROD DATA (total_prod = 0 atau NaN)")
print(sep)
no_prod = zero_loss[zero_loss["penyebab"] == "NO PROD DATA (total_prod=0/NaN)"]
if no_prod.empty:
    print("  Tidak ada.")
else:
    print(no_prod[["prov","kab_kota","tinggi_genangan","mean_flood_r25_db","total_prod","loss_banjir_lama"]].to_string(index=False))

print(f"\n{sep}")
print("  DETAIL — KEDUANYA (no flood + no prod)")
print(sep)
both = zero_loss[zero_loss["penyebab"] == "KEDUANYA (no flood + no prod)"]
if both.empty:
    print("  Tidak ada.")
else:
    print(both[["prov","kab_kota","tinggi_genangan","mean_flood_r25_db","total_prod","loss_banjir_lama"]].to_string(index=False))

print(f"\n{sep}")
print("  DETAIL — LAINNYA (ada flood & prod tapi loss tetap 0)")
print(sep)
other = zero_loss[zero_loss["penyebab"] == "LAINNYA (ada flood+prod tapi loss=0?)"]
if other.empty:
    print("  Tidak ada.")
else:
    print(other[["prov","kab_kota","tinggi_genangan","mean_flood_r25_db","total_prod","loss_banjir_lama"]].to_string(index=False))
