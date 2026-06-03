from pathlib import Path

import geopandas as gpd
from psycopg2.extras import execute_values

from backend.scripts.utils.parser import parse_loss
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_ANALYSIS


def _get_lookup(cur):
    cur.execute("SELECT id, name FROM hazards")
    hazards = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, name FROM scenarios")
    scenarios = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, rp FROM return_periods")
    rps = {rp: id for id, rp in cur.fetchall()}

    return hazards, scenarios, rps


def _select_files(hazard: str) -> dict:
    """Return the FILES_ANALYSIS subset relevant for the given hazard."""
    if hazard == "flood":
        return {"flood": FILES_ANALYSIS["flood"]}
    if hazard == "drought":
        return {"drought": FILES_ANALYSIS["drought"]}
    return FILES_ANALYSIS  # "multi" — all three


def prepare_data(hazard: str) -> list[tuple]:
    """
    Baca GeoJSON dan kembalikan baris mentah sebagai list of tuple:
        (id_kabkota, hazard_name, scenario_name, rp, loss_value)

    Tidak butuh koneksi DB — dipanggil sebelum koneksi dibuka agar
    koneksi tidak idle selama pembacaan file besar.
    """
    rows: list[tuple] = []

    for key, path in _select_files(hazard).items():
        full_path = Path(path)
        if not full_path.exists():
            log.warn("LOSSES", f"File tidak ditemukan, dilewati: {full_path}")
            continue

        log.info("LOSSES", f"Baca file: {full_path}")
        gdf = gpd.read_file(full_path).fillna(0)

        for _, row in gdf.iterrows():
            id_kab = str(row["id_kabkota"]).strip()
            for col in gdf.columns:
                if not col.startswith("loss_"):
                    continue
                try:
                    hazard_col, scenario, rp = parse_loss(col)
                    if hazard_col == "multi":
                        hazard_col = "multihazard"
                    rows.append((id_kab, hazard_col, scenario, rp, float(row[col])))
                except Exception as e:
                    log.warn("LOSSES", f"Lewati kolom {col}: {e}")

    log.info("LOSSES", f"Total baris disiapkan: {len(rows)}")
    return rows


def run(cur, run_id: int, hazard: str = "multi",
        _prepared: list[tuple] | None = None) -> None:
    """
    Memuat data losses ke tabel losses menggunakan cursor yang diberikan.
    Tidak melakukan commit — tanggung jawab caller (run_all.py).

    _prepared — opsional: hasil prepare_data() yang sudah dibaca sebelumnya.
    Jika None, prepare_data() dipanggil di sini (mode lama, bisa timeout).
    """
    log.info("LOSSES", f"Memuat data losses (hazard={hazard})...")

    data_rows = _prepared if _prepared is not None else prepare_data(hazard)
    hazards, scenarios, rps = _get_lookup(cur)

    data_map: dict = {}
    skipped_unknown = 0

    for id_kab, hazard_col, scenario, rp, val in data_rows:
        if hazard_col not in hazards:
            skipped_unknown += 1
            continue
        if scenario not in scenarios or rp not in rps:
            continue
        key = (id_kab, hazards[hazard_col], scenarios[scenario], rps[rp], run_id)
        data_map[key] = val

    batch_data = [(*k, v) for k, v in data_map.items()]

    log.info("LOSSES", f"Total baris: {len(batch_data)}")
    if skipped_unknown:
        log.warn("LOSSES", f"Hazard tidak dikenal, dilewati: {skipped_unknown}")

    cur.execute("DELETE FROM losses WHERE run_id = %s", (run_id,))
    execute_values(
        cur,
        """
        INSERT INTO losses (id_kabkota, hazard_id, scenario_id, rp_id, run_id, loss)
        VALUES %s
        ON CONFLICT (id_kabkota, hazard_id, scenario_id, rp_id, run_id)
        DO UPDATE SET loss = EXCLUDED.loss
        """,
        batch_data,
        page_size=1000,
    )

    log.ok("LOSSES", f"Data losses siap: {len(batch_data)} baris")
