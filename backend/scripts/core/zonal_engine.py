import os
import time
import gc
import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
import rasterio.mask
from rasterio.transform import rowcol
from shapely.geometry import box

from backend.scripts.config.settings import (
    ZONAL_CHUNK_SIZE,
    ZONAL_STATS,
    VERBOSE,
    DEFAULT_CRS,
    RASTER_NODATA,
)
from backend.scripts.utils import log

# ===============================
# VALIDATION
# ===============================
def require_file(path: str, label: str):
    if not os.path.exists(path):
        raise FileNotFoundError(f"{label} tidak ditemukan: {path}")


def require_folder(path: str, label: str):
    if not os.path.isdir(path):
        raise FileNotFoundError(f"{label} tidak ditemukan: {path}")


def require_columns(gdf: gpd.GeoDataFrame, columns: list[str], label: str):
    missing = [c for c in columns if c not in gdf.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


# ===============================
# RASTER FILES
# ===============================
def get_raster_files(folder: str, prefix: str, suffix: str):
    require_folder(folder, "Folder raster")

    rasters = sorted([
        f for f in os.listdir(folder)
        if f.startswith(prefix) and f.endswith(suffix)
    ])

    if not rasters:
        raise ValueError(f"Tidak ada raster di folder: {folder}")

    return rasters


def format_field_name(filename: str, suffix: str, stat: str):
    base = filename.replace(suffix, "")
    return f"{stat}_{base}"


# ===============================
# CRS
# ===============================
def ensure_crs(gdf: gpd.GeoDataFrame):
    if gdf.crs is None:
        raise ValueError("GeoDataFrame tidak punya CRS")

    if gdf.crs.to_string() != DEFAULT_CRS:
        if VERBOSE:
            log.info("REPROJECT", f"Vector → {DEFAULT_CRS}")
        gdf = gdf.to_crs(DEFAULT_CRS)

    return gdf


# ===============================
# RASTER INFO
# ===============================
def get_raster_info(raster_path: str):
    with rasterio.open(raster_path) as src:
        res_x = abs(src.transform.a)
        res_y = abs(src.transform.e)
        pixel_deg = max(res_x, res_y)

        is_geo = src.crs.is_geographic if src.crs else True
        pixel_m = pixel_deg * 111320.0 if is_geo else pixel_deg

        return {
            "pixel_m": pixel_m,
            "transform": src.transform,
            "crs": src.crs,
            "nodata": src.nodata,
            "path": raster_path,
            "width": src.width,
            "height": src.height,
        }


# ===============================
# CENTROID MODE (FIXED)
# ===============================
def centroid_point_query(gdf, raster_info, stats):
    """
    Fast sampling mode for coarse rasters.

    For coarse hazard grids, polygon zonal statistics can overstate precision.
    Sampling at each feature centroid keeps the extraction simple and avoids
    tiny polygon/raster overlap artifacts.
    """
    # data bisa None jika raster tidak di-load saat is_coarse=False
    data = raster_info["data"]
    if data is None:
        with rasterio.open(raster_info["path"]) as _src:
            data = _src.read(1)

    transform = raster_info["transform"]
    nodata = raster_info["nodata"] or RASTER_NODATA

    h, w = raster_info["height"], raster_info["width"]

    centroids = gdf.geometry.centroid

    if gdf.crs != raster_info["crs"]:
        centroids = gpd.GeoSeries(centroids, crs=gdf.crs).to_crs(raster_info["crs"])

    xs = centroids.x.to_numpy()
    ys = centroids.y.to_numpy()

    rows, cols = rowcol(transform, xs, ys)
    rows = np.asarray(rows)
    cols = np.asarray(cols)

    valid = (rows >= 0) & (rows < h) & (cols >= 0) & (cols < w)

    values = np.full(len(gdf), np.nan)
    values[valid] = data[rows[valid], cols[valid]]

    if nodata is not None:
        values[values == nodata] = np.nan

    results = {}
    for stat in stats:
        if stat == "count":
            results[stat] = [0 if np.isnan(v) else 1 for v in values]
        else:
            # 🔥 FIX: gunakan np.nan (bukan None)
            results[stat] = [np.nan if np.isnan(v) else float(v) for v in values]

    return results


# ===============================
# ZONAL STATS
# ===============================
def _stat_from_array(arr: np.ndarray, stat: str):
    valid = arr[~np.isnan(arr)]
    if len(valid) == 0:
        return None if stat != "count" else 0
    if stat == "mean":  return float(np.mean(valid))
    if stat == "count": return int(len(valid))
    if stat == "std":   return float(np.std(valid))
    if stat == "min":   return float(np.min(valid))
    if stat == "max":   return float(np.max(valid))
    if stat == "sum":   return float(np.sum(valid))
    return None


def bulk_zonal_stats(gdf, raster_path, chunk_size, stats):
    """
    Polygon zonal statistics via rasterio.mask — identik dengan QGIS.

    Menggantikan rasterstats yang punya bug axis-order pada raster GEOGCS
    (lat/lon), menyebabkan 'width and height must be > 0'.
    Raster dibuka sekali; setiap fitur di-mask lalu dihitung dengan numpy.
    """
    results = {s: [] for s in stats}
    total = len(gdf)
    total_chunks = (total + chunk_size - 1) // chunk_size

    with rasterio.open(raster_path) as src:
        src_nodata = src.nodata

        for i, start in enumerate(range(0, total, chunk_size), 1):
            end = min(start + chunk_size, total)
            chunk = gdf.iloc[start:end]

            if VERBOSE:
                log.progress(i, total_chunks, f"chunk {start+1}-{end}")

            for geom in chunk.geometry:
                try:
                    # __geo_interface__ menghasilkan GeoJSON lon/lat standar;
                    # rasterio.mask menangani axis-order raster secara internal.
                    def _mask_arr(touched):
                        o, _ = rasterio.mask.mask(
                            src, [geom.__geo_interface__],
                            crop=True, nodata=np.nan, filled=True,
                            all_touched=touched,
                        )
                        a = o[0].astype(float)
                        if src_nodata is not None:
                            try:
                                nd = float(src_nodata)
                                if not np.isnan(nd):
                                    a[a == nd] = np.nan
                            except (ValueError, TypeError):
                                pass
                        return a

                    arr = _mask_arr(False)
                    # Fallback all_touched=True hanya jika semua piksel NoData
                    if np.all(np.isnan(arr)):
                        arr = _mask_arr(True)

                    for s in stats:
                        results[s].append(_stat_from_array(arr, s))

                except Exception as e:
                    print(f"⚠️ Zonal error: {e}")
                    for s in stats:
                        results[s].append(None)

            gc.collect()

    return results


# ===============================
# MAIN
# ===============================
def run_zonal(
    vector_path,
    raster_folder,
    raster_prefix,
    raster_suffix,
    output_path,
    chunk_size=ZONAL_CHUNK_SIZE,
    stats=ZONAL_STATS,
    temp_output_path=None,
    overwrite=False,
):
    """
    Extract raster hazard values into the vector overlay table.

    Output columns preserve raster names through format_field_name(), so later
    analysis steps can infer hazard, scenario, and return period from columns.
    """

    require_file(vector_path, "Vector")
    rasters = get_raster_files(raster_folder, raster_prefix, raster_suffix)

    gdf = gpd.read_file(vector_path)
    gdf = ensure_crs(gdf)

    print(f"\n[ZONAL] {raster_prefix}")
    print(f"Fitur: {len(gdf)} | Raster: {len(rasters)}")

    for i, raster_name in enumerate(rasters, 1):
        print(f"\n[{i}/{len(rasters)}] {raster_name}")

        raster_path = os.path.join(raster_folder, raster_name)
        raster_info = get_raster_info(raster_path)

        with rasterio.open(raster_path) as src:
            bounds = src.bounds
            raster_bbox = box(bounds.left, bounds.bottom, bounds.right, bounds.top)

        gdf_filtered = gdf[gdf.intersects(raster_bbox)].copy()

        print(f"[FILTER] overlap: {len(gdf_filtered)} dari {len(gdf)}")

        if gdf_filtered.empty:
            continue

        stat_res = bulk_zonal_stats(gdf_filtered, raster_path, chunk_size, stats)

        # ===============================
        # SAVE (FIX NUMERIC)
        # ===============================
        for s in stats:
            field = format_field_name(raster_name, raster_suffix, s)

            values = pd.to_numeric(stat_res[s], errors="coerce")

            gdf[field] = np.nan
            gdf.loc[gdf_filtered.index, field] = values

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    gdf.to_file(output_path, driver="GeoJSON")

    print("\n✅ Zonal selesai")
    print(f"Output: {output_path}")

    return output_path
