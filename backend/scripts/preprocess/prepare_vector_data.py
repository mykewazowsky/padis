"""
prepare_vector_data.py

Menyiapkan data vektor dasar untuk pipeline PADIS:
- admin_clean.geojson
- sawah_clean.geojson
- sawah_admin_intersection.geojson
"""

import os
import geopandas as gpd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

raw_folder = os.path.join(PROJECT_ROOT, "data", "raw")
processed_folder = os.path.join(PROJECT_ROOT, "data", "processed")
os.makedirs(processed_folder, exist_ok=True)

admin_path = os.path.join(raw_folder, "batas_adm_kabkota.shp")
sawah_path = os.path.join(raw_folder, "lulc_sawah.shp")

admin_output = os.path.join(processed_folder, "admin_clean.geojson")
sawah_output = os.path.join(processed_folder, "sawah_clean.geojson")
intersection_output = os.path.join(processed_folder, "sawah_admin_intersection.geojson")


def require_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File tidak ditemukan: {path}")


def clean_geodata(gdf, target_crs="EPSG:4326"):
    if "geometry" not in gdf.columns:
        raise ValueError("Kolom geometry tidak ditemukan pada layer")

    if gdf.crs is None:
        raise ValueError("Layer tidak memiliki CRS. Tetapkan CRS dulu sebelum lanjut.")

    if gdf.crs.to_string() != target_crs:
        gdf = gdf.to_crs(target_crs)

    gdf = gdf[gdf.geometry.notnull()]
    gdf = gdf[~gdf.geometry.is_empty]

    # sengaja hanya ambil geometri valid
    gdf = gdf[gdf.is_valid].copy()

    return gdf


require_file(admin_path)
require_file(sawah_path)

print("Membaca layer admin...")
admin = gpd.read_file(admin_path, engine="fiona")
print(f"Jumlah fitur admin awal: {len(admin)}")

print("Membaca layer sawah...")
sawah = gpd.read_file(sawah_path, engine="fiona")
print(f"Jumlah fitur sawah awal: {len(sawah)}")

print("Membersihkan layer admin...")
admin = clean_geodata(admin)
print(f"Jumlah fitur admin setelah clean: {len(admin)}")

print("Membersihkan layer sawah...")
sawah = clean_geodata(sawah)
print(f"Jumlah fitur sawah setelah clean: {len(sawah)}")

print("Menyimpan admin_clean.geojson ...")
admin.to_file(admin_output, driver="GeoJSON")

print("Menyimpan sawah_clean.geojson ...")
sawah.to_file(sawah_output, driver="GeoJSON")

print("Membuat intersection sawah x admin ...")
sawah_admin = gpd.overlay(sawah, admin, how="intersection")
sawah_admin = clean_geodata(sawah_admin)

if sawah_admin.empty:
    raise ValueError("Hasil intersection kosong")

print(f"Jumlah fitur intersection: {len(sawah_admin)}")

print("Menyimpan sawah_admin_intersection.geojson ...")
sawah_admin.to_file(intersection_output, driver="GeoJSON")

print("Selesai: vector preparation berhasil.")