import geopandas as gpd
import re


def extract_rp(col_name: str) -> int:
    match = re.search(r"(\d+)", col_name)
    if not match:
        raise ValueError(f"Tidak bisa ekstrak RP dari kolom: {col_name}")
    return int(match.group(1))


def compute_loss_drought_kab(gdf, prod_df, gabah):

    # =========================
    # PREPARE
    # =========================
    gdf = gdf.copy()
    prod_df = prod_df.copy()

    # FIX 1: SAMAKAN TIPE ID
    gdf["id_kabkota"] = gdf["id_kabkota"].astype(str).str.strip()
    prod_df["id_kabkota"] = prod_df["id_kabkota"].astype(str).str.strip()

    # =========================
    # DETECT LOP COLUMNS
    # =========================
    lop_cols = [c for c in gdf.columns if c.startswith("lop_drought_")]

    if not lop_cols:
        raise ValueError("Tidak ada kolom lop_drought_* ditemukan")

    # =========================
    # SIMPAN INFO ADMIN (SEBELUM DISSOLVE)
    # =========================
    info_cols = ["id_kabkota", "kab_kota", "prov"]

    gdf_info = (
        gdf[info_cols]
        .drop_duplicates(subset="id_kabkota")
    )

    # =========================
    # AGGREGATE LOP → KAB
    # =========================
    agg_dict = {col: "mean" for col in lop_cols}

    gdf_kab = gdf.dissolve(
        by="id_kabkota",
        aggfunc=agg_dict,
        as_index=False
    )

    # =========================
    # RESTORE ADMIN INFO
    # =========================
    gdf_kab = gdf_kab.merge(
        gdf_info,
        on="id_kabkota",
        how="left"
    )

    # =========================
    # JOIN PRODUKSI
    # =========================
    gdf_kab = gdf_kab.merge(
        prod_df[["id_kabkota", "total_prod"]],
        on="id_kabkota",
        how="left"
    )

    # =========================
    # HANDLE MISSING PRODUKSI
    # =========================
    missing = gdf_kab[gdf_kab["total_prod"].isnull()]

    if not missing.empty:
        print(f"⚠️ {len(missing)} wilayah tanpa total_prod → di-set 0")

    gdf_kab["total_prod"] = gdf_kab["total_prod"].fillna(0)

    # =========================
    # SAFETY CHECK: LOP harus dalam [0, 1]
    # =========================
    for col in lop_cols:
        out_of_range = gdf_kab[(gdf_kab[col] < 0) | (gdf_kab[col] > 1)]
        if not out_of_range.empty:
            print(
                f"⚠️ [LOP RANGE] Kolom '{col}' memiliki {len(out_of_range)} nilai "
                f"di luar [0, 1]: min={gdf_kab[col].min():.4f}, max={gdf_kab[col].max():.4f}"
            )

    # =========================
    # COMPUTE LOSS
    # =========================
    for col in lop_cols:

        rp = extract_rp(col)

        if "rc" in col:
            out_col = f"loss_drought_climate_rp{rp}"
        else:
            out_col = f"loss_drought_nonclimate_rp{rp}"

        # LOP = fraksi kehilangan produksi [0, 1]; loss = LOP × total_prod × gabah
        gdf_kab[out_col] = (
            gdf_kab["total_prod"] *
            gdf_kab[col] *
            gabah
        )

        # Debug: 3 sampel wilayah pertama per kolom LOP
        sample = gdf_kab[["id_kabkota", "total_prod", col, out_col]].head(3)
        for _, row in sample.iterrows():
            print(
                f"[DEBUG] {row['id_kabkota']} | total_prod={row['total_prod']:.0f} | "
                f"LOP({col})={row[col]:.4f} | loss={row[out_col]:.2f}"
            )

    # =========================
    # CLEAN GEOMETRY
    # =========================
    gdf_kab = gdf_kab.set_geometry("geometry")

    # =========================
    # OPTIONAL: ROUND
    # =========================
    for col in gdf_kab.columns:
        if gdf_kab[col].dtype == "float":
            gdf_kab[col] = gdf_kab[col].round(2)

    return gdf_kab
