"""
preprocess_drought_rasters.py

Melakukan reprojection raster drought (MME dan GPM) ke EPSG:4326
untuk kebutuhan zonal statistics pipeline PADIS.
"""

import os
from pyproj import datadir

os.environ["PROJ_LIB"] = datadir.get_data_dir()

import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

input_folder = os.path.join(PROJECT_ROOT, "data", "raw")
output_folder = os.path.join(PROJECT_ROOT, "data", "processed")
os.makedirs(output_folder, exist_ok=True)

rasters_to_fix = [
    "mme_rp25.tif",
    "mme_rp50.tif",
    "mme_rp100.tif",
    "mme_rp250.tif",
    "gpm_rp25.tif",
    "gpm_rp50.tif",
    "gpm_rp100.tif",
    "gpm_rp250.tif",
]


def require_files(paths):
    missing = [path for path in paths if not os.path.exists(path)]
    if missing:
        raise FileNotFoundError(f"File raster tidak ditemukan: {missing}")


def reproject_raster(input_path, output_path, target_crs="EPSG:4326"):
    with rasterio.open(input_path) as src:
        if src.crs is None:
            raise ValueError(f"Raster tidak memiliki CRS: {input_path}")

        transform, width, height = calculate_default_transform(
            src.crs,
            target_crs,
            src.width,
            src.height,
            *src.bounds
        )

        kwargs = src.meta.copy()
        kwargs.update({
            "crs": target_crs,
            "transform": transform,
            "width": width,
            "height": height,
        })

        with rasterio.open(output_path, "w", **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=target_crs,
                    resampling=Resampling.nearest,
                )


input_paths = [os.path.join(input_folder, raster) for raster in rasters_to_fix]
require_files(input_paths)

for raster in rasters_to_fix:
    input_path = os.path.join(input_folder, raster)
    output_path = os.path.join(output_folder, f"reproj_{raster}")

    print(f"Processing: {input_path}")

    if os.path.exists(output_path):
        print(f"Skip, sudah ada: {output_path}")
        continue

    reproject_raster(input_path, output_path)
    print(f"Saved: {output_path}")

print("Selesai: reprojection drought berhasil.")