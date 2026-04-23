import os
import pandas as pd
import geopandas as gpd


def require_columns(df, columns, label):
    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan di {label}: {missing}")


def compute_loss(
    lop_path: str,
    prod_path: str,
    lop_cols: list[str],
    layer_name: str,
    output_path: str,
    constant: float = 6500000,
) -> str:

    print(f"=== LOSS ENGINE ({layer_name}) ===")

    # LOAD
    gdf = gpd.read_file(lop_path, layer=layer_name)
    prod_df = pd.read_csv(prod_path)

    require_columns(gdf, ["id_kabkota", *lop_cols], layer_name)
    require_columns(prod_df, ["id_kabkota", "total_prod"], "production")

    gdf["id_kabkota"] = gdf["id_kabkota"].astype(str)
    prod_df["id_kabkota"] = prod_df["id_kabkota"].astype(str)

    # JOIN
    gdf = gdf.merge(
        prod_df[["id_kabkota", "total_prod"]],
        on="id_kabkota",
        how="left",
    )

    # CALCULATE
    for col in lop_cols:
        loss_col = col.replace("lop_", "loss_")
        gdf[loss_col] = gdf["total_prod"] * gdf[col] * constant

    # SAVE
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    gdf.to_file(
        output_path,
        driver="GPKG",
        layer=layer_name.replace("lop", "loss")
    )

    print(f"✅ Loss selesai: {output_path}")

    return output_path
