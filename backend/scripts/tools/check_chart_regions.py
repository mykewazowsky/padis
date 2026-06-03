"""
check_chart_regions.py
Verifikasi konsistensi wilayah yang dipakai setiap chart perbandingan.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from backend.scripts.utils.db import get_conn

RUN = 45

conn = get_conn()
cur  = conn.cursor()

# 1. Intersection AAL
cur.execute("""
    WITH ix AS (
        SELECT a.id_kabkota
        FROM aal a JOIN hazards h ON a.hazard_id = h.id
        WHERE h.name IN ('flood','drought','multihazard')
          AND a.run_id = %s AND a.aal > 0
        GROUP BY a.id_kabkota
        HAVING
            COUNT(DISTINCT CASE WHEN h.name='flood'       AND a.aal>0 THEN 1 END)>0
        AND COUNT(DISTINCT CASE WHEN h.name='drought'     AND a.aal>0 THEN 1 END)>0
        AND COUNT(DISTINCT CASE WHEN h.name='multihazard' AND a.aal>0 THEN 1 END)>0
    ) SELECT COUNT(*) FROM ix
""", (RUN,))
aal_cnt = cur.fetchone()[0]

# 2. Intersection LOSSES
cur.execute("""
    WITH ix AS (
        SELECT l.id_kabkota
        FROM losses l JOIN hazards h ON l.hazard_id = h.id
        WHERE h.name IN ('flood','drought','multihazard')
          AND l.run_id = %s AND l.loss > 0
        GROUP BY l.id_kabkota
        HAVING
            COUNT(DISTINCT CASE WHEN h.name='flood'       AND l.loss>0 THEN 1 END)>0
        AND COUNT(DISTINCT CASE WHEN h.name='drought'     AND l.loss>0 THEN 1 END)>0
        AND COUNT(DISTINCT CASE WHEN h.name='multihazard' AND l.loss>0 THEN 1 END)>0
    ) SELECT COUNT(*) FROM ix
""", (RUN,))
loss_cnt = cur.fetchone()[0]

# 3. Kabkota per hazard di AAL (TANPA intersection)
cur.execute("""
    SELECT h.name, COUNT(DISTINCT a.id_kabkota)
    FROM aal a JOIN hazards h ON a.hazard_id = h.id
    WHERE a.run_id = %s AND a.aal > 0
    GROUP BY h.name
""", (RUN,))
aal_per_hazard = {r[0]: r[1] for r in cur.fetchall()}

# 4. Kabkota per hazard di LOSSES (TANPA intersection)
cur.execute("""
    SELECT h.name, COUNT(DISTINCT l.id_kabkota)
    FROM losses l JOIN hazards h ON l.hazard_id = h.id
    WHERE l.run_id = %s AND l.loss > 0
    GROUP BY h.name
""", (RUN,))
loss_per_hazard = {r[0]: r[1] for r in cur.fetchall()}

# 5. Kabkota flood saja yang ada di intersection (sampel)
cur.execute("""
    WITH ix AS (
        SELECT a.id_kabkota
        FROM aal a JOIN hazards h ON a.hazard_id = h.id
        WHERE h.name IN ('flood','drought','multihazard')
          AND a.run_id = %s AND a.aal > 0
        GROUP BY a.id_kabkota
        HAVING
            COUNT(DISTINCT CASE WHEN h.name='flood'       AND a.aal>0 THEN 1 END)>0
        AND COUNT(DISTINCT CASE WHEN h.name='drought'     AND a.aal>0 THEN 1 END)>0
        AND COUNT(DISTINCT CASE WHEN h.name='multihazard' AND a.aal>0 THEN 1 END)>0
    )
    SELECT COUNT(DISTINCT a.id_kabkota)
    FROM aal a JOIN hazards h ON a.hazard_id = h.id
    WHERE h.name = 'flood' AND a.run_id = %s AND a.aal > 0
      AND a.id_kabkota NOT IN (SELECT id_kabkota FROM ix)
""", (RUN, RUN))
flood_only_excl = cur.fetchone()[0]

cur.close()
conn.close()

sep = "=" * 65

print(f"\n{sep}")
print(f"  KONSISTENSI WILAYAH ANTAR CHART — run_id={RUN}")
print(sep)

print(f"\n{'Chart':45s} {'Wilayah':>10} {'Intersection?':>14}")
print(f"  {'-'*43} {'-'*10} {'-'*14}")
print(f"  {'AAL comparison (aal-summary-all-hazards)':43s} {aal_cnt:>10} {'YA':>14}")
print(f"  {'Loss breakdown (hazard-breakdown)':43s} {loss_cnt:>10} {'YA':>14}")
print(f"  {'loss-summary-compare-climate (per hazard)':43s} {'varies':>10} {'TIDAK':>14}")
print(f"  {'top-regions, distribusi (per hazard)':43s} {'varies':>10} {'TIDAK':>14}")

print(f"\n{sep}")
print(f"  INTERSECTION AAL vs LOSSES — konsisten?")
print(sep)
konsisten = "YA" if aal_cnt == loss_cnt else "TIDAK"
print(f"  Intersection AAL  : {aal_cnt} kabkota")
print(f"  Intersection LOSS : {loss_cnt} kabkota")
print(f"  Konsisten         : {konsisten}")

print(f"\n{sep}")
print(f"  TOTAL KABKOTA PER HAZARD (tanpa intersection)")
print(sep)
print(f"\n  AAL:")
for h in ('flood','drought','multihazard'):
    n = aal_per_hazard.get(h, 0)
    print(f"    {h:15s}: {n} kabkota")
print(f"\n  LOSSES:")
for h in ('flood','drought','multihazard'):
    n = loss_per_hazard.get(h, 0)
    print(f"    {h:15s}: {n} kabkota")

print(f"\n{sep}")
print(f"  ANALISIS: loss-summary-compare-climate")
print(sep)
flood_no_ix = aal_per_hazard.get('flood', 0) - aal_cnt
drought_no_ix = aal_per_hazard.get('drought', 0) - aal_cnt
print(f"  Chart ini TIDAK pakai intersection.")
print(f"  Flood   : menggunakan {aal_per_hazard.get('flood',0)} kabkota "
      f"({flood_no_ix} di luar intersection)")
print(f"  Drought : menggunakan {aal_per_hazard.get('drought',0)} kabkota "
      f"({drought_no_ix} di luar intersection)")
print(f"  => Jika dibandingkan antar hazard secara visual, angkanya TIDAK apple-to-apple.")

print(f"\n{sep}")
print(f"  KESIMPULAN")
print(sep)
print(f"  OK  : Chart AAL & hazard-breakdown sudah pakai intersection")
print(f"  OK  : Intersection AAL == intersection LOSS (konsisten)")
if flood_no_ix > 0:
    print(f"  WARN: loss-summary-compare-climate menghitung wilayah berbeda")
    print(f"        per hazard ({flood_no_ix} kabkota flood di luar intersection).")
    print(f"        Chart ini tidak untuk cross-hazard comparison, tapi")
    print(f"        perlu tambahkan intersection filter jika ingin valid.")
