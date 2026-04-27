from pathlib import Path

import geopandas as gpd
from psycopg2.extras import execute_values

from backend.scripts.utils.parser import parse_aal
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_ANALYSIS


def _get_lookup(cur):
    cur.execute("SELECT id, name FROM hazards")
    hazards = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, name FROM scenarios")
    scenarios = {name: id for id, name in cur.fetchall()}

    return hazards, scenarios


def _select_files(hazard: str) -> dict:
    """Return the FILES_ANALYSIS subset relevant for the given hazard."""
    if hazard == "flood":
        return {"flood": FILES_ANALYSIS["flood"]}
    if hazard == "drought":
        return {"drought": FILES_ANALYSIS["drought"]}
    return FILES_ANALYSIS  # "multi" — all three


def run(cur, run_id: int, hazard: str = "multi") -> None:
    """
    Memuat data AAL ke dalam tabel aal menggunakan cursor yang diberikan.
    Tidak melakukan commit — tanggung jawab caller (run_all.py).
    Raise exception jika gagal agar caller dapat melakukan rollback.
    """
    log.info("AAL", f"Memuat data AAL (hazard={hazard})...")

    hazards, scenarios = _get_lookup(cur)
    data_map = {}

    for key, path in _select_files(hazard).items():
        full_path = Path(path)
        if not full_path.exists():
            log.warn("AAL", f"File tidak ditemukan, dilewati: {full_path}")
            continue

        log.info("AAL", f"Baca file: {full_path}")
        gdf = gpd.read_file(full_path).fillna(0)

        for _, row in gdf.iterrows():
            id_kab = str(row["id_kabkota"]).strip()

            for col in gdf.columns:
                if not col.startswith("aal_"):
                    continue

                try:
                    hazard_col, scenario = parse_aal(col)

                    if hazard_col == "multi":
                        hazard_col = "multihazard"

                    if hazard_col not in hazards or scenario not in scenarios:
                        continue

                    data_key = (id_kab, hazards[hazard_col], scenarios[scenario], run_id)
                    data_map[data_key] = float(row[col])

                except Exception as e:
                    log.warn("AAL", f"Lewati kolom {col}: {e}")

    batch_data = [(*k, v) for k, v in data_map.items()]
    log.info("AAL", f"Total baris: {len(batch_data)}")

    cur.execute("DELETE FROM aal WHERE run_id = %s", (run_id,))
    execute_values(
        cur,
        """
        INSERT INTO aal (id_kabkota, hazard_id, scenario_id, run_id, aal)
        VALUES %s
        ON CONFLICT (id_kabkota, hazard_id, scenario_id, run_id)
        DO UPDATE SET aal = EXCLUDED.aal
        """,
        batch_data,
        page_size=1000,
    )

    log.ok("AAL", f"Data AAL siap: {len(batch_data)} baris")
