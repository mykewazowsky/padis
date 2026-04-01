import os
import geopandas as gpd
from rasterstats import zonal_stats

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

processed_folder = os.path.join(PROJECT_ROOT, "data", "processed")
output_folder = os.path.join(PROJECT_ROOT, "data", "output")
os.makedirs(output_folder, exist_ok=True)

vector_path = os.path.join(processed_folder, "sawah_admin_intersection.geojson")
raster_path = os.path.join(processed_folder, "reproj_R25.tif")
output_path = os.path.join(output_folder, "sawah_r25_stats.geojson")

print("Membaca polygon sawah-admin...")
gdf = gpd.read_file(vector_path, engine="fiona")

print("Menghitung zonal statistics untuk R25...")
stats = zonal_stats(
    vector_path,
    raster_path,
    stats=["mean", "max", "min"],
    geojson_out=False,
    nodata=None
)

print("Menambahkan hasil ke GeoDataFrame...")
gdf["mean_r25"] = [s["mean"] for s in stats]
gdf["max_r25"] = [s["max"] for s in stats]
gdf["min_r25"] = [s["min"] for s in stats]

print("Menyimpan hasil...")
gdf.to_file(output_path, driver="GeoJSON")

print("Selesai: zonal stats R25 berhasil.")