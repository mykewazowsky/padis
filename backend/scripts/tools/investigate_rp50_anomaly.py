"""
investigate_rp50_anomaly.py
Investigasi anomali flood nonclimate RP50 = 0
untuk 11 kabkota Sulawesi Tenggara (74.xx).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import pandas as pd
import geopandas as gpd
from backend.scripts.utils.db import get_conn
from backend.scripts.config.settings import ZONAL_DIR

SUSPECTS = [
    "74.01","74.03","74.04","74.05","74.06",
    "74.08","74.10","74.12","74.13","74.71","74.72"
]
RUN_ID = 45
sep = "=" * 90

conn = get_conn()
cur  = conn.cursor()

# ── 1. Nilai di tabel zonal_kabupaten per RP (semua scenario) ─────────────────
print(f"\n{sep}")
print("  STEP 1 — DB: zonal_kabupaten (mean_value flood per RP & scenario)")
print(sep)

cur.execute("""
    SELECT zk.id_kabkota, r.kab_kota,
           s.name  AS scenario,
           rp.rp   AS rp,
           zk.mean_value
    FROM   zonal_kabupaten zk
    JOIN   hazards        h  ON zk.hazard_id  = h.id
    JOIN   scenarios      s  ON zk.scenario_id = s.id
    JOIN   return_periods rp ON zk.rp_id       = rp.id
    JOIN   regions_adm    r  ON zk.id_kabkota  = r.id_kabkota
    WHERE  h.name    = 'flood'
      AND  zk.run_id = %s
      AND  zk.id_kabkota = ANY(%s)
    ORDER  BY zk.id_kabkota, s.name, rp.rp
""", (RUN_ID, SUSPECTS))

rows = cur.fetchall()
df_zonal = pd.DataFrame(rows, columns=["id_kabkota","kab_kota","scenario","rp","mean_value"])

# Pivot: baris=kabkota, kolom=scenario_rp
pivot = df_zonal.pivot_table(
    index=["id_kabkota","kab_kota"],
    columns=["scenario","rp"],
    values="mean_value",
    aggfunc="mean"
)
pivot.columns = [f"{s}_rp{r}" for s, r in pivot.columns]
pivot = pivot.reset_index()

# Highlight nonclimate_rp50
nc_cols = [c for c in pivot.columns if c.startswith("nonclimate_")]
cl_cols = [c for c in pivot.columns if c.startswith("climate_")]

pd.set_option("display.float_format", "{:.4f}".format)
pd.set_option("display.max_columns", 20)
pd.set_option("display.width", 200)

print("\n  NONCLIMATE:")
print(pivot[["id_kabkota","kab_kota"] + sorted(nc_cols)].to_string(index=False))
print("\n  CLIMATE:")
print(pivot[["id_kabkota","kab_kota"] + sorted(cl_cols)].to_string(index=False))

# Deteksi anomali: nonclimate_rp50 = 0 tapi rp25/100/250 > 0
zero_nc50 = pivot[
    (pivot.get("nonclimate_rp50", pd.Series(dtype=float)).fillna(0) == 0) &
    (pivot.get("nonclimate_rp25", pd.Series(dtype=float)).fillna(0) > 0)
]
print(f"\n  Kabkota dengan nonclimate_rp50=0 tapi rp25>0: {len(zero_nc50)}")

# ── 2. Nilai di tabel losses per RP ──────────────────────────────────────────
print(f"\n{sep}")
print("  STEP 2 — DB: losses (flood nonclimate per RP)")
print(sep)

cur.execute("""
    SELECT l.id_kabkota, r.kab_kota,
           rp.rp, l.loss
    FROM   losses l
    JOIN   hazards        h  ON l.hazard_id  = h.id
    JOIN   scenarios      s  ON l.scenario_id = s.id
    JOIN   return_periods rp ON l.rp_id       = rp.id
    JOIN   regions_adm    r  ON l.id_kabkota  = r.id_kabkota
    WHERE  h.name  = 'flood'
      AND  s.name  = 'nonclimate'
      AND  l.run_id = %s
      AND  l.id_kabkota = ANY(%s)
    ORDER  BY l.id_kabkota, rp.rp
""", (RUN_ID, SUSPECTS))

loss_rows = cur.fetchall()
df_loss = pd.DataFrame(loss_rows, columns=["id_kabkota","kab_kota","rp","loss"])
pivot_loss = df_loss.pivot_table(
    index=["id_kabkota","kab_kota"], columns="rp", values="loss", aggfunc="mean"
)
pivot_loss.columns = [f"loss_rp{c}" for c in pivot_loss.columns]
pivot_loss = pivot_loss.reset_index()
pd.set_option("display.float_format", "{:,.0f}".format)
print(pivot_loss.to_string(index=False))

cur.close()
conn.close()

# ── 3. Cek GeoJSON flood_stats (sebelum masuk DB) ────────────────────────────
print(f"\n{sep}")
print("  STEP 3 — GeoJSON: flood_stats_from_db.geojson (zonal rekonstruksi)")
print(sep)

zonal_path = ZONAL_DIR / "flood_stats_from_db.geojson"
if not zonal_path.exists():
    print(f"  File tidak ditemukan: {zonal_path}")
    # Coba versi asli
    zonal_path = ZONAL_DIR / "flood_stats.geojson"
    print(f"  Coba flood_stats.geojson: {zonal_path}")

if zonal_path.exists():
    gdf = gpd.read_file(str(zonal_path))
    gdf["id_kabkota"] = gdf["id_kabkota"].astype(str).str.strip()
    subset = gdf[gdf["id_kabkota"].isin(SUSPECTS)]

    flood_cols = sorted([c for c in gdf.columns if c.startswith("mean_flood_")])
    print(f"  File: {zonal_path.name}")
    print(f"  Kolom flood: {flood_cols}")
    if not subset.empty:
        pd.set_option("display.float_format", "{:.4f}".format)
        print(subset[["id_kabkota"] + flood_cols].to_string(index=False))
    else:
        print("  Kabkota Sultra (74.xx) tidak ditemukan di file ini.")
else:
    print("  Kedua file tidak ditemukan.")

# ── 4. Ringkasan anomali ──────────────────────────────────────────────────────
print(f"\n{sep}")
print("  STEP 4 — POLA ANOMALI")
print(sep)
nc50 = df_zonal[(df_zonal["scenario"]=="nonclimate") & (df_zonal["rp"]==50)]
nc25 = df_zonal[(df_zonal["scenario"]=="nonclimate") & (df_zonal["rp"]==25)]
for _, r in nc50.iterrows():
    v25 = nc25[nc25["id_kabkota"]==r["id_kabkota"]]["mean_value"].values
    v25 = v25[0] if len(v25) else float("nan")
    flag = "⚠️  ANOMALI" if r["mean_value"] == 0 and v25 > 0 else "OK"
    print(f"  {r['id_kabkota']:<8} {r['kab_kota']:<35} rp25={v25:.4f}  rp50={r['mean_value']:.4f}  {flag}")
