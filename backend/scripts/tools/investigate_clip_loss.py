"""
investigate_clip_loss.py
Investigasi MENGAPA 31.9% area hilang di strict clip intersection.
Hipotesis: koordinat Z pada sawah_selected.gpkg menyebabkan
operasi intersection 3D/2D menghasilkan hasil tidak benar.
"""
import sys, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import geopandas as gpd
from shapely.ops import unary_union

SAWAH_RAW = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\exposure\sawah_selected.gpkg"
REGIONS   = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\raw\administrasi\regions.gpkg"

proj_crs = "EPSG:32749"
sep = "=" * 80

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    raw = gpd.read_file(SAWAH_RAW)
    reg = gpd.read_file(REGIONS)

# ── A. Overlay dengan Z (kondisi saat ini) ────────────────────────────────────
print(f"\n{sep}")
print("  A. OVERLAY DENGAN Z COORDINATES (kondisi asli sawah)")
print(sep)

raw_proj = raw.to_crs(proj_crs)
reg_proj = reg[["id_kabkota","geometry"]].to_crs(proj_crs)

print(f"  sawah has_z: {raw_proj.has_z.all()}")

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    result_z = gpd.overlay(
        raw_proj[["geometry"]], reg_proj,
        how="intersection", keep_geom_type=False
    )
result_z = result_z[result_z.geometry.type.isin(["Polygon","MultiPolygon"])]
area_z_ha = result_z.to_crs(proj_crs).geometry.area.sum() / 10_000
raw_ha = raw_proj.geometry.area.sum() / 10_000
print(f"  Area raw sawah        : {raw_ha:>12,.0f} ha")
print(f"  Area setelah overlay Z: {area_z_ha:>12,.0f} ha ({area_z_ha/raw_ha*100:.1f}%)")
print(f"  HILANG                : {raw_ha - area_z_ha:>12,.0f} ha ({(raw_ha-area_z_ha)/raw_ha*100:.1f}%)")

# ── B. Strip Z dan overlay ulang ──────────────────────────────────────────────
print(f"\n{sep}")
print("  B. OVERLAY SETELAH STRIP Z COORDINATES (force 2D)")
print(sep)

raw_2d = raw_proj.copy()
raw_2d["geometry"] = raw_2d.geometry.apply(
    lambda g: g.__class__(
        [[(x, y) for x, y, *_ in ring.coords] for ring in
         ([g.exterior] + list(g.interiors))]
        if g.geom_type == "Polygon"
        else __import__("shapely.geometry", fromlist=["MultiPolygon"]).MultiPolygon([
            __import__("shapely.geometry", fromlist=["Polygon"]).Polygon(
                [(x, y) for x, y, *_ in poly.exterior.coords],
                [[(x, y) for x, y, *_ in ring.coords] for ring in poly.interiors]
            )
            for poly in g.geoms
        ])
    ) if hasattr(g, "exterior")
    else g
)

# Cara lebih simpel: pakai shapely force_2d
try:
    from shapely import force_2d
    raw_2d["geometry"] = raw_2d.geometry.apply(force_2d)
    print("  Menggunakan shapely.force_2d()")
except ImportError:
    # Fallback untuk shapely lama
    raw_2d["geometry"] = raw_2d.geometry.apply(
        lambda g: g.simplify(0) if not g.has_z else
        type(g)(*[[(c[0], c[1]) for c in ring.coords]
                  for ring in ([g.exterior] + list(g.interiors))])
        if g.geom_type == "Polygon" else g
    )
    print("  Menggunakan fallback manual")

print(f"  sawah has_z setelah force_2d: {raw_2d.has_z.any()}")

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    result_2d = gpd.overlay(
        raw_2d[["geometry"]], reg_proj,
        how="intersection", keep_geom_type=False
    )
result_2d = result_2d[result_2d.geometry.type.isin(["Polygon","MultiPolygon"])]
area_2d_ha = result_2d.geometry.area.sum() / 10_000
print(f"  Area raw sawah         : {raw_ha:>12,.0f} ha")
print(f"  Area setelah overlay 2D: {area_2d_ha:>12,.0f} ha ({area_2d_ha/raw_ha*100:.1f}%)")
print(f"  HILANG                 : {raw_ha - area_2d_ha:>12,.0f} ha ({(raw_ha-area_2d_ha)/raw_ha*100:.1f}%)")
print(f"  Perbaikan vs Z method  : +{area_2d_ha - area_z_ha:,.0f} ha")

# ── C. Kesimpulan ─────────────────────────────────────────────────────────────
print(f"\n{sep}")
print("  C. KESIMPULAN")
print(sep)
improvement = (area_2d_ha - area_z_ha) / raw_ha * 100
print(f"""
  Hipotesis: koordinat Z menyebabkan intersection 3D/2D menghasilkan
  area lebih kecil dari seharusnya.

  Hasil:
    Overlay dengan Z   : {area_z_ha:,.0f} ha ({area_z_ha/raw_ha*100:.1f}%)
    Overlay tanpa Z    : {area_2d_ha:,.0f} ha ({area_2d_ha/raw_ha*100:.1f}%)
    Perbaikan          : +{area_2d_ha - area_z_ha:,.0f} ha (+{improvement:.1f}%)

  {'✅ Hipotesis TERBUKTI — Z coordinates adalah penyebab kehilangan area.' if improvement > 5 else '❌ Hipotesis tidak terbukti — penyebab lain.'}
""")
