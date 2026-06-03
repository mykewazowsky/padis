import os
import numpy as np
import geopandas as gpd


# =========================
# VALIDATION
# =========================
def require_file(path: str, label: str) -> None:
    if not os.path.exists(path):
        raise FileNotFoundError(f"{label} tidak ditemukan: {path}")


# =========================
# LOAD
# =========================
def load_vector(path: str, verbose: bool = True) -> gpd.GeoDataFrame:
    require_file(path, "Vector file")

    if verbose:
        print(f"[LOAD] {os.path.basename(path)}")

    gdf = gpd.read_file(path)

    if gdf.empty:
        raise ValueError(f"GeoDataFrame kosong: {path}")

    return gdf


# =========================
# CRS
# =========================
def ensure_crs(
    gdf: gpd.GeoDataFrame,
    target_crs: str = "EPSG:4326",
    verbose: bool = True,
) -> gpd.GeoDataFrame:

    if gdf.crs is None:
        raise ValueError("CRS tidak ada pada GeoDataFrame")

    if gdf.crs.to_string() != target_crs:
        if verbose:
            print(f"[REPROJECT] → {target_crs}")
        gdf = gdf.to_crs(target_crs)

    return gdf


def align_crs(
    gdf1: gpd.GeoDataFrame,
    gdf2: gpd.GeoDataFrame,
    verbose: bool = True,
) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:

    if gdf1.crs != gdf2.crs:
        if verbose:
            print("[ALIGN CRS] Menyamakan CRS")
        gdf2 = gdf2.to_crs(gdf1.crs)

    return gdf1, gdf2


# =========================
# GEOMETRY FIX
# =========================
def fix_geometry(gdf: gpd.GeoDataFrame, verbose: bool = True) -> gpd.GeoDataFrame:
    if verbose:
        print("[FIX] Geometry cleanup")

    gdf["geometry"] = gdf["geometry"].buffer(0)

    gdf = gdf[gdf.is_valid]
    gdf = gdf[~gdf.geometry.is_empty]
    gdf = gdf[gdf.geometry.type.isin(["Polygon", "MultiPolygon"])]

    return gdf.reset_index(drop=True)


# =========================
# OVERLAY
# =========================
def run_overlay(
    gdf_a: gpd.GeoDataFrame,
    gdf_b: gpd.GeoDataFrame,
    how: str = "intersection",
    verbose: bool = True,
) -> gpd.GeoDataFrame:

    gdf_a, gdf_b = align_crs(gdf_a, gdf_b, verbose=verbose)

    result = gpd.overlay(
        gdf_a,
        gdf_b,
        how=how,
        keep_geom_type=False
    )

    result = result[result.geometry.type.isin(["Polygon", "MultiPolygon"])]
    result = result.reset_index(drop=True)

    if result.empty:
        raise ValueError("Hasil overlay kosong")

    return result


# =========================
# ASSIGN KABKOTA (LARGEST OVERLAP)
# =========================
def _assign_kabkota_by_largest_overlap(
    sawah: gpd.GeoDataFrame,
    regions: gpd.GeoDataFrame,
    verbose: bool = True,
) -> gpd.GeoDataFrame:
    """
    Tetapkan setiap polygon sawah ke kabkota yang paling banyak tumpang tindih
    (largest area overlap). Geometri sawah TIDAK dipotong — seluruh polygon
    dipertahankan sehingga tidak ada area yang hilang.

    Metode:
      1. sjoin (intersects) → temukan semua pasangan sawah-kabkota
      2. Untuk sawah yang hanya beririsan dengan satu kabkota → langsung assign
      3. Untuk sawah yang beririsan dengan beberapa kabkota → hitung area
         intersection dalam projected CRS, pilih kabkota dengan area terbesar
    """
    admin_cols = ["id_kabkota", "id_prov", "kab_kota", "prov"]

    # Proyeksi ke UTM untuk kalkulasi area yang akurat
    proj_crs   = "EPSG:32749"  # UTM zone 49S — cocok untuk Indonesia
    sawah_proj   = sawah.to_crs(proj_crs)
    regions_proj = regions[admin_cols + ["geometry"]].to_crs(proj_crs)

    sawah_proj = sawah_proj.reset_index(drop=True)
    sawah_proj["_sawah_idx"] = sawah_proj.index

    if verbose:
        print("[SJOIN] Mencari pasangan sawah–kabkota (intersects)...")

    joined = gpd.sjoin(
        sawah_proj,
        regions_proj,
        how="left",
        predicate="intersects",
    ).reset_index(drop=True)

    # Sawah tanpa pasangan (tidak beririsan dengan kabkota manapun) → lewati
    no_match_mask = joined["id_kabkota"].isna()
    if verbose and no_match_mask.any():
        n_no = joined.loc[no_match_mask, "_sawah_idx"].nunique()
        print(f"[WARN] {n_no} sawah tidak beririsan dengan kabkota manapun → dilewati")

    joined = joined[~no_match_mask].copy()

    # Sawah yang beririsan dengan tepat satu kabkota: tidak perlu hitung area
    counts = joined.groupby("_sawah_idx")["id_kabkota"].count()
    single_idx = counts[counts == 1].index
    multi_idx  = counts[counts > 1].index

    if verbose:
        print(f"[INFO] Sawah dengan 1 kabkota    : {len(single_idx):,}")
        print(f"[INFO] Sawah dengan >1 kabkota   : {len(multi_idx):,} → hitung area overlap")

    single_rows = joined[joined["_sawah_idx"].isin(single_idx)].copy()

    # Untuk sawah dengan >1 kabkota: hitung area intersection dan pilih terbesar
    if len(multi_idx) > 0:
        multi_sawah   = sawah_proj[sawah_proj["_sawah_idx"].isin(multi_idx)]
        multi_joined  = joined[joined["_sawah_idx"].isin(multi_idx)].copy()

        # Hitung area intersection per pasangan
        overlap_areas = []
        for sawah_i, region_id in zip(
            multi_joined["_sawah_idx"], multi_joined["id_kabkota"]
        ):
            s_geom = sawah_proj.loc[sawah_proj["_sawah_idx"] == sawah_i, "geometry"].iloc[0]
            r_geom = regions_proj.loc[
                regions_proj["id_kabkota"] == region_id, "geometry"
            ]
            if r_geom.empty:
                overlap_areas.append(0.0)
                continue
            try:
                inter = s_geom.intersection(r_geom.iloc[0])
                overlap_areas.append(inter.area)
            except Exception:
                overlap_areas.append(0.0)

        multi_joined["_overlap_area"] = overlap_areas

        # Pilih kabkota dengan area terbesar per sawah
        best_idx = (
            multi_joined.groupby("_sawah_idx")["_overlap_area"].idxmax()
        )
        best_rows = multi_joined.loc[best_idx].copy()
        best_rows = best_rows.drop(columns=["_overlap_area"], errors="ignore")
    else:
        best_rows = gpd.GeoDataFrame(columns=single_rows.columns, crs=proj_crs)

    # Gabungkan
    assigned = gpd.GeoDataFrame(
        gpd.pd.concat([single_rows, best_rows], ignore_index=True),
        crs=proj_crs,
    )

    # Kembalikan ke CRS asli (WGS84)
    assigned = assigned.to_crs(sawah.crs)

    # Pastikan kolom admin ada
    for col in admin_cols:
        if col not in assigned.columns:
            # Ambil dari regions berdasarkan id_kabkota
            lkp = regions.set_index("id_kabkota")[col]
            assigned[col] = assigned["id_kabkota"].map(lkp)

    return assigned.drop(columns=["_sawah_idx", "index_right"], errors="ignore")


# =========================
# MAIN FUNCTION (FINAL)
# =========================
def intersect_sawah_admin(
    regions_path: str,
    sawah_path: str,
    output_path: str,
    overwrite: bool = False,
    verbose: bool = True,
) -> str:
    """
    Gabungkan sawah dengan batas administrasi per kabkota.

    Pendekatan: sjoin largest-overlap (bukan strict clip intersection).
    Setiap polygon sawah dipertahankan utuh dan diassign ke kabkota
    yang paling banyak tumpang tindih — tidak ada area sawah yang hilang
    akibat pemotongan di batas admin.
    """
    if os.path.exists(output_path) and not overwrite:
        if verbose:
            print(f"[SKIP] Sudah ada: {output_path}")
        return output_path

    if verbose:
        print("\n[VECTOR] Sawah x Administrasi (metode: largest-overlap sjoin)")

    # =========================
    # LOAD REGIONS
    # =========================
    regions = load_vector(regions_path, verbose)
    regions = ensure_crs(regions, verbose=verbose)
    regions = fix_geometry(regions, verbose)

    required_cols = ["id_kabkota", "id_prov", "kab_kota", "prov"]
    missing_cols = [c for c in required_cols if c not in regions.columns]
    if missing_cols:
        raise ValueError(f"Kolom regions tidak lengkap: {missing_cols}")

    # =========================
    # LOAD SAWAH
    # =========================
    sawah = load_vector(sawah_path, verbose)
    sawah = ensure_crs(sawah, verbose=verbose)
    sawah = fix_geometry(sawah, verbose)

    # =========================
    # ASSIGN KABKOTA
    # =========================
    assigned = _assign_kabkota_by_largest_overlap(sawah, regions, verbose=verbose)

    if verbose:
        print(f"[INFO] Sawah berhasil diassign: {len(assigned):,}")

    # =========================
    # DISSOLVE PER KABKOTA
    # =========================
    if verbose:
        print("[DISSOLVE] Menggabungkan sawah per kabupaten...")

    numeric_cols = [
        c for c in assigned.columns
        if c not in ("id_kabkota", "geometry") + tuple(required_cols)
        and assigned[c].dtype.kind in ("i", "f")
    ]
    text_cols = [
        c for c in assigned.columns
        if c not in ("id_kabkota", "geometry") + tuple(required_cols)
        and c not in numeric_cols
    ]
    aggfunc = {c: "sum" for c in numeric_cols}
    aggfunc.update({c: "first" for c in text_cols})
    for col in required_cols:
        if col != "id_kabkota" and col in assigned.columns:
            aggfunc[col] = "first"

    result = assigned.dissolve(by="id_kabkota", aggfunc=aggfunc, as_index=False)

    if verbose:
        print(f"[INFO] Jumlah kabupaten setelah dissolve: {len(result)}")
        # Bandingkan area
        raw_ha   = sawah.to_crs("EPSG:32749").geometry.area.sum() / 10_000
        res_ha   = result.to_crs("EPSG:32749").geometry.area.sum() / 10_000
        print(f"[INFO] Area sawah raw   : {raw_ha:,.0f} ha")
        print(f"[INFO] Area hasil dissolve: {res_ha:,.0f} ha")
        print(f"[INFO] Retensi area     : {res_ha/raw_ha*100:.1f}%")

    # =========================
    # SAVE
    # =========================
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    result.to_file(output_path, driver="GeoJSON")

    if verbose:
        print(f"\n✅ Saved: {output_path}")

    return output_path
