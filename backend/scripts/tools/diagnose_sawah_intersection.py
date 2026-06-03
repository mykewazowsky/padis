"""
diagnose_sawah_intersection.py
Investigasi sawah yang hilang saat interseksi dengan admin.
Jalankan setiap step secara terpisah dan ukur kehilangan di tiap tahap.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import warnings
import numpy as np
import geopandas as gpd
from shapely.validation import explain_validity
from backend.scripts.config.settings import DATA_DIR

sep = "=" * 80

SAWAH_PATH   = DATA_DIR / "raw"       / "exposure"  / "sawah_selected.gpkg"
REGIONS_PATH = DATA_DIR / "raw"       / "administrasi" / "regions.gpkg"
RESULT_PATH  = DATA_DIR / "processed" / "vector" / "sawah_admin_intersection.geojson"

# ── A. Load raw data ──────────────────────────────────────────────────────────
print(f"\n{sep}")
print("  A. LOAD DATA AWAL")
print(sep)

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    sawah   = gpd.read_file(str(SAWAH_PATH))
    regions = gpd.read_file(str(REGIONS_PATH))

print(f"  sawah_selected  : {len(sawah):>6} polygon | CRS: {sawah.crs.to_epsg()}")
print(f"  regions         : {len(regions):>6} polygon | CRS: {regions.crs.to_epsg()}")
print(f"  sawah CRS == regions CRS: {sawah.crs == regions.crs}")
print(f"  sawah geom types : {sawah.geometry.geom_type.value_counts().to_dict()}")
print(f"  sawah Z coords   : {sawah.has_z.sum()} dari {len(sawah)}")
print(f"  sawah M coords   : mencoba deteksi via wkt...")

# Cek M coordinate
sample_wkt = sawah.geometry.iloc[0].wkt[:80]
print(f"  Sample WKT sawah : {sample_wkt}...")

# ── B. Geometry validity sebelum fix ─────────────────────────────────────────
print(f"\n{sep}")
print("  B. VALIDITY GEOMETRI SAWAH (sebelum fix)")
print(sep)

sawah_invalid = sawah[~sawah.is_valid]
sawah_empty   = sawah[sawah.geometry.is_empty]
print(f"  Invalid geometri  : {len(sawah_invalid)}")
print(f"  Empty geometri    : {len(sawah_empty)}")
if len(sawah_invalid) > 0:
    print("  Contoh alasan invalid:")
    for geom in sawah_invalid.geometry.head(3):
        print(f"    {explain_validity(geom)}")

# ── C. Simulasikan fix_geometry ───────────────────────────────────────────────
print(f"\n{sep}")
print("  C. SETELAH fix_geometry (buffer(0) + filter valid)")
print(sep)

sawah_fix = sawah.copy()
sawah_fix["geometry"] = sawah_fix["geometry"].buffer(0)
n_before = len(sawah_fix)
sawah_fix = sawah_fix[sawah_fix.is_valid]
sawah_fix = sawah_fix[~sawah_fix.geometry.is_empty]
sawah_fix = sawah_fix[sawah_fix.geometry.type.isin(["Polygon", "MultiPolygon"])]
sawah_fix = sawah_fix.reset_index(drop=True)

n_after = len(sawah_fix)
print(f"  Sebelum fix_geometry : {n_before}")
print(f"  Setelah fix_geometry : {n_after}")
print(f"  Hilang di step ini   : {n_before - n_after}")

regions_fix = regions.copy()
regions_fix["geometry"] = regions_fix["geometry"].buffer(0)
regions_fix = regions_fix[regions_fix.is_valid]
regions_fix = regions_fix[~regions_fix.geometry.is_empty]
regions_fix = regions_fix[regions_fix.geometry.type.isin(["Polygon","MultiPolygon"])]
print(f"  Regions setelah fix  : {len(regions_fix)} (dari {len(regions)})")

# ── D. Bounding box check ─────────────────────────────────────────────────────
print(f"\n{sep}")
print("  D. BOUNDING BOX COMPARISON")
print(sep)

sb = sawah_fix.total_bounds   # minx, miny, maxx, maxy
rb = regions_fix.total_bounds

print(f"  sawah   bbox: lon {sb[0]:.3f} – {sb[2]:.3f} | lat {sb[1]:.3f} – {sb[3]:.3f}")
print(f"  regions bbox: lon {rb[0]:.3f} – {rb[2]:.3f} | lat {rb[1]:.3f} – {rb[3]:.3f}")

# Sawah di luar bbox regions
from shapely.geometry import box as shapely_box
regions_bbox_geom = shapely_box(rb[0], rb[1], rb[2], rb[3])
sawah_outside_bbox = sawah_fix[~sawah_fix.geometry.intersects(regions_bbox_geom)]
print(f"  Sawah di luar bbox regions: {len(sawah_outside_bbox)}")
if len(sawah_outside_bbox) > 0:
    print(f"  Contoh koordinat centroid:")
    for _, r in sawah_outside_bbox.head(5).iterrows():
        c = r.geometry.centroid
        print(f"    lon={c.x:.4f} lat={c.y:.4f}")

# ── E. Spatial join test: berapa sawah tidak punya pasangan region? ───────────
print(f"\n{sep}")
print("  E. SPATIAL JOIN — sawah tanpa pasangan region (sjoin left)")
print(sep)

joined = gpd.sjoin(
    sawah_fix[["geometry"]].reset_index().rename(columns={"index":"sawah_idx"}),
    regions_fix[["id_kabkota","kab_kota","prov","geometry"]],
    how="left",
    predicate="intersects"
)
no_match  = joined[joined["id_kabkota"].isna()]
has_match = joined[joined["id_kabkota"].notna()]

n_no_match  = no_match["sawah_idx"].nunique()
n_has_match = has_match["sawah_idx"].nunique()

print(f"  Total sawah setelah fix   : {len(sawah_fix)}")
print(f"  Sawah PUNYA pasangan region: {n_has_match}")
print(f"  Sawah TIDAK punya pasangan : {n_no_match}")

if n_no_match > 0:
    missing_sawah = sawah_fix.loc[no_match["sawah_idx"].unique()]
    print(f"\n  Distribusi sawah tanpa pasangan per provinsi (KODE_PROV):")
    if "KODE_PROV" in missing_sawah.columns:
        print(missing_sawah["KODE_PROV"].value_counts().head(15).to_string())
    print(f"\n  Contoh centroid sawah tanpa pasangan:")
    for _, r in missing_sawah.head(5).iterrows():
        c = r.geometry.centroid
        prov = r.get("KODE_PROV","?")
        print(f"    KODE_PROV={prov}  lon={c.x:.4f} lat={c.y:.4f}")

# ── F. Coverage per provinsi ──────────────────────────────────────────────────
print(f"\n{sep}")
print("  F. COVERAGE SAWAH PER PROVINSI (kode prov)")
print(sep)

if "KODE_PROV" in sawah_fix.columns:
    sawah_by_prov = sawah_fix.groupby("KODE_PROV").size().rename("sawah_total")
    matched_sawah = sawah_fix.loc[has_match["sawah_idx"].unique()]
    match_by_prov = matched_sawah.groupby("KODE_PROV").size().rename("sawah_matched")

    coverage = sawah_by_prov.to_frame().join(match_by_prov).fillna(0).astype(int)
    coverage["sawah_hilang"] = coverage["sawah_total"] - coverage["sawah_matched"]
    coverage = coverage[coverage["sawah_hilang"] > 0].sort_values("sawah_hilang", ascending=False)

    if coverage.empty:
        print("  Tidak ada provinsi dengan sawah hilang.")
    else:
        print(f"  {'KODE_PROV':>10} {'sawah_total':>12} {'matched':>10} {'hilang':>8}")
        print(f"  {'-'*10} {'-'*12} {'-'*10} {'-'*8}")
        for prov, row in coverage.iterrows():
            print(f"  {prov:>10} {row['sawah_total']:>12} {row['sawah_matched']:>10} {row['sawah_hilang']:>8}")

# ── G. Overlay langsung: berapa sawah hilang di tahap overlay? ────────────────
print(f"\n{sep}")
print("  G. OVERLAY LANGSUNG (intersection) — sebelum dissolve")
print(sep)

overlay_result = gpd.overlay(
    sawah_fix[["geometry", "KODE_PROV"]].copy() if "KODE_PROV" in sawah_fix.columns
    else sawah_fix[["geometry"]].copy(),
    regions_fix[["id_kabkota","kab_kota","prov","geometry"]].copy(),
    how="intersection",
    keep_geom_type=False
)
overlay_result = overlay_result[
    overlay_result.geometry.type.isin(["Polygon","MultiPolygon"])
]
print(f"  Polygon overlay hasil     : {len(overlay_result)}")
print(f"  Kabkota unik di overlay   : {overlay_result['id_kabkota'].nunique()}")

# ── H. Ringkasan ──────────────────────────────────────────────────────────────
print(f"\n{sep}")
print("  H. RINGKASAN KEHILANGAN PER STEP")
print(sep)
print(f"  Sawah awal                    : {len(sawah):>6}")
print(f"  Hilang di fix_geometry        : {n_before - n_after:>6}")
print(f"  Sawah tanpa pasangan region   : {n_no_match:>6}")
print(f"  Sawah yang masuk intersection : {n_has_match:>6}")
print(f"  Kabkota hasil dissolve (exist): {len(gpd.read_file(str(RESULT_PATH))):>6}")
