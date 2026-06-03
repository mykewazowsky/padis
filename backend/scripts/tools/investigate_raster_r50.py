"""
investigate_raster_r50.py
Cek raster flood_r50 vs flood_r25/r100/r250 di area Sulawesi Tenggara.
Bandingkan: raw raster, reproj raster, dan flood_stats.geojson asli.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import geopandas as gpd
import rasterio
from rasterio.mask import mask as rio_mask
from shapely.geometry import box
from backend.scripts.config.settings import DATA_DIR, ZONAL_DIR

sep = "=" * 80

SUSPECTS = [
    "74.01","74.03","74.04","74.05","74.06",
    "74.08","74.10","74.12","74.13","74.71","74.72"
]

# Bounding box Sulawesi Tenggara (approx)
SULTRA_BBOX = (120.0, -6.5, 124.5, -3.0)  # (minx, miny, maxx, maxy)

RAW_DIR   = DATA_DIR / "raw"   / "hazard"
PROC_DIR  = DATA_DIR / "processed" / "hazard"

# ── 1. Cek flood_stats.geojson ASLI ──────────────────────────────────────────
print(f"\n{sep}")
print("  STEP A — flood_stats.geojson ASLI (output zonal statistics pipeline)")
print(sep)

orig_path = ZONAL_DIR / "flood_stats.geojson"
if orig_path.exists():
    gdf = gpd.read_file(str(orig_path))
    gdf["id_kabkota"] = gdf["id_kabkota"].astype(str).str.strip()
    subset = gdf[gdf["id_kabkota"].isin(SUSPECTS)]
    flood_cols = sorted([c for c in gdf.columns if c.startswith("mean_flood_")])
    print(f"  Kolom: {flood_cols}")
    if not subset.empty:
        import pandas as pd
        pd.set_option("display.float_format", "{:.4f}".format)
        pd.set_option("display.width", 200)
        print(subset[["id_kabkota"] + flood_cols].to_string(index=False))
    else:
        print("  Tidak ada kabkota 74.xx di file ini.")
else:
    print(f"  File tidak ditemukan: {orig_path}")

# ── 2. Metadata raster: CRS, nodata, extent ───────────────────────────────────
print(f"\n{sep}")
print("  STEP B — Metadata raster (raw & reproj)")
print(sep)

rasters = {
    "raw_r25":    RAW_DIR  / "flood_r25.tif",
    "raw_r50":    RAW_DIR  / "flood_r50.tif",
    "raw_r100":   RAW_DIR  / "flood_r100.tif",
    "raw_r250":   RAW_DIR  / "flood_r250.tif",
    "raw_rc50":   RAW_DIR  / "flood_rc50.tif",
    "repr_r25":   PROC_DIR / "flood_r25_reproj.tif",
    "repr_r50":   PROC_DIR / "flood_r50_reproj.tif",
    "repr_r100":  PROC_DIR / "flood_r100_reproj.tif",
    "repr_rc50":  PROC_DIR / "flood_rc50_reproj.tif",
}

print(f"  {'Name':<15} {'CRS':<20} {'NoData':>10} {'Shape':>20} {'Bounds (W,S,E,N)'}")
print(f"  {'-'*15} {'-'*20} {'-'*10} {'-'*20} {'-'*40}")
for name, path in rasters.items():
    if not path.exists():
        print(f"  {name:<15} FILE NOT FOUND")
        continue
    with rasterio.open(path) as src:
        b = src.bounds
        print(f"  {name:<15} {str(src.crs.to_epsg() or src.crs):<20} "
              f"{str(src.nodata):>10} "
              f"{str(src.shape):>20} "
              f"({b.left:.2f},{b.bottom:.2f},{b.right:.2f},{b.top:.2f})")

# ── 3. Statistik pixel di bounding box Sulawesi Tenggara ─────────────────────
print(f"\n{sep}")
print("  STEP C — Statistik pixel di area Sulawesi Tenggara")
print(f"  BBox: lon {SULTRA_BBOX[0]}–{SULTRA_BBOX[2]}, lat {SULTRA_BBOX[1]}–{SULTRA_BBOX[3]}")
print(sep)

sultra_geom = [box(*SULTRA_BBOX).__geo_interface__]

focus = {
    "repr_r25":  PROC_DIR / "flood_r25_reproj.tif",
    "repr_r50":  PROC_DIR / "flood_r50_reproj.tif",
    "repr_r100": PROC_DIR / "flood_r100_reproj.tif",
    "repr_r250": PROC_DIR / "flood_r250_reproj.tif",
    "repr_rc50": PROC_DIR / "flood_rc50_reproj.tif",
}

print(f"\n  {'Raster':<15} {'N_pixel':>10} {'N_valid':>10} {'N_zero':>10} "
      f"{'pct_zero':>10} {'min':>8} {'max':>8} {'mean':>8}")
print(f"  {'-'*15} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*8} {'-'*8} {'-'*8}")

for name, path in focus.items():
    if not path.exists():
        print(f"  {name:<15} FILE NOT FOUND")
        continue
    try:
        with rasterio.open(path) as src:
            out_img, _ = rio_mask(src, sultra_geom, crop=True, nodata=np.nan, filled=True)
            data = out_img[0].astype(float)
            nodata = src.nodata
            if nodata is not None:
                data[data == nodata] = np.nan

            n_total = data.size
            n_nan   = np.sum(np.isnan(data))
            valid   = data[~np.isnan(data)]
            n_valid = len(valid)
            n_zero  = int(np.sum(valid == 0))
            pct_zero = n_zero / n_valid * 100 if n_valid > 0 else 0

            vmin = valid.min() if n_valid > 0 else float("nan")
            vmax = valid.max() if n_valid > 0 else float("nan")
            vmean = valid.mean() if n_valid > 0 else float("nan")

            print(f"  {name:<15} {n_total:>10,} {n_valid:>10,} {n_zero:>10,} "
                  f"{pct_zero:>9.1f}% {vmin:>8.3f} {vmax:>8.3f} {vmean:>8.3f}")
    except Exception as e:
        print(f"  {name:<15} ERROR: {e}")

# ── 4. Cek apakah r50 reproj coverage mencakup Sultra ────────────────────────
print(f"\n{sep}")
print("  STEP D — Apakah reproj_r50 mencakup titik-titik di Sulawesi Tenggara?")
print(sep)

# Sample point di Sulawesi Tenggara (Kota Kendari approx)
sample_points = {
    "Kota Kendari":        (3.972, 122.515),   # lat, lon
    "Kolaka":              (4.055, 121.610),
    "Buton":               (5.463, 122.608),
    "Bombana":             (4.774, 121.784),
}

for rp_name, rp_path in [
    ("repr_r25",  PROC_DIR / "flood_r25_reproj.tif"),
    ("repr_r50",  PROC_DIR / "flood_r50_reproj.tif"),
    ("repr_rc50", PROC_DIR / "flood_rc50_reproj.tif"),
]:
    if not rp_path.exists():
        continue
    print(f"\n  [{rp_name}]")
    with rasterio.open(rp_path) as src:
        for loc, (lat, lon) in sample_points.items():
            try:
                # Sample pixel at lon, lat
                row, col = src.index(lon, lat)
                val = src.read(1)[row, col]
                nodata = src.nodata
                is_nd = (nodata is not None and val == nodata)
                print(f"    {loc:<25} lat={lat} lon={lon}  pixel={val:.4f}{'  [NoData]' if is_nd else ''}")
            except Exception as e:
                print(f"    {loc:<25} OUT OF BOUNDS or ERROR: {e}")

print(f"\n{sep}")
print("  RINGKASAN INVESTIGASI")
print(sep)
