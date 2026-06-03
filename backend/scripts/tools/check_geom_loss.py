"""check_geom_loss.py — investigasi hilangnya 31.9% area geometri saat intersection"""
import sys, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
import geopandas as gpd
import pandas as pd

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    raw = gpd.read_file(r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\exposure\sawah_selected.gpkg")
    reg = gpd.read_file(r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\administrasi\regions.gpkg")

sep = "=" * 75

# Area raw per provinsi
raw_utm = raw.to_crs("EPSG:32749")
raw_prov = raw_utm.groupby("KODE_PROV").apply(
    lambda g: g.geometry.area.sum() / 10_000
).rename("raw_ha")

# Overlay (tanpa dissolve)
print("Menjalankan overlay...")
result = gpd.overlay(
    raw[["KODE_PROV","geometry"]],
    reg[["id_kabkota","geometry"]],
    how="intersection", keep_geom_type=False
)
result = result[result.geometry.type.isin(["Polygon","MultiPolygon"])]
result_utm = result.to_crs("EPSG:32749")
print(f"Overlay selesai: {len(result)} polygon")

inter_prov = result_utm.groupby("KODE_PROV").apply(
    lambda g: g.geometry.area.sum() / 10_000
).rename("inter_ha")

compare = raw_prov.to_frame().join(inter_prov).fillna(0)
compare["hilang_ha"] = compare["raw_ha"] - compare["inter_ha"]
compare["pct"] = compare["hilang_ha"] / compare["raw_ha"] * 100
compare = compare.sort_values("hilang_ha", ascending=False)

print(f"\n{sep}")
print("  KEHILANGAN GEOMETRI PER PROVINSI (diurutkan dari terbesar)")
print(sep)
print(f"  {'Prov':>6} {'raw_ha':>12} {'inter_ha':>12} {'hilang_ha':>12} {'%hilang':>9}")
print(f"  {'-'*6} {'-'*12} {'-'*12} {'-'*12} {'-'*9}")
for prov, r in compare.iterrows():
    flag = " ⚠️" if r["pct"] > 20 else ""
    print(f"  {prov:>6} {r['raw_ha']:>12,.0f} {r['inter_ha']:>12,.0f} {r['hilang_ha']:>12,.0f} {r['pct']:>8.1f}%{flag}")

tot_raw   = compare["raw_ha"].sum()
tot_inter = compare["inter_ha"].sum()
tot_loss  = compare["hilang_ha"].sum()
print(f"\n  {'TOTAL':>6} {tot_raw:>12,.0f} {tot_inter:>12,.0f} {tot_loss:>12,.0f} {tot_loss/tot_raw*100:>8.1f}%")

print(f"\n{sep}")
print("  ANALISIS PENYEBAB")
print(sep)

# Cek apakah regions.gpkg mencakup seluruh daratan
reg_utm = reg.to_crs("EPSG:32749")
reg_area_ha = reg_utm.geometry.area.sum() / 10_000
print(f"  Total area regions.gpkg : {reg_area_ha:>12,.0f} ha")
print(f"  Total area sawah raw    : {tot_raw:>12,.0f} ha")
print(f"  Total area setelah inter: {tot_inter:>12,.0f} ha")
print()

# Provinsi dengan kehilangan > 20%
high_loss = compare[compare["pct"] > 20]
if not high_loss.empty:
    print(f"  Provinsi dengan kehilangan > 20%: {len(high_loss)}")
    for prov, r in high_loss.iterrows():
        print(f"    KODE_PROV={prov}: {r['hilang_ha']:,.0f} ha hilang ({r['pct']:.1f}%)")
else:
    print("  Tidak ada provinsi dengan kehilangan > 20%")
