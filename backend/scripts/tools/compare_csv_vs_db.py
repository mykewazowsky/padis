"""
compare_csv_vs_db.py
Bandingkan mean_value, LOP, dan loss antara:
  - CSV  : gpm25_zonal_lop2.csv  (sumber eksternal)
  - DB   : run_id=45 (Supabase)

Hitung juga loss dari CSV menggunakan rumus:
    loss = lop * total_prod * GABAH_KERING_PANEN
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import pandas as pd
from backend.scripts.utils.db import get_conn
from backend.scripts.config.settings import GABAH_KERING_PANEN
from backend.scripts.analysis.drought.lop import drought_polynomial

CSV_PATH = r"C:\Users\Asus\Downloads\gpm25_zonal_lop2.csv"
RUN_ID   = 45
sep = "=" * 100

# ── 1. Load CSV ───────────────────────────────────────────────────────────────
df_csv = pd.read_csv(CSV_PATH)
print(f"\n{sep}")
print("  CSV: gpm25_zonal_lop2.csv")
print(sep)
print(f"  Baris      : {len(df_csv)}")
print(f"  _mean range: {df_csv['_mean'].min():.4f} – {df_csv['_mean'].max():.4f}")
print(f"  lop range  : {df_csv['lop'].min():.4f} – {df_csv['lop'].max():.4f}")

# Normalisasi id_kabkota: 7173 → "71.73"
df_csv["id_kabkota_db"] = df_csv["id_kabkota"].apply(lambda x: f"{x/100:.2f}")
df_csv["total_prod"]    = pd.to_numeric(df_csv["totalproduksipadi_total_prod"], errors="coerce").fillna(0)

# Hitung loss dari CSV: lop * total_prod * GKP
df_csv["loss_csv"] = df_csv["lop"] * df_csv["total_prod"] * GABAH_KERING_PANEN

# Hitung LOP ulang dari _mean menggunakan formula aktif pipeline
# Alur: mean_zonal → DI = mean → LOP = drought_polynomial(DI)
df_csv["lop_pipeline"] = df_csv["_mean"].apply(drought_polynomial)

print(f"\n  lop_pipeline (formula saat ini) range: "
      f"{df_csv['lop_pipeline'].min():.4f} – {df_csv['lop_pipeline'].max():.4f}")
print(f"  lop_csv (dari CSV) range              : "
      f"{df_csv['lop'].min():.4f} – {df_csv['lop'].max():.4f}")
delta_lop = (df_csv["lop_pipeline"] - df_csv["lop"]).abs()
print(f"  Delta LOP max: {delta_lop.max():.6f}  mean: {delta_lop.mean():.6f}")

# ── 2. Fetch DB: deteksi hazard & scenario ────────────────────────────────────
conn = get_conn()
cur  = conn.cursor()

# Coba cocokkan mean_value di DB untuk beberapa kombinasi
print(f"\n{sep}")
print("  Deteksi hazard/scenario yang cocok dengan CSV")
print(sep)

sample_ids = df_csv["id_kabkota_db"].head(10).tolist()

cur.execute("""
    SELECT h.name AS hazard, s.name AS scenario, rp.rp,
           AVG(zk.mean_value) AS avg_mean
    FROM   zonal_kabupaten zk
    JOIN   hazards        h  ON zk.hazard_id  = h.id
    JOIN   scenarios      s  ON zk.scenario_id = s.id
    JOIN   return_periods rp ON zk.rp_id       = rp.id
    WHERE  zk.run_id = %s
      AND  zk.id_kabkota = ANY(%s)
      AND  zk.mean_value > 0
    GROUP  BY h.name, s.name, rp.rp
    ORDER  BY h.name, s.name, rp.rp
""", (RUN_ID, sample_ids))

print(f"  {'hazard':<15} {'scenario':<15} {'rp':>6} {'avg_mean_db':>14}")
print(f"  {'-'*15} {'-'*15} {'-'*6} {'-'*14}")
for row in cur.fetchall():
    print(f"  {row[0]:<15} {row[1]:<15} {row[2]:>6} {row[3]:>14.4f}")

csv_avg_mean = df_csv["_mean"].mean()
print(f"\n  CSV avg _mean (semua baris): {csv_avg_mean:.4f}")

# ── 3. Fetch DB: drought nonclimate RP25 (paling mungkin cocok) ──────────────
print(f"\n{sep}")
print("  Fetch DB: drought nonclimate RP25, run_id=45")
print(sep)

cur.execute("""
    SELECT zk.id_kabkota,
           zk.mean_value  AS mean_db,
           a.aal          AS aal_db,
           l.loss         AS loss_db
    FROM   zonal_kabupaten zk
    JOIN   hazards        h  ON zk.hazard_id  = h.id
    JOIN   scenarios      s  ON zk.scenario_id = s.id
    JOIN   return_periods rp ON zk.rp_id       = rp.id
    LEFT JOIN losses l ON l.id_kabkota = zk.id_kabkota
                       AND l.hazard_id = zk.hazard_id
                       AND l.scenario_id = zk.scenario_id
                       AND l.rp_id = zk.rp_id
                       AND l.run_id = zk.run_id
    LEFT JOIN aal a ON a.id_kabkota = zk.id_kabkota
                    AND a.hazard_id = zk.hazard_id
                    AND a.scenario_id = zk.scenario_id
                    AND a.run_id = zk.run_id
    WHERE  h.name  = 'drought'
      AND  s.name  = 'nonclimate'
      AND  rp.rp   = 25
      AND  zk.run_id = %s
""", (RUN_ID,))

db_rows = cur.fetchall()
cur.close()
conn.close()

df_db = pd.DataFrame(db_rows, columns=["id_kabkota_db", "mean_db", "aal_db", "loss_db"])
print(f"  Baris DB  : {len(df_db)}")

# ── 4. Join CSV dengan DB ─────────────────────────────────────────────────────
merged = df_csv.merge(df_db, on="id_kabkota_db", how="inner")
print(f"  Berhasil join: {len(merged)} baris")

if merged.empty:
    print("  Tidak ada yang cocok — coba hazard/scenario lain")
    sys.exit(0)

# ── 5. Hitung selisih ─────────────────────────────────────────────────────────
merged["delta_mean"]      = merged["mean_db"]  - merged["_mean"]
merged["delta_lop"]       = merged["lop_pipeline"] - merged["lop"]
merged["delta_loss"]      = merged["loss_db"]  - merged["loss_csv"]
merged["pct_delta_mean"]  = (merged["delta_mean"]  / merged["_mean"].replace(0, np.nan) * 100)
merged["pct_delta_loss"]  = (merged["delta_loss"]  / merged["loss_csv"].replace(0, np.nan) * 100)

# ── 6. Statistik ringkasan ────────────────────────────────────────────────────
pd.set_option("display.float_format", "{:,.4f}".format)

print(f"\n{sep}")
print("  STATISTIK SELISIH (DB run45 − CSV)")
print(sep)
print(f"\n  {'Metrik':<25} {'Min':>14} {'Max':>14} {'Mean':>14} {'Std':>14}")
print(f"  {'-'*25} {'-'*14} {'-'*14} {'-'*14} {'-'*14}")
for col, label in [
    ("delta_mean",     "Δ mean_value"),
    ("pct_delta_mean", "Δ mean (%)"),
    ("delta_lop",      "Δ LOP"),
    ("delta_loss",     "Δ loss (Rp)"),
    ("pct_delta_loss", "Δ loss (%)"),
]:
    s = merged[col].dropna()
    print(f"  {label:<25} {s.min():>14,.4f} {s.max():>14,.4f} "
          f"{s.mean():>14,.4f} {s.std():>14,.4f}")

# ── 7. Top 10 selisih loss terbesar ──────────────────────────────────────────
print(f"\n{sep}")
print("  TOP 10 — selisih loss terbesar (absolut)")
print(sep)
top = merged.reindex(merged["delta_loss"].abs().nlargest(10).index)
pd.set_option("display.float_format", "{:,.2f}".format)
cols_show = ["id_kabkota_db","kab_kota","_mean","mean_db","delta_mean",
             "lop","lop_pipeline","delta_lop",
             "loss_csv","loss_db","delta_loss","pct_delta_loss"]
print(top[cols_show].rename(columns={
    "_mean":"mean_csv","lop":"lop_csv","lop_pipeline":"lop_db_formula"
}).to_string(index=False))

# ── 8. Export CSV hasil ───────────────────────────────────────────────────────
out_path = r"C:\Users\Asus\Downloads\comparison_csv_vs_db45.csv"
export_cols = [
    "id_kabkota_db","kab_kota","prov",
    "_mean","mean_db","delta_mean","pct_delta_mean",
    "lop","lop_pipeline","delta_lop",
    "loss_csv","loss_db","delta_loss","pct_delta_loss",
    "total_prod",
]
merged[export_cols].rename(columns={
    "_mean":"mean_csv", "lop":"lop_csv", "lop_pipeline":"lop_db_formula"
}).to_csv(out_path, index=False, float_format="%.6f")
print(f"\n  Export lengkap → {out_path}")
