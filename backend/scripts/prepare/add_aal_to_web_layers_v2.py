import os
import geopandas as gpd
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

SCENARIOS = ["rp25", "rp50", "rp100", "rp250"]
CLIMATES = ["nonclimate", "climate"]


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def add_aal_to_layer(layer_path, aal_csv_path, aal_nonclimate_col, aal_climate_col):
    if not os.path.exists(layer_path):
        print(f"SKIP layer not found: {layer_path}")
        return False

    if not os.path.exists(aal_csv_path):
        print(f"SKIP AAL csv not found: {aal_csv_path}")
        return False

    print(f"Processing {os.path.basename(layer_path)} ...")

    gdf = gpd.read_file(layer_path, engine="fiona")
    df_aal = pd.read_csv(aal_csv_path)

    require_columns(gdf, ["id_kabkota"], f"layer {os.path.basename(layer_path)}")
    require_columns(
        df_aal,
        ["id_kabkota", aal_nonclimate_col, aal_climate_col],
        f"AAL csv {os.path.basename(aal_csv_path)}"
    )

    gdf["id_kabkota"] = gdf["id_kabkota"].astype(str)
    df_aal["id_kabkota"] = df_aal["id_kabkota"].astype(str)

    keep_cols = ["id_kabkota", aal_nonclimate_col, aal_climate_col]
    df_aal = df_aal[keep_cols].copy()

    df_aal = df_aal.rename(columns={
        aal_nonclimate_col: "aal_nonclimate",
        aal_climate_col: "aal_climate",
    })

    for col in ["aal_nonclimate", "aal_climate"]:
        if col in gdf.columns:
            gdf = gdf.drop(columns=[col])

    gdf = gdf.merge(df_aal, on="id_kabkota", how="left")

    matched_count = gdf["aal_nonclimate"].notna().sum()
    print(f"Matched AAL rows: {matched_count}/{len(gdf)}")

    print(f"Overwriting layer with AAL attributes: {layer_path}")
    gdf.to_file(layer_path, driver="GeoJSON", engine="fiona")
    print(f"Updated: {layer_path}")

    return True


def process_multi():
    processed = 0
    aal_csv = os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal_v2.csv")

    for scenario in SCENARIOS:
        for climate in CLIMATES:
            layer_path = os.path.join(
                OUTPUT_DIR,
                f"web_multi_{climate}_{scenario}_v2.geojson"
            )
            ok = add_aal_to_layer(
                layer_path,
                aal_csv,
                "aal_nonclimate_v2",
                "aal_climate_v2"
            )
            processed += int(ok)

    return processed


def process_flood():
    processed = 0
    aal_csv = os.path.join(OUTPUT_DIR, "kabkota_flood_aal_v2.csv")

    for scenario in SCENARIOS:
        for climate in CLIMATES:
            layer_path = os.path.join(
                OUTPUT_DIR,
                f"web_flood_{climate}_{scenario}_v2.geojson"
            )
            ok = add_aal_to_layer(
                layer_path,
                aal_csv,
                "aal_flood_nonclimate_v2",
                "aal_flood_climate_v2"
            )
            processed += int(ok)

    return processed


def process_drought():
    processed = 0
    aal_csv = os.path.join(OUTPUT_DIR, "kabkota_drought_aal_v2.csv")

    for scenario in SCENARIOS:
        for climate in CLIMATES:
            layer_path = os.path.join(
                OUTPUT_DIR,
                f"web_drought_{climate}_{scenario}_v2.geojson"
            )
            ok = add_aal_to_layer(
                layer_path,
                aal_csv,
                "aal_drought_nonclimate_v2",
                "aal_drought_climate_v2"
            )
            processed += int(ok)

    return processed


if __name__ == "__main__":
    total = 0
    total += process_multi()
    total += process_flood()
    total += process_drought()

    print(f"\nSelesai: AAL v2 berhasil ditambahkan ke web layer v2.")
    print(f"Total layer diproses: {total}")