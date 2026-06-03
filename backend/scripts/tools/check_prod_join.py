"""
check_prod_join.py
Cek mengapa total_prod = 0 untuk kabkota suspect di flood pipeline,
padahal drought berhasil. Bandingkan id_kabkota antara:
  - flood_stats_from_db.geojson  (rekonstruksi dari Supabase)
  - drought_stats_from_db.geojson
  - totalproduksipadi.csv
"""
import sys
from pathlib import Path
_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import pandas as pd
import geopandas as gpd
from backend.scripts.config.settings import DATA_DIR, ZONAL_DIR

SUSPECTS = [
    "Majalengka", "Jepara", "Klaten", "Banyuwangi", "Magetan",
    "Melawi", "Tanah Bumbu", "Pangkajene Dan Kepulauan", "Sigi",
    "Buton Utara", "Bolaang Mongondow Timur", "Gunung Mas",
]

sep = "=" * 80

# ── Load produksi ─────────────────────────────────────────────────────────
prod = pd.read_csv(
    DATA_DIR / "raw" / "exposure" / "totalproduksipadi.csv",
    dtype={"id_kabkota": str}
)
prod["id_kabkota"] = prod["id_kabkota"].str.strip()

# ── Load flood zonal rekonstruksi ─────────────────────────────────────────
flood_z = gpd.read_file(str(ZONAL_DIR / "flood_stats_from_db.geojson"))
flood_z["kab_kota"]   = flood_z["kab_kota"].str.strip()
flood_z["id_kabkota"] = flood_z["id_kabkota"].astype(str).str.strip()

# ── Load drought zonal rekonstruksi ───────────────────────────────────────
drought_z = gpd.read_file(str(ZONAL_DIR / "drought_stats_from_db.geojson"))
drought_z["kab_kota"]   = drought_z["kab_kota"].str.strip()
drought_z["id_kabkota"] = drought_z["id_kabkota"].astype(str).str.strip()

# ── Filter suspects ───────────────────────────────────────────────────────
flood_s   = flood_z[flood_z["kab_kota"].isin(SUSPECTS)][["kab_kota","id_kabkota"]].drop_duplicates()
drought_s = drought_z[drought_z["kab_kota"].isin(SUSPECTS)][["kab_kota","id_kabkota"]].drop_duplicates()

# ── Merge dengan produksi ─────────────────────────────────────────────────
flood_s   = flood_s.merge(prod[["id_kabkota","total_prod"]], on="id_kabkota", how="left")
drought_s = drought_s.merge(prod[["id_kabkota","total_prod"]], on="id_kabkota", how="left")

print(f"\n{sep}")
print("  id_kabkota di flood_stats_from_db vs drought_stats_from_db vs produksi CSV")
print(sep)
print(f"  {'Kabkota':<40} {'id_flood':>12} {'id_drought':>12} {'id_ada_di_prod?':>18} {'total_prod flood':>18} {'total_prod drought':>20}")
print(f"  {'-'*40} {'-'*12} {'-'*12} {'-'*18} {'-'*18} {'-'*20}")

for kab in SUSPECTS:
    f_row = flood_s[flood_s["kab_kota"] == kab]
    d_row = drought_s[drought_s["kab_kota"] == kab]

    f_id   = f_row["id_kabkota"].values[0]  if not f_row.empty else "TIDAK ADA"
    d_id   = d_row["id_kabkota"].values[0]  if not d_row.empty else "TIDAK ADA"
    f_prod = f_row["total_prod"].values[0]  if not f_row.empty else float("nan")
    d_prod = d_row["total_prod"].values[0]  if not d_row.empty else float("nan")

    in_prod = "YA" if f_id in prod["id_kabkota"].values else "TIDAK"

    f_prod_str = f"{f_prod:>18,.0f}" if f_prod == f_prod else f"{'NaN':>18}"
    d_prod_str = f"{d_prod:>20,.0f}" if d_prod == d_prod else f"{'NaN':>20}"

    print(f"  {kab:<40} {f_id:>12} {d_id:>12} {in_prod:>18} {f_prod_str} {d_prod_str}")

print(f"\n{sep}")
print("  SAMPLE id_kabkota di produksi CSV (untuk suspects prov Jawa Barat/Tengah/Timur)")
print(sep)
sample = prod[prod["id_kabkota"].str.startswith(("32","33","35"))].head(20)
print(sample[["id_kabkota","total_prod"]].to_string(index=False))
