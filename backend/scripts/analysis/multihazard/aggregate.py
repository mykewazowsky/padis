def aggregate_multihazard(gdf):

    # =========================
    # REQUIRED COLUMNS
    # =========================
    required_cols = [
        "id_kabkota",
        "kab_kota",
        "prov",
        "total_prod",
        "aal_multi_nonclimate",
        "aal_multi_climate",
        "geometry"
    ]

    missing = [c for c in required_cols if c not in gdf.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ditemukan: {missing}")

    # =========================
    # INCLUDE LOSS (WAJIB)
    # =========================
    loss_cols = sorted(
        [c for c in gdf.columns if c.startswith("loss_multi_")]
    )

    if not loss_cols:
        print("⚠️ Tidak ada kolom loss_multi_* ditemukan")

    # =========================
    # FINAL STRUCTURE
    # =========================
    keep_cols = required_cols + loss_cols

    # remove duplicate (safety)
    keep_cols = list(dict.fromkeys(keep_cols))

    return gdf[keep_cols].copy()