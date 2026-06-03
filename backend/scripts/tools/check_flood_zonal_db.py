"""
check_flood_zonal_db.py

Cek nilai mean_flood (semua RP) di tabel zonal_kabupaten Supabase
untuk kabkota yang loss banjirnya 0 di run 44.
Bandingkan langsung dengan nilai di CSV (tinggi_genangan = mean_flood_r25 nonclimate).
"""

import sys
from pathlib import Path
_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd
from backend.scripts.utils.db import get_conn

RUN_ID = 41

SUSPECTS = [
    "Majalengka", "Banyuwangi", "Magetan", "Klaten", "Jepara",
    "Pangkajene Dan Kepulauan", "Sigi", "Tanah Bumbu", "Melawi", "Buton Utara",
]

CSV_GENANGAN = {
    "Majalengka":                   1.401278207,
    "Banyuwangi":                   0.970630097,
    "Magetan":                      3.337941829,
    "Klaten":                       1.08374997,
    "Jepara":                       0.930695004,
    "Pangkajene Dan Kepulauan":     0.860201631,
    "Sigi":                         0.686821857,
    "Tanah Bumbu":                  0.654240601,
    "Melawi":                       1.740402552,
    "Buton Utara":                  2.345764011,
}

sep = "=" * 80

conn = get_conn()
cur  = conn.cursor()

# Ambil semua mean_flood dari zonal_kabupaten untuk run 41
cur.execute("""
    SELECT r.kab_kota    AS region_name,
           s.name        AS scenario,
           rp.rp         AS rp,
           zk.mean_value
    FROM   zonal_kabupaten zk
    JOIN   hazards        h  ON zk.hazard_id  = h.id
    JOIN   scenarios      s  ON zk.scenario_id = s.id
    JOIN   return_periods rp ON zk.rp_id       = rp.id
    JOIN   regions_adm    r  ON zk.id_kabkota  = r.id_kabkota
    WHERE  h.name    = 'flood'
      AND  zk.run_id = %s
    ORDER  BY r.kab_kota, s.name, rp.rp
""", (RUN_ID,))

rows = cur.fetchall()
cur.close()
conn.close()

df = pd.DataFrame(rows, columns=["region_name", "scenario", "rp", "mean_value"])

# Filter ke suspects saja
suspects_df = df[df["region_name"].isin(SUSPECTS)].copy()

pd.set_option("display.float_format", "{:.6f}".format)
pd.set_option("display.max_rows", 999)
pd.set_option("display.width", 120)

print(f"\n{sep}")
print(f"  NILAI mean_flood di Supabase run_id={RUN_ID} untuk kabkota suspect")
print(sep)

if suspects_df.empty:
    print("  Tidak ada data flood sama sekali untuk kabkota ini di run 41!")
else:
    # Pivot: baris=region, kolom=scenario+rp
    pivot = suspects_df.pivot_table(
        index="region_name",
        columns=["scenario", "rp"],
        values="mean_value",
        aggfunc="mean"
    )
    pivot.columns = [f"{s}_rp{r}" for s, r in pivot.columns]
    print(pivot.to_string())

print(f"\n{sep}")
print(f"  PERBANDINGAN: mean_flood Supabase run 41 vs tinggi_genangan CSV (nonclimate RP25)")
print(sep)
print(f"  {'Kabkota':<40} {'Supabase nonclimate_rp25':>25} {'CSV tinggi_genangan':>22} {'Selisih':>12}")
print(f"  {'-'*40} {'-'*25} {'-'*22} {'-'*12}")

for kab, csv_val in CSV_GENANGAN.items():
    row = suspects_df[
        (suspects_df["region_name"] == kab) &
        (suspects_df["scenario"] == "nonclimate") &
        (suspects_df["rp"] == 25)
    ]
    db_val = row["mean_value"].values[0] if not row.empty else np.nan
    selisih = db_val - csv_val if not np.isnan(db_val) else float("nan")
    db_str  = f"{db_val:>25.6f}" if not np.isnan(db_val) else f"{'TIDAK ADA':>25}"
    print(f"  {kab:<40} {db_str} {csv_val:>22.6f} {selisih:>12.6f}" if not np.isnan(selisih)
          else f"  {kab:<40} {db_str} {csv_val:>22.6f} {'N/A':>12}")

print(f"\n{sep}")
print(f"  KABKOTA YANG SAMA SEKALI TIDAK ADA di zonal_kabupaten run {RUN_ID}")
print(sep)
found = set(suspects_df["region_name"].unique())
missing = [k for k in SUSPECTS if k not in found]
print(f"  {missing if missing else 'Semua ada.'}")
