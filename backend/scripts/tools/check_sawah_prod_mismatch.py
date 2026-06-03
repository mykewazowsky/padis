"""
check_sawah_prod_mismatch.py
Bandingkan tiga sumber data:
  A. File sawah lokal (sawah_admin_intersection.geojson) — polygon sawah
  B. Supabase regions_sawah — sawah yang sudah diupload
  C. Supabase production   — data produksi padi

Tampilkan selisih antar ketiganya.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import geopandas as gpd
import pandas as pd
from backend.scripts.utils.db import get_conn
from backend.scripts.config.settings import FILE_SAWAH, DATA_DIR
from backend.scripts.etl.load_production import format_id_kabkota

sep = "=" * 80

# ── A. File sawah lokal ───────────────────────────────────────────────────────
print(f"\n{sep}")
print("  A. FILE SAWAH LOKAL")
print(sep)
gdf = gpd.read_file(str(FILE_SAWAH))
gdf["id_kabkota"] = gdf["id_kabkota"].astype(str).str.strip().apply(format_id_kabkota)
local_ids = set(gdf["id_kabkota"].dropna().unique())
print(f"  Total polygon   : {len(gdf)}")
print(f"  Distinct kabkota: {len(local_ids)}")

# ── B. Supabase regions_sawah ─────────────────────────────────────────────────
conn = get_conn()
cur  = conn.cursor()

cur.execute("SELECT DISTINCT id_kabkota FROM regions_sawah")
db_sawah_ids = set(r[0] for r in cur.fetchall())
cur.execute("SELECT COUNT(*) FROM regions_sawah")
db_sawah_total = cur.fetchone()[0]

print(f"\n{sep}")
print("  B. SUPABASE regions_sawah")
print(sep)
print(f"  Total baris     : {db_sawah_total}")
print(f"  Distinct kabkota: {len(db_sawah_ids)}")

# ── C. Supabase production ────────────────────────────────────────────────────
cur.execute("SELECT id_kabkota, total_prod FROM production WHERE total_prod > 0")
prod_rows = cur.fetchall()
db_prod_ids = set(r[0] for r in prod_rows)
db_prod = {r[0]: r[1] for r in prod_rows}

print(f"\n{sep}")
print("  C. SUPABASE production (total_prod > 0)")
print(sep)
print(f"  Distinct kabkota: {len(db_prod_ids)}")

# ── Fetch nama kabkota untuk lookup ──────────────────────────────────────────
cur.execute("SELECT id_kabkota, kab_kota, prov FROM regions_adm")
adm = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

cur.close()
conn.close()

# ── D. CSV produksi lokal ─────────────────────────────────────────────────────
csv_path = DATA_DIR / "raw" / "exposure" / "totalproduksipadi.csv"
csv_df   = pd.read_csv(csv_path, dtype={"id_kabkota": str})
csv_df["id_kabkota"] = csv_df["id_kabkota"].apply(format_id_kabkota)
csv_df["total_prod"] = pd.to_numeric(csv_df["total_prod"], errors="coerce")
csv_ids = set(csv_df[csv_df["total_prod"] > 0]["id_kabkota"].dropna().unique())

print(f"\n{sep}")
print("  D. CSV PRODUKSI LOKAL (totalproduksipadi.csv, total_prod > 0)")
print(sep)
print(f"  Distinct kabkota: {len(csv_ids)}")

# ── Analisis selisih ──────────────────────────────────────────────────────────
def show_diff(title, ids_a, label_a, ids_b, label_b):
    only_a = sorted(ids_a - ids_b)
    only_b = sorted(ids_b - ids_a)
    both   = ids_a & ids_b
    print(f"\n{sep}")
    print(f"  {title}")
    print(sep)
    print(f"  Hanya di {label_a}  : {len(only_a)}")
    print(f"  Hanya di {label_b}  : {len(only_b)}")
    print(f"  Ada di keduanya     : {len(both)}")
    if only_a:
        print(f"\n  --- Hanya di {label_a} ---")
        for i in only_a:
            nm, pv = adm.get(i, ("?", "?"))
            prod = db_prod.get(i, csv_df[csv_df["id_kabkota"]==i]["total_prod"].sum() if i in csv_ids else 0)
            print(f"    {i:<12} {nm:<40} {pv:<25} prod={prod:,.0f}")
    if only_b:
        print(f"\n  --- Hanya di {label_b} ---")
        for i in only_b:
            nm, pv = adm.get(i, ("?", "?"))
            print(f"    {i:<12} {nm:<40} {pv:<25}")

show_diff(
    "LOKAL sawah  vs  DB production",
    local_ids, "lokal-sawah",
    db_prod_ids, "db-production"
)

show_diff(
    "DB sawah  vs  DB production",
    db_sawah_ids, "db-sawah",
    db_prod_ids, "db-production"
)

show_diff(
    "LOKAL sawah  vs  DB sawah  (upload gap?)",
    local_ids, "lokal-sawah",
    db_sawah_ids, "db-sawah"
)

show_diff(
    "CSV produksi lokal  vs  DB production  (normalisasi id?)",
    csv_ids, "csv-lokal",
    db_prod_ids, "db-production"
)
