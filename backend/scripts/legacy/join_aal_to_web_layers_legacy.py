import os
import geopandas as gpd
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

SCENARIOS = ["rp25", "rp50", "rp100", "rp250"]

def add_aal_to_layer(layer_path, aal_csv_path, aal_nonclimate_col, aal_climate_col):
    if not os.path.exists(layer_path):
        print(f"SKIP layer not found: {layer_path}")
        return

    if not os.path.exists(aal_csv_path):
        print(f"SKIP AAL csv not found: {aal_csv_path}")
        return

    print(f"Processing {os.path.basename(layer_path)} ...")

    gdf = gpd.read_file(layer_path, engine="fiona")
    df_aal = pd.read_csv(aal_csv_path)

    gdf["id_kabkota"] = gdf["id_kabkota"].astype(str)
    df_aal["id_kabkota"] = df_aal["id_kabkota"].astype(str)

    keep_cols = ["id_kabkota", aal_nonclimate_col, aal_climate_col]
    df_aal = df_aal[keep_cols].copy()

    df_aal = df_aal.rename(columns={
        aal_nonclimate_col: "aal_nonclimate",
        aal_climate_col: "aal_climate",
    })

    gdf = gdf.merge(df_aal, on="id_kabkota", how="left")

    gdf.to_file(layer_path, driver="GeoJSON", engine="fiona")
    print(f"Updated: {layer_path}")


def process_multi():
    aal_csv = os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal.csv")
    for scenario in SCENARIOS:
        layer_path = os.path.join(OUTPUT_DIR, f"web_multihazard_{scenario}.geojson")
        add_aal_to_layer(
            layer_path,
            aal_csv,
            "aal_nonclimate",
            "aal_climate"
        )


def process_flood():
    aal_csv = os.path.join(OUTPUT_DIR, "kabkota_flood_aal.csv")
    for scenario in SCENARIOS:
        layer_path = os.path.join(OUTPUT_DIR, f"web_flood_{scenario}.geojson")
        add_aal_to_layer(
            layer_path,
            aal_csv,
            "aal_flood_nonclimate",
            "aal_flood_climate"
        )


def process_drought():
    aal_csv = os.path.join(OUTPUT_DIR, "kabkota_drought_aal.csv")
    for scenario in SCENARIOS:
        layer_path = os.path.join(OUTPUT_DIR, f"web_drought_{scenario}.geojson")
        add_aal_to_layer(
            layer_path,
            aal_csv,
            "aal_drought_nonclimate",
            "aal_drought_climate"
        )


if __name__ == "__main__":
    process_multi()
    process_flood()
    process_drought()
    print("\nSelesai: AAL berhasil ditambahkan ke semua web layer.")