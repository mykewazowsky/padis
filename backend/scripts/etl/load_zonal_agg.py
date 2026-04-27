from pathlib import Path

import geopandas as gpd
from psycopg2.extras import execute_values

from backend.scripts.utils.parser import parse_zonal
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_ZONAL


def _get_lookup(cur):
    cur.execute("SELECT id, name FROM hazards")
    hazards = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, name FROM scenarios")
    scenarios = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, rp FROM return_periods")
    rps = {rp: id for id, rp in cur.fetchall()}

    return hazards, scenarios, rps


def _select_files(hazard: str) -> list:
    """
    Return the FILES_ZONAL subset relevant for the given hazard.
    Multihazard zonal is derived from flood + drought — no separate zonal file exists.
    """
    if hazard == "multi":
        return list(FILES_ZONAL)
    return [f for f in FILES_ZONAL if hazard in str(f).lower()]


def run(cur, run_id: int, hazard: str = "multi") -> None:
    """
    Memuat data zonal aggregation ke dalam tabel zonal_kabupaten menggunakan
    cursor yang diberikan. Tidak melakukan commit — tanggung jawab caller (run_all.py).
    Raise exception jika gagal agar caller dapat melakukan rollback.
    """
    log.info("ZONAL-AGG", f"Memuat data zonal aggregation (hazard={hazard})...")

    hazards, scenarios, rps = _get_lookup(cur)
    data_map = {}

    for path in _select_files(hazard):
        full_path = Path(path)
        if not full_path.exists():
            log.warn("ZONAL-AGG", f"File tidak ditemukan, dilewati: {full_path}")
            continue

        log.info("ZONAL-AGG", f"Baca file: {full_path}")
        gdf = gpd.read_file(full_path).fillna(0)

        for _, row in gdf.iterrows():
            id_kab = str(row.get("id_kabkota", "")).strip()
            if not id_kab:
                continue

            for col in gdf.columns:
                if not col.startswith("mean_"):
                    continue

                try:
                    hazard_col, scenario, rp = parse_zonal(col)

                    if hazard_col == "multi":
                        hazard_col = "multihazard"

                    if hazard_col not in hazards or scenario not in scenarios or rp not in rps:
                        continue

                    key = (id_kab, hazards[hazard_col], scenarios[scenario], rps[rp], run_id)
                    if key not in data_map:
                        data_map[key] = []
                    data_map[key].append(float(row[col]))

                except Exception:
                    continue

    batch_data = [(*k, sum(v) / len(v)) for k, v in data_map.items()]
    log.info("ZONAL-AGG", f"Total baris: {len(batch_data)}")

    cur.execute("DELETE FROM zonal_kabupaten WHERE run_id = %s", (run_id,))
    execute_values(
        cur,
        """
        INSERT INTO zonal_kabupaten (
            id_kabkota, hazard_id, scenario_id, rp_id, run_id, mean_value
        )
        VALUES %s
        ON CONFLICT (id_kabkota, hazard_id, scenario_id, rp_id, run_id)
        DO UPDATE SET mean_value = EXCLUDED.mean_value
        """,
        batch_data,
        page_size=1000,
    )

    log.ok("ZONAL-AGG", f"Data zonal siap: {len(batch_data)} baris")
