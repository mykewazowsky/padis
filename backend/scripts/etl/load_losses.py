import geopandas as gpd
from psycopg2.extras import execute_values

from backend.scripts.utils.db import get_conn
from backend.scripts.utils.parser import parse_loss
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_ANALYSIS


# ===============================
# GET ACTIVE RUN
# ===============================
def get_active_run_id(cur):
    cur.execute("SELECT id FROM runs WHERE is_active = TRUE LIMIT 1;")
    result = cur.fetchone()

    if not result:
        raise ValueError("Tidak ada run aktif di tabel runs")

    return result[0]


# ===============================
# LOAD LOOKUP TABLE
# ===============================
def get_lookup(cur):
    cur.execute("SELECT id, name FROM hazards")
    hazards = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, name FROM scenarios")
    scenarios = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, rp FROM return_periods")
    rps = {rp: id for id, rp in cur.fetchall()}

    return hazards, scenarios, rps


# ===============================
# MAIN
# ===============================
def run(run_id):
    log.info("LOSSES", "Memuat data losses...")

    conn = get_conn()
    cur = conn.cursor()

    try:
        hazards, scenarios, rps = get_lookup(cur)
        run_id = get_active_run_id(cur)

        data_map = {}
        skipped_unknown = 0

        for path in FILES_ANALYSIS.values():
            log.info("LOSSES", f"Baca file: {path}")

            gdf = gpd.read_file(path).fillna(0)

            for _, row in gdf.iterrows():
                id_kab = str(row["id_kabkota"]).strip()

                for col in gdf.columns:
                    if not col.startswith("loss_"):
                        continue

                    try:
                        hazard, scenario, rp = parse_loss(col)

                        if hazard == "multi":
                            hazard = "multihazard"

                        if hazard not in hazards:
                            skipped_unknown += 1
                            continue

                        if scenario not in scenarios:
                            continue

                        if rp not in rps:
                            continue

                        val = float(row[col])

                        key = (
                            id_kab,
                            hazards[hazard],
                            scenarios[scenario],
                            rps[rp],
                            run_id
                        )

                        data_map[key] = val

                    except Exception as e:
                        log.warn("LOSSES", f"Lewati kolom {col}: {e}")

        batch_data = [(*k, v) for k, v in data_map.items()]

        log.info("LOSSES", f"Total baris: {len(batch_data)}")
        if skipped_unknown:
            log.warn("LOSSES", f"Hazard tidak dikenal, dilewati: {skipped_unknown}")

        cur.execute("DELETE FROM losses WHERE run_id = %s;", (run_id,))

        execute_values(
            cur,
            """
            INSERT INTO losses (
                id_kabkota, hazard_id, scenario_id, rp_id, run_id, loss
            )
            VALUES %s
            ON CONFLICT (id_kabkota, hazard_id, scenario_id, rp_id, run_id)
            DO UPDATE SET loss = EXCLUDED.loss
            """,
            batch_data,
            page_size=1000
        )

        conn.commit()
        log.ok("LOSSES", "Data losses berhasil dimuat")

    except Exception as e:
        conn.rollback()
        log.error("LOSSES", f"Gagal memuat losses: {e}")

    finally:
        cur.close()
        conn.close()
