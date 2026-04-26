import os
import shutil
import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform, reproject
from rasterio.enums import Resampling

from backend.scripts.config.settings import (
    DEFAULT_CRS,
    RASTER_RESAMPLING_METHOD,
    RASTER_NODATA,
    VERBOSE,
)
from backend.scripts.utils import log


# =========================
# RESAMPLING MAP
# =========================
RESAMPLING_MAP = {
    "nearest": Resampling.nearest,
    "bilinear": Resampling.bilinear,
    "cubic": Resampling.cubic,
}


# =========================
# HELPER
# =========================
def require_folder(path: str, label: str) -> None:
    if not os.path.isdir(path):
        raise FileNotFoundError(f"{label} tidak ditemukan: {path}")


def get_raster_files(folder: str, prefix: str, suffix: str = ".tif") -> list[str]:
    require_folder(folder, "Folder raster")

    rasters = sorted([
        f for f in os.listdir(folder)
        if f.startswith(prefix) and f.endswith(suffix)
    ])

    if VERBOSE:
        log.info("RASTER", f"Ditemukan {len(rasters)} file ({prefix}*)")

    return rasters


def format_reproj_name(filename: str) -> str:
    return filename.replace(".tif", "_reproj.tif")


def format_norm_name(filename: str) -> str:
    return filename.replace("_reproj.tif", "_norm.tif")


def _is_nan_like(value) -> bool:
    try:
        return value is not None and np.isnan(value)
    except Exception:
        return False


def _make_valid_mask(data: np.ndarray, nodata_val) -> np.ndarray:
    if nodata_val is None:
        return ~np.isnan(data)

    if _is_nan_like(nodata_val):
        return ~np.isnan(data)

    return (data != nodata_val) & (~np.isnan(data))


def _is_valid_raster(path: str) -> bool:
    """Return True only if the file exists AND rasterio can open and read it.
    A partially-written or truncated file will fail here and trigger regeneration."""
    if not os.path.exists(path):
        return False
    try:
        with rasterio.open(path) as src:
            src.read(1, window=rasterio.windows.Window(0, 0, min(src.width, 4), min(src.height, 4)))
        return True
    except Exception:
        return False


def _write_array(output_path: str, profile: dict, data: np.ndarray, nodata_val) -> str:
    profile = profile.copy()
    profile.update(
        dtype="float32",
        count=1,
        nodata=nodata_val,
        crs=profile.get("crs") or DEFAULT_CRS,
    )

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(data.astype("float32"), 1)

    return output_path


def _normalize_reverse(data: np.ndarray) -> np.ndarray:
    """
    Reverse min-max normalization (P1-based threshold)

    min = -6.5 (P1 global)
    max = -2 (SPI threshold)
    """

    if np.all(np.isnan(data)):
        raise ValueError("Semua nilai adalah nodata")

    # 🔥 FIXED THRESHOLD
    min_val = -6.5
    max_val = -2.0

    if max_val - min_val == 0:
        raise ValueError("Range threshold tidak valid")

    # 🔥 CLIP KE RANGE
    data_clipped = np.clip(data, min_val, max_val)

    # 🔥 NORMALISASI (REVERSE)
    norm = (max_val - data_clipped) / (max_val - min_val)

    norm = np.clip(norm, 0, 1)

    return norm.astype("float32")


# =========================
# REPROJECT
# =========================
def reproject_raster(
    input_path: str,
    output_path: str,
    overwrite: bool = False,
) -> str:

    if _is_valid_raster(output_path) and not overwrite:
        if VERBOSE:
            log.info("SKIP", os.path.basename(output_path))
        return output_path

    if RASTER_RESAMPLING_METHOD not in RESAMPLING_MAP:
        raise ValueError(f"Resampling tidak valid: {RASTER_RESAMPLING_METHOD}")

    resampling_method = RESAMPLING_MAP[RASTER_RESAMPLING_METHOD]

    try:
        with rasterio.open(input_path) as src:
            if src.crs is None:
                raise ValueError(f"Raster tidak memiliki CRS: {input_path}")

            # COPY jika CRS sama
            if src.crs.to_string() == DEFAULT_CRS:
                if VERBOSE:
                    log.info("COPY", os.path.basename(input_path))
                shutil.copy(input_path, output_path)
                return output_path

            if VERBOSE:
                print(f"[REPROJECT] {os.path.basename(input_path)}")

            transform, width, height = calculate_default_transform(
                src.crs, DEFAULT_CRS, src.width, src.height, *src.bounds
            )

            nodata_val = src.nodata if src.nodata is not None else RASTER_NODATA

            kwargs = src.meta.copy()
            kwargs.update({
                "crs": DEFAULT_CRS,
                "transform": transform,
                "width": width,
                "height": height,
                "nodata": nodata_val,
            })

            with rasterio.open(output_path, "w", **kwargs) as dst:
                for i in range(1, src.count + 1):
                    reproject(
                        source=rasterio.band(src, i),
                        destination=rasterio.band(dst, i),
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=transform,
                        dst_crs=DEFAULT_CRS,
                        resampling=resampling_method,
                        src_nodata=src.nodata,
                        dst_nodata=nodata_val,
                    )

        return output_path

    except Exception as e:
        raise RuntimeError(f"Gagal reproject raster: {input_path} | {e}")


# =========================
# NORMALIZE (SINGLE)
# =========================
def normalize_raster(
    input_path: str,
    output_path: str,
    overwrite: bool = False,
) -> str:

    if _is_valid_raster(output_path) and not overwrite:
        if VERBOSE:
            log.info("SKIP", os.path.basename(output_path))
        return output_path

    try:
        with rasterio.open(input_path) as src:
            data = src.read(1).astype("float32")
            profile = src.profile.copy()

            nodata_val = src.nodata if src.nodata is not None else RASTER_NODATA
            valid_mask = _make_valid_mask(data, nodata_val)

            data_work = data.copy()
            data_work[~valid_mask] = np.nan

            norm = _normalize_reverse(data_work)

            if nodata_val is not None:
                if _is_nan_like(nodata_val):
                    norm[~valid_mask] = np.nan
                else:
                    norm[~valid_mask] = nodata_val

            _write_array(output_path, profile, norm, nodata_val)

        if VERBOSE:
            print(f"[NORMALIZED] {os.path.basename(output_path)}")

        return output_path

    except Exception as e:
        raise RuntimeError(f"Gagal normalize raster: {input_path} | {e}")


# =========================
# NORMALIZE DROUGHT PAIR
# =========================
def normalize_drought_pair_with_common_overlap(
    non_climate_path: str,
    climate_path: str,
    non_climate_output: str,
    climate_output: str,
    overwrite: bool = False,
) -> tuple[str, str]:
    """
    Normalisasi pasangan drought non-climate dan climate dengan common valid overlap.
    Output tetap langsung *_norm.tif, tanpa file tambahan.

    Langkah:
    1. baca dua raster reproj
    2. cek alignment grid
    3. buat common valid mask
    4. area di luar overlap dijadikan nodata di keduanya
    5. normalisasi reverse min-max masing-masing raster
    6. simpan langsung jadi *_norm.tif
    """

    if (
        _is_valid_raster(non_climate_output)
        and _is_valid_raster(climate_output)
        and not overwrite
    ):
        if VERBOSE:
            print(
                f"[SKIP] drought pair normalized: "
                f"{os.path.basename(non_climate_output)} | {os.path.basename(climate_output)}"
            )
        return non_climate_output, climate_output

    try:
        with rasterio.open(non_climate_path) as src_non, rasterio.open(climate_path) as src_clim:
            # harus aligned
            if src_non.width != src_clim.width or src_non.height != src_clim.height:
                raise ValueError("Ukuran raster non-climate dan climate berbeda")

            if src_non.transform != src_clim.transform:
                raise ValueError("Transform raster non-climate dan climate berbeda")

            if str(src_non.crs) != str(src_clim.crs):
                raise ValueError("CRS raster non-climate dan climate berbeda")

            non_data = src_non.read(1).astype("float32")
            clim_data = src_clim.read(1).astype("float32")

            non_profile = src_non.profile.copy()
            clim_profile = src_clim.profile.copy()

            non_nodata = src_non.nodata if src_non.nodata is not None else RASTER_NODATA
            clim_nodata = src_clim.nodata if src_clim.nodata is not None else RASTER_NODATA

            valid_non = _make_valid_mask(non_data, non_nodata)
            valid_clim = _make_valid_mask(clim_data, clim_nodata)

            common_valid = valid_non & valid_clim

            common_count = int(np.sum(common_valid))
            if common_count == 0:
                raise ValueError("Tidak ada overlap valid antara raster non-climate dan climate")

            if VERBOSE:
                print(
                    f"[COMMON OVERLAP] {os.path.basename(non_climate_path)} <-> {os.path.basename(climate_path)} "
                    f"| valid bersama: {common_count}"
                )

            # mask area di luar overlap jadi nan dulu agar tidak ikut min-max
            non_work = non_data.copy()
            clim_work = clim_data.copy()

            non_work[~common_valid] = np.nan
            clim_work[~common_valid] = np.nan

            non_norm = _normalize_reverse(non_work)
            clim_norm = _normalize_reverse(clim_work)

            # kembalikan nodata di luar overlap
            if non_nodata is not None:
                if _is_nan_like(non_nodata):
                    non_norm[~common_valid] = np.nan
                else:
                    non_norm[~common_valid] = non_nodata

            if clim_nodata is not None:
                if _is_nan_like(clim_nodata):
                    clim_norm[~common_valid] = np.nan
                else:
                    clim_norm[~common_valid] = clim_nodata

            _write_array(non_climate_output, non_profile, non_norm, non_nodata)
            _write_array(climate_output, clim_profile, clim_norm, clim_nodata)

        if VERBOSE:
            print(f"[NORMALIZED] {os.path.basename(non_climate_output)}")
            print(f"[NORMALIZED] {os.path.basename(climate_output)}")

        return non_climate_output, climate_output

    except Exception as e:
        raise RuntimeError(
            f"Gagal normalize drought pair: {non_climate_path} | {climate_path} | {e}"
        )


# =========================
# BATCH REPROJECT
# =========================
def run_reproject_batch(
    input_folder: str,
    output_folder: str,
    prefix: str,
    overwrite: bool = False,
) -> list[str]:

    os.makedirs(output_folder, exist_ok=True)

    rasters = get_raster_files(input_folder, prefix)

    if not rasters:
        raise ValueError(f"Tidak ada raster prefix '{prefix}'")

    outputs = []

    for r in rasters:
        out = reproject_raster(
            input_path=os.path.join(input_folder, r),
            output_path=os.path.join(output_folder, format_reproj_name(r)),
            overwrite=overwrite,
        )
        outputs.append(out)

    return outputs


# =========================
# BATCH NORMALIZE
# =========================
def run_normalize_batch(
    input_folder: str,
    output_folder: str,
    prefix: str,
    overwrite: bool = False,
) -> list[str]:

    os.makedirs(output_folder, exist_ok=True)

    # =========================
    # KHUSUS DROUGHT:
    # proses per pasangan non-climate vs climate
    # agar area valid keduanya sama sebelum normalisasi
    # =========================
    if prefix == "drought_":
        periods = ["25", "50", "100", "250"]
        outputs = []

        for rp in periods:
            non_name = f"drought_r{rp}_reproj.tif"
            clim_name = f"drought_rc{rp}_reproj.tif"

            non_path = os.path.join(input_folder, non_name)
            clim_path = os.path.join(input_folder, clim_name)

            if not os.path.exists(non_path):
                raise FileNotFoundError(f"Raster tidak ditemukan: {non_path}")
            if not os.path.exists(clim_path):
                raise FileNotFoundError(f"Raster tidak ditemukan: {clim_path}")

            non_out = os.path.join(output_folder, format_norm_name(non_name))
            clim_out = os.path.join(output_folder, format_norm_name(clim_name))

            out_non, out_clim = normalize_drought_pair_with_common_overlap(
                non_climate_path=non_path,
                climate_path=clim_path,
                non_climate_output=non_out,
                climate_output=clim_out,
                overwrite=overwrite,
            )

            outputs.extend([out_non, out_clim])

        return outputs

    # =========================
    # DEFAULT:
    # normalisasi raster satu-satu
    # =========================
    rasters = get_raster_files(input_folder, prefix, "_reproj.tif")

    if not rasters:
        raise ValueError(f"Tidak ada raster reproj prefix '{prefix}'")

    outputs = []

    for r in rasters:
        out = normalize_raster(
            input_path=os.path.join(input_folder, r),
            output_path=os.path.join(output_folder, format_norm_name(r)),
            overwrite=overwrite,
        )
        outputs.append(out)

    return outputs
