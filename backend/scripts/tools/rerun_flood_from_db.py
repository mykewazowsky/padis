"""
rerun_flood_from_db.py

Ambil mean_flood_* dan mean_drought_* dari run terakhir di Supabase
(tabel zonal_kabupaten), rekonstruksi GeoDataFrame zonal, lalu jalankan ulang:
  1. flood_pipeline     (LOP baru otomatis terpakai dari lop.py)
  2. drought_pipeline   (wajib agar timestamp flood & drought sinkron)
  3. multihazard_pipeline

Usage (dari direktori backend/):
    python -m scripts.tools.rerun_flood_from_db
    python -m scripts.tools.rerun_flood_from_db --run-id 42
    python -m scripts.tools.rerun_flood_from_db --dry-run
    python -m scripts.tools.rerun_flood_from_db --skip-drought   # hanya flood + multi
"""

import argparse
import sys
from pathlib import Path

# Tambahkan root project ke sys.path agar import backend.scripts.* berfungsi
# baik saat dijalankan dari backend/ maupun dari root project.
_BACKEND_DIR = Path(__file__).resolve().parents[3]  # .../PADIS
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import geopandas as gpd
import pandas as pd

from backend.scripts.utils.db import get_conn
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_ADMIN, ZONAL_DIR
from backend.scripts.config.analysis_registry import (
    flood_pipeline,
    drought_pipeline,
    multihazard_pipeline,
)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _fetch_last_run_id_for_hazard(cur, hazard_name: str) -> int:
    cur.execute("""
        SELECT zk.run_id
        FROM   zonal_kabupaten zk
        JOIN   hazards h ON zk.hazard_id = h.id
        WHERE  h.name = %s
        ORDER  BY zk.run_id DESC
        LIMIT  1
    """, (hazard_name,))
    row = cur.fetchone()
    if row is None:
        raise RuntimeError(f"Tidak ada data {hazard_name} di tabel zonal_kabupaten.")
    return row[0]


def _fetch_zonal(cur, hazard_name: str, run_id: int) -> pd.DataFrame:
    """
    Return DataFrame: id_kabkota, scenario_name, rp, mean_value
    """
    cur.execute("""
        SELECT zk.id_kabkota,
               s.name  AS scenario_name,
               rp.rp   AS rp,
               zk.mean_value
        FROM   zonal_kabupaten zk
        JOIN   hazards        h  ON zk.hazard_id  = h.id
        JOIN   scenarios      s  ON zk.scenario_id = s.id
        JOIN   return_periods rp ON zk.rp_id       = rp.id
        WHERE  h.name    = %s
          AND  zk.run_id = %s
    """, (hazard_name, run_id))
    rows = cur.fetchall()
    if not rows:
        raise RuntimeError(f"Tidak ada data {hazard_name} untuk run_id={run_id}.")
    return pd.DataFrame(rows, columns=["id_kabkota", "scenario_name", "rp", "mean_value"])


# ---------------------------------------------------------------------------
# Pivot & geometry
# ---------------------------------------------------------------------------

def _col_name(hazard_name: str, scenario_name: str, rp: int) -> str:
    """
    Konversi ke nama kolom yang dipakai pipeline.

    Konvensi dari parse_zonal:
        climate    → mean_{hazard}_rc{rp}
        nonclimate → mean_{hazard}_r{rp}
    """
    prefix = "rc" if scenario_name == "climate" else "r"
    return f"mean_{hazard_name}_{prefix}{rp}"


def _pivot_to_wide(df: pd.DataFrame, hazard_name: str) -> pd.DataFrame:
    df = df.copy()
    df["col"] = df.apply(
        lambda row: _col_name(hazard_name, row["scenario_name"], row["rp"]), axis=1
    )
    wide = df.pivot_table(
        index="id_kabkota",
        columns="col",
        values="mean_value",
        aggfunc="mean",
    ).reset_index()
    wide.columns.name = None
    return wide


def _attach_geometry(wide: pd.DataFrame) -> gpd.GeoDataFrame:
    # Ambil semua kolom regions (termasuk kab_kota, prov) — dibutuhkan loss_kabkota
    regions = gpd.read_file(str(FILES_ADMIN["regions"])).copy()
    regions["id_kabkota"] = regions["id_kabkota"].astype(str).str.strip()
    wide["id_kabkota"]    = wide["id_kabkota"].astype(str).str.strip()
    return regions.merge(wide, on="id_kabkota", how="left")


def _build_zonal_gdf(cur, hazard_name: str, run_id: int, label: str) -> gpd.GeoDataFrame:
    log.info("DB", f"Fetch zonal {label} (run_id={run_id})")
    df_long = _fetch_zonal(cur, hazard_name, run_id)
    log.info("DB", f"  {len(df_long)} baris, {df_long['id_kabkota'].nunique()} kabupaten/kota")

    wide = _pivot_to_wide(df_long, hazard_name)
    mean_cols = [c for c in wide.columns if c.startswith(f"mean_{hazard_name}_")]
    log.info("PIVOT", f"  Kolom: {mean_cols}")

    if not mean_cols:
        raise RuntimeError(f"Tidak ada kolom mean_{hazard_name}_* — periksa data di Supabase.")

    return _attach_geometry(wide)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Re-run flood → drought → multihazard dari data Supabase."
    )
    parser.add_argument("--run-id", type=int, default=None,
                        help="run_id Supabase. Default: run terakhir dengan data flood.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Hanya fetch & pivot — jangan jalankan pipeline.")
    parser.add_argument("--skip-drought", action="store_true",
                        help="Lewati drought pipeline (multihazard mungkin gagal staleness check).")
    args = parser.parse_args()

    log.header("RERUN FLOOD + DROUGHT + MULTIHAZARD FROM SUPABASE")

    # 1. Koneksi DB
    log.info("DB", "Menghubungkan ke Supabase...")
    conn = get_conn()
    cur  = conn.cursor()

    # 2. Tentukan run_id (pakai run terakhir yang punya data flood)
    run_id = args.run_id or _fetch_last_run_id_for_hazard(cur, "flood")
    log.ok("DB", f"Menggunakan run_id={run_id}")

    # 3. Fetch & pivot flood
    log.progress(1, 4, "Rekonstruksi zonal flood dari DB")
    gdf_flood = _build_zonal_gdf(cur, "flood", run_id, "flood")

    # 4. Fetch & pivot drought (kecuali --skip-drought)
    gdf_drought = None
    if not args.skip_drought:
        log.progress(2, 4, "Rekonstruksi zonal drought dari DB")
        gdf_drought = _build_zonal_gdf(cur, "drought", run_id, "drought")

    cur.close()
    conn.close()

    if args.dry_run:
        log.warn("DRY-RUN", "Mode dry-run — pipeline tidak dijalankan.")
        flood_cols   = [c for c in gdf_flood.columns if c.startswith("mean_flood_")]
        print("\n=== FLOOD SAMPLE ===")
        print(gdf_flood[["id_kabkota"] + flood_cols].head(5).to_string(index=False))
        if gdf_drought is not None:
            drought_cols = [c for c in gdf_drought.columns if c.startswith("mean_drought_")]
            print("\n=== DROUGHT SAMPLE ===")
            print(gdf_drought[["id_kabkota"] + drought_cols].head(5).to_string(index=False))
        return

    ZONAL_DIR.mkdir(parents=True, exist_ok=True)

    # 5. Simpan zonal flood → jalankan flood pipeline
    flood_zonal_path = str(ZONAL_DIR / "flood_stats_from_db.geojson")
    log.progress(3, 4, f"Simpan zonal flood → {flood_zonal_path}")
    gdf_flood.to_file(flood_zonal_path, driver="GeoJSON")

    log.header("FLOOD PIPELINE")
    flood_out = flood_pipeline(flood_zonal_path)
    log.ok("FLOOD", f"Output → {flood_out}")

    # 6. Simpan zonal drought → jalankan drought pipeline
    if not args.skip_drought and gdf_drought is not None:
        drought_zonal_path = str(ZONAL_DIR / "drought_stats_from_db.geojson")
        log.progress(4, 4, f"Simpan zonal drought → {drought_zonal_path}")
        gdf_drought.to_file(drought_zonal_path, driver="GeoJSON")

        log.header("DROUGHT PIPELINE")
        drought_out = drought_pipeline(drought_zonal_path)
        log.ok("DROUGHT", f"Output → {drought_out}")
    else:
        log.warn("DROUGHT", "Dilewati (--skip-drought). Multihazard mungkin gagal staleness check.")

    # 7. Multihazard (membaca flood + drought final dari OUTPUT_ANALYSIS_DIR)
    log.header("MULTIHAZARD PIPELINE")
    multi_out = multihazard_pipeline("")
    log.ok("MULTIHAZARD", f"Output → {multi_out}")

    log.header("SELESAI")
    log.ok("SUMMARY", (
        f"Flood    → {flood_out}\n"
        + (f"         Drought  → {drought_out}\n" if not args.skip_drought else "")
        + f"         Multi    → {multi_out}"
    ))


if __name__ == "__main__":
    main()
