"""
export_comparison_full.py
Export CSV perbandingan LENGKAP antara CSV eksternal dan DB run 45.
Mencakup:
  - Semua 444 baris yang matched
  - Baris yang hanya ada di CSV (tidak ada di DB)
  - Baris yang hanya ada di DB (tidak ada di CSV)
  - Semua kolom: mean, LOP, loss_csv (dihitung), loss_db, delta
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import pandas as pd
from backend.scripts.utils.db import get_conn
from backend.scripts.config.settings import GABAH_KERING_PANEN
from backend.scripts.analysis.drought.lop import drought_polynomial
from backend.scripts.etl.load_production import format_id_kabkota

CSV_PATH  = r"C:\Users\Asus\Downloads\gpm25_zonal_lop2.csv"
OUT_PATH  = r"C:\Users\Asus\Downloads\perbandingan_lengkap_csv_vs_db45.csv"
RUN_ID    = 45
GKP       = GABAH_KERING_PANEN   # 6_500_000

sep = "=" * 80

# ── 1. Load & normalise CSV ───────────────────────────────────────────────────
df_csv = pd.read_csv(CSV_PATH)
df_csv["id_kabkota_db"] = df_csv["id_kabkota"].apply(
    lambda x: format_id_kabkota(str(x / 100))
)
df_csv["total_prod_csv"] = pd.to_numeric(
    df_csv["totalproduksipadi_total_prod"], errors="coerce"
).fillna(0)

# LOP pipeline dari _mean (drought polynomial)
df_csv["lop_pipeline"] = df_csv["_mean"].apply(drought_polynomial)

# Loss dari CSV: pakai lop CSV * total_prod * GKP
df_csv["loss_dari_csv"] = df_csv["lop"].fillna(0) * df_csv["total_prod_csv"] * GKP

# Kolom bersih untuk merge
csv_clean = df_csv[[
    "id_kabkota_db", "kab_kota", "prov",
    "_mean", "lop", "lop_pipeline",
    "total_prod_csv", "loss_dari_csv",
]].copy()
csv_clean.columns = [
    "id_kabkota", "kab_kota", "prov",
    "mean_csv", "lop_csv", "lop_pipeline_csv",
    "total_prod_csv", "loss_csv",
]

print(f"CSV : {len(csv_clean)} baris")

# ── 2. Fetch DB ───────────────────────────────────────────────────────────────
conn = get_conn()
cur  = conn.cursor()

cur.execute("""
    SELECT
        zk.id_kabkota,
        r.kab_kota,
        r.prov,
        zk.mean_value                       AS mean_db,
        l.loss                              AS loss_db,
        p.total_prod                        AS total_prod_db
    FROM   zonal_kabupaten zk
    JOIN   hazards        h  ON zk.hazard_id  = h.id
    JOIN   scenarios      s  ON zk.scenario_id = s.id
    JOIN   return_periods rp ON zk.rp_id       = rp.id
    JOIN   regions_adm    r  ON zk.id_kabkota  = r.id_kabkota
    LEFT JOIN losses l ON l.id_kabkota  = zk.id_kabkota
                       AND l.hazard_id  = zk.hazard_id
                       AND l.scenario_id= zk.scenario_id
                       AND l.rp_id      = zk.rp_id
                       AND l.run_id     = zk.run_id
    LEFT JOIN production p ON p.id_kabkota = zk.id_kabkota
    WHERE  h.name   = 'drought'
      AND  s.name   = 'nonclimate'
      AND  rp.rp    = 25
      AND  zk.run_id = %s
""", (RUN_ID,))

db_rows = cur.fetchall()
cur.close()
conn.close()

df_db = pd.DataFrame(db_rows, columns=[
    "id_kabkota","kab_kota_db","prov_db","mean_db","loss_db","total_prod_db"
])

# Hitung LOP DB dari mean_db menggunakan formula pipeline
df_db["lop_db"] = df_db["mean_db"].apply(
    lambda x: drought_polynomial(x) if pd.notna(x) else np.nan
)

print(f"DB  : {len(df_db)} baris")

# ── 3. Outer join: matched + unmatched keduanya ───────────────────────────────
merged = csv_clean.merge(
    df_db[["id_kabkota","mean_db","lop_db","loss_db","total_prod_db"]],
    on="id_kabkota",
    how="outer",
    indicator=True
)

# Label status
merged["status"] = merged["_merge"].map({
    "both":       "matched",
    "left_only":  "hanya_di_csv",
    "right_only": "hanya_di_db",
})
merged.drop(columns="_merge", inplace=True)

print(f"\nStatus breakdown:")
print(merged["status"].value_counts().to_string())

# ── 4. Hitung delta ───────────────────────────────────────────────────────────
merged["delta_mean"]      = merged["mean_db"]  - merged["mean_csv"]
merged["delta_lop"]       = merged["lop_db"]   - merged["lop_pipeline_csv"]
merged["delta_loss"]      = merged["loss_db"]  - merged["loss_csv"]

merged["pct_delta_mean"]  = (
    merged["delta_mean"] / merged["mean_csv"].replace(0, np.nan) * 100
)
merged["pct_delta_loss"]  = (
    merged["delta_loss"] / merged["loss_csv"].replace(0, np.nan) * 100
)

# ── 5. Susun kolom final ──────────────────────────────────────────────────────
out = merged[[
    "status",
    "id_kabkota",
    "kab_kota",
    "prov",

    # Mean value
    "mean_csv",
    "mean_db",
    "delta_mean",
    "pct_delta_mean",

    # LOP
    "lop_csv",
    "lop_pipeline_csv",
    "lop_db",
    "delta_lop",

    # Produksi
    "total_prod_csv",
    "total_prod_db",

    # Loss
    "loss_csv",
    "loss_db",
    "delta_loss",
    "pct_delta_loss",
]].copy()

out = out.rename(columns={
    "mean_csv":          "mean_zonal_csv",
    "mean_db":           "mean_zonal_db",
    "lop_csv":           "lop_csv_original",
    "lop_pipeline_csv":  "lop_pipeline_dari_mean_csv",
    "lop_db":            "lop_pipeline_dari_mean_db",
    "loss_csv":          "loss_dihitung_dari_csv",
    "loss_db":           "loss_db_run45",
    "delta_loss":        "delta_loss_db_min_csv",
    "pct_delta_loss":    "pct_delta_loss",
})

# Sort: matched dulu, lalu selisih loss terbesar
out_matched  = out[out["status"] == "matched"].sort_values(
    "delta_loss_db_min_csv", key=abs, ascending=False
)
out_csv_only = out[out["status"] == "hanya_di_csv"].sort_values("kab_kota")
out_db_only  = out[out["status"] == "hanya_di_db"].sort_values("id_kabkota")

out_final = pd.concat([out_matched, out_csv_only, out_db_only], ignore_index=True)

# Format angka Rupiah dalam miliar (agar mudah dibaca)
rupiah_cols = ["loss_dihitung_dari_csv","loss_db_run45","delta_loss_db_min_csv"]
for col in rupiah_cols:
    out_final[f"{col}_miliar"] = (out_final[col] / 1e9).round(3)

# ── 6. Export ─────────────────────────────────────────────────────────────────
out_final.to_csv(OUT_PATH, index=False, float_format="%.6f", encoding="utf-8-sig")

print(f"\n{sep}")
print(f"  Export selesai → {OUT_PATH}")
print(f"  Total baris : {len(out_final)}")
print(f"  Matched     : {len(out_matched)}")
print(f"  CSV only    : {len(out_csv_only)}")
print(f"  DB only     : {len(out_db_only)}")
print(sep)

# ── 7. Ringkasan statistik ────────────────────────────────────────────────────
matched = out_final[out_final["status"] == "matched"]

print(f"\n  STATISTIK SELISIH (matched, n={len(matched)})")
print(f"  {'Metrik':<35} {'Min':>15} {'Max':>15} {'Mean':>15}")
print(f"  {'-'*35} {'-'*15} {'-'*15} {'-'*15}")
for col, label in [
    ("delta_mean",        "Δ mean_zonal"),
    ("pct_delta_mean",    "Δ mean (%)"),
    ("delta_lop",         "Δ LOP"),
    ("delta_loss_db_min_csv",  "Δ loss (Rp)"),
    ("pct_delta_loss",    "Δ loss (%)"),
]:
    s = matched[col].dropna()
    print(f"  {label:<35} {s.min():>15,.2f} {s.max():>15,.2f} {s.mean():>15,.2f}")

print(f"\n  Baris hanya di CSV (id_kabkota tidak ada di DB):")
if not out_csv_only.empty:
    for _, r in out_csv_only.iterrows():
        print(f"    {r['id_kabkota']:<10} {r['kab_kota']}")
else:
    print("    Tidak ada")

print(f"\n  Baris hanya di DB (id_kabkota tidak ada di CSV):")
if not out_db_only.empty:
    for _, r in out_db_only.iterrows():
        print(f"    {r['id_kabkota']:<10} {r['kab_kota_db'] if 'kab_kota_db' in r else ''}")
else:
    print("    Tidak ada")
