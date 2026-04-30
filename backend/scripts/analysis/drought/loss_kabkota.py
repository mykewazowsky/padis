import re

_DEBUG_IDS = {"33.20", "35.10", "35.20"}


def extract_rp(col_name: str) -> int:
    match = re.search(r"(\d+)", col_name)
    if not match:
        raise ValueError(f"Tidak bisa ekstrak RP dari kolom: {col_name}")
    return int(match.group(1))


def _normalize_id(val) -> str | None:
    """
    Normalisasi id_kabkota ke format XX.XX.

    Bagian kanan menggunakan ljust bukan zfill agar:
    - "2"  → "20" (bukan "02")
    - "33.2" → "33.20" (bukan "33.02")
    """
    try:
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none"):
            return None
        s = s.replace(",", ".")
        parts = s.split(".")
        left = parts[0].zfill(2)
        if len(parts) == 1:
            return f"{left}.00"
        right_raw = parts[1]
        if len(right_raw) == 0:
            right = "00"
        elif len(right_raw) == 1:
            right = right_raw.ljust(2, "0")
        elif len(right_raw) == 2:
            right = right_raw
        else:
            right = right_raw[:2]
        return f"{left}.{right}"
    except Exception:
        return None


def compute_loss_drought_kab(gdf, prod_df, gabah):

    # =========================
    # PREPARE
    # =========================
    gdf = gdf.copy()
    prod_df = prod_df.copy()

    # NORMALISASI ID SEBELUM DISSOLVE
    # ljust bukan zfill: "33.2" → "33.20" bukan "33.02"
    gdf["id_kabkota"] = gdf["id_kabkota"].apply(_normalize_id)
    prod_df["id_kabkota"] = prod_df["id_kabkota"].apply(_normalize_id)

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
    # DEBUG: sample ID sebelum join produksi (TASK 1)
    # =========================
    sample_gdf  = list(gdf_kab["id_kabkota"].dropna().unique()[:10])
    sample_prod = list(prod_df["id_kabkota"].dropna().unique()[:10])
    print(f"[DEBUG] sample id gdf_kab: {sample_gdf}")
    print(f"[DEBUG] sample id prod_df: {sample_prod}")

    missing_ids = set(gdf_kab["id_kabkota"].dropna()) - set(prod_df["id_kabkota"].dropna())
    if missing_ids:
        print(f"[DEBUG] ID di gdf tidak ada di prod_df (maks 20): {sorted(missing_ids)[:20]}")

    # =========================
    # JOIN PRODUKSI
    # =========================
    gdf_kab = gdf_kab.merge(
        prod_df[["id_kabkota", "total_prod"]],
        on="id_kabkota",
        how="left"
    )

    # =========================
    # DEBUG: verifikasi ID kritis setelah merge (TASK 3)
    # =========================
    for cid in sorted(_DEBUG_IDS):
        val = gdf_kab[gdf_kab["id_kabkota"] == cid]["total_prod"]
        print(f"[DEBUG AFTER MERGE] {cid} total_prod = "
              f"{val.values if not val.empty else 'NOT FOUND'}")

    # =========================
    # HANDLE MISSING PRODUKSI (TASK 5 — fail fast + logging)
    # =========================
    missing = gdf_kab[gdf_kab["total_prod"].isna()]

    if not missing.empty:
        print(f"[ERROR] {len(missing)} wilayah tanpa data produksi (total_prod akan di-set 0):")
        print(missing[["id_kabkota", "kab_kota"]].head(20).to_string(index=False))

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

        # Debug: kode kritis (TASK 8)
        for cid in sorted(_DEBUG_IDS):
            rows = gdf_kab[gdf_kab["id_kabkota"] == cid]
            if not rows.empty:
                r = rows.iloc[0]
                print(f"[CHECK] {r['id_kabkota']} | prod={r['total_prod']:.0f} | "
                      f"LOP={r[col]:.4f} | loss={r[out_col]:.2f}")

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
