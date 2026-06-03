"""
check_prod_no_sawah.py
Cek kabkota yang punya total_prod > 0 di tabel production
tapi tidak memiliki data sawah di tabel regions_sawah.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from backend.scripts.utils.db import get_conn

conn = get_conn()
cur  = conn.cursor()

# Kabkota dengan produksi > 0 tapi TIDAK ada di regions_sawah
cur.execute("""
    SELECT p.id_kabkota, r.kab_kota, r.prov, p.total_prod
    FROM production p
    JOIN regions_adm r ON p.id_kabkota = r.id_kabkota
    WHERE p.total_prod > 0
      AND p.id_kabkota NOT IN (
          SELECT DISTINCT id_kabkota FROM regions_sawah
      )
    ORDER BY p.total_prod DESC
""")
rows = cur.fetchall()

# Total counts
cur.execute("SELECT COUNT(DISTINCT id_kabkota) FROM production WHERE total_prod > 0")
total_prod = cur.fetchone()[0]

cur.execute("SELECT COUNT(DISTINCT id_kabkota) FROM regions_sawah")
total_sawah = cur.fetchone()[0]

# Kabkota dengan sawah tapi TIDAK ada di production (kebalikannya)
cur.execute("""
    SELECT s.id_kabkota, r.kab_kota, r.prov
    FROM regions_sawah s
    JOIN regions_adm r ON s.id_kabkota = r.id_kabkota
    WHERE s.id_kabkota NOT IN (
        SELECT id_kabkota FROM production WHERE total_prod > 0
    )
    GROUP BY s.id_kabkota, r.kab_kota, r.prov
    ORDER BY r.prov, r.kab_kota
""")
sawah_no_prod = cur.fetchall()

cur.close()
conn.close()

sep = "=" * 90

print(f"\n{sep}")
print("  RINGKASAN")
print(sep)
print(f"  Kabkota dengan total_prod > 0 : {total_prod}")
print(f"  Kabkota dengan data sawah     : {total_sawah}")
print(f"  Punya produksi TAPI tidak ada sawah : {len(rows)}")
print(f"  Punya sawah TAPI tidak ada produksi : {len(sawah_no_prod)}")

print(f"\n{sep}")
print("  KABKOTA YANG PUNYA PRODUKSI TAPI TIDAK ADA SAWAH")
print(sep)
if rows:
    print(f"  {'id_kabkota':<12} {'kab_kota':<40} {'prov':<25} {'total_prod':>15}")
    print(f"  {'-'*12} {'-'*40} {'-'*25} {'-'*15}")
    for r in rows:
        print(f"  {r[0]:<12} {r[1]:<40} {r[2]:<25} {r[3]:>15,.2f}")
else:
    print("  Tidak ada.")

print(f"\n{sep}")
print("  KABKOTA YANG PUNYA SAWAH TAPI TIDAK ADA DATA PRODUKSI")
print(sep)
if sawah_no_prod:
    print(f"  {'id_kabkota':<12} {'kab_kota':<40} {'prov':<25}")
    print(f"  {'-'*12} {'-'*40} {'-'*25}")
    for r in sawah_no_prod:
        print(f"  {r[0]:<12} {r[1]:<40} {r[2]:<25}")
else:
    print("  Tidak ada.")
