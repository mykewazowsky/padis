import os
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
# MAIN FUNCTION (FINAL)
# =========================
def intersect_sawah_admin(
    regions_path: str,
    sawah_path: str,
    output_path: str,
    overwrite: bool = False,
    verbose: bool = True,
) -> str:

    if os.path.exists(output_path) and not overwrite:
        if verbose:
            print(f"[SKIP] Sudah ada: {output_path}")
        return output_path

    if verbose:
        print("\n[VECTOR] Sawah x Administrasi")

    # =========================
    # LOAD REGIONS
    # =========================
    regions = load_vector(regions_path, verbose)
    regions = ensure_crs(regions, verbose=verbose)
    regions = fix_geometry(regions, verbose)

    required_cols = ["id_kabkota", "id_prov", "kab_kota", "prov"]
    missing = [c for c in required_cols if c not in regions.columns]
    if missing:
        raise ValueError(f"Kolom regions tidak lengkap: {missing}")

    # =========================
    # LOAD SAWAH
    # =========================
    sawah = load_vector(sawah_path, verbose)
    sawah = ensure_crs(sawah, verbose=verbose)
    sawah = fix_geometry(sawah, verbose)

    # =========================
    # OVERLAY
    # =========================
    result = run_overlay(sawah, regions, how="intersection", verbose=verbose)

    if verbose:
        print(f"[INFO] Jumlah polygon hasil overlay: {len(result)}")

    # =========================
    # 🔥 DISSOLVE (PENTING)
    # =========================
    if verbose:
        print("[DISSOLVE] Menggabungkan sawah per kabupaten")

    result = result.dissolve(by="id_kabkota", as_index=False)

    if verbose:
        print(f"[INFO] Jumlah kabupaten setelah dissolve: {len(result)}")

    # =========================
    # SAVE
    # =========================
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    result.to_file(output_path, driver="GeoJSON")

    if verbose:
        print(f"\n✅ Saved: {output_path}")

    return output_path