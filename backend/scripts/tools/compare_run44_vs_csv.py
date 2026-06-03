"""
compare_run44_vs_csv.py

Bandingkan hasil run 44 (kabkota_flood_final.geojson) dengan CSV lama
loss_baseline_rp25.csv untuk skenario nonclimate RP25.

Usage (dari backend/):
    python -m scripts.tools.compare_run44_vs_csv
"""

import sys
from pathlib import Path
_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd
import geopandas as gpd

CSV_PATH  = r"C:\Users\Asus\Downloads\loss_baseline_rp25.csv"
GEOJSON   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\output\analysis\kabkota_flood_final.geojson"


# ── Formula LOP baru ──────────────────────────────────────────────────────
def lop_baru(x):
    if pd.isna(x) or x <= 0:
        return np.nan
    return max(0.0, 0.29 * np.log(x) + 0.52)


# ── Load CSV ──────────────────────────────────────────────────────────────
csv = pd.read_csv(CSV_PATH)
csv["kab_kota"] = csv["kab_kota"].str.strip()
csv["prov"]     = csv["prov"].str.strip()
csv["tinggi_genangan"] = pd.to_numeric(csv["tinggi_genangan"], errors="coerce")
csv["lop_banjir_lama"] = pd.to_numeric(
    csv["lop_banjir"].replace("#NUM!", np.nan), errors="coerce"
)


def parse_rupiah(val):
    if not isinstance(val, str):
        return float(val) if pd.notna(val) else np.nan
    val = (val.replace("Rp", "").replace(" ", "").replace(",", "")
              .replace("\xa0", "").replace(" ", "").strip())
    if val in ["-", "", "Rp-"]:
        return 0.0
    try:
        return float(val)
    except ValueError:
        return np.nan


csv["loss_banjir_lama"] = csv["loss_banjir"].apply(parse_rupiah)

# ── Hitung LOP baru dari tinggi_genangan ──────────────────────────────────
csv["lop_banjir_baru"] = csv["tinggi_genangan"].apply(lop_baru)

# ── Load GeoJSON run 44 ───────────────────────────────────────────────────
gdf = gpd.read_file(GEOJSON)
gdf["kab_kota"] = gdf["kab_kota"].str.strip()
gdf["prov"]     = gdf["prov"].str.strip()

# ── Join ──────────────────────────────────────────────────────────────────
merged = csv.merge(
    gdf[["kab_kota", "prov", "loss_flood_nonclimate_rp25"]],
    on=["kab_kota", "prov"],
    how="left",
)
merged.rename(columns={"loss_flood_nonclimate_rp25": "loss_banjir_baru"}, inplace=True)

has_flood   = merged["tinggi_genangan"] > 0
has_both    = has_flood & merged["loss_banjir_baru"].notna() & merged["loss_banjir_lama"].notna()

# ── LOP comparison ────────────────────────────────────────────────────────
lop = merged[has_flood][
    ["prov", "kab_kota", "tinggi_genangan", "lop_banjir_lama", "lop_banjir_baru"]
].copy()
lop["delta_lop"]     = lop["lop_banjir_baru"] - lop["lop_banjir_lama"]
lop["pct_lop"]       = (lop["delta_lop"] / lop["lop_banjir_lama"].abs() * 100).round(2)

# ── Loss comparison ───────────────────────────────────────────────────────
loss = merged[has_both][
    ["prov", "kab_kota", "loss_banjir_lama", "loss_banjir_baru"]
].copy()
loss["delta_loss"] = loss["loss_banjir_baru"] - loss["loss_banjir_lama"]
loss["pct_loss"]   = (loss["delta_loss"] / loss["loss_banjir_lama"].abs() * 100).round(2)

# ── Print ─────────────────────────────────────────────────────────────────
sep = "=" * 70

print(f"\n{sep}")
print("  CAKUPAN")
print(sep)
print(f"  Baris CSV total           : {len(csv)}")
print(f"  Punya tinggi_genangan > 0 : {has_flood.sum()}")
print(f"  Berhasil join ke run 44   : {has_both.sum()}")

print(f"\n{sep}")
print("  LOP — lama vs baru  (formula lama: dari Excel | baru: 0.29·ln(x)+0.52)")
print(sep)
pd.set_option("display.float_format", "{:.6f}".format)
pd.set_option("display.max_rows", 999)
pd.set_option("display.width", 120)
print(lop.to_string(index=False))

print(f"\n{sep}")
print("  LOSS Baseline RP25 — statistik selisih (Rp)")
print(sep)
pd.set_option("display.float_format", "{:,.0f}".format)
print(loss[["delta_loss", "pct_loss"]].describe().round(2))

print(f"\n{sep}")
print("  TOP 10 — kenaikan loss terbesar (baru > lama)")
print(sep)
print(
    loss.nlargest(10, "delta_loss")[
        ["prov", "kab_kota", "loss_banjir_lama", "loss_banjir_baru", "delta_loss", "pct_loss"]
    ].to_string(index=False)
)

print(f"\n{sep}")
print("  TOP 10 — penurunan loss terbesar (baru < lama)")
print(sep)
print(
    loss.nsmallest(10, "delta_loss")[
        ["prov", "kab_kota", "loss_banjir_lama", "loss_banjir_baru", "delta_loss", "pct_loss"]
    ].to_string(index=False)
)

print(f"\n{sep}")
print("  SEMUA — baris yang tidak bisa di-join (tidak ada di run 44)")
print(sep)
not_joined = merged[has_flood & merged["loss_banjir_baru"].isna()][["prov", "kab_kota"]]
if not_joined.empty:
    print("  Semua kabkota berhasil di-join.")
else:
    print(not_joined.to_string(index=False))
