import geopandas as gpd
from psycopg2.extras import execute_values

from backend.scripts.utils.db import get_conn
from backend.scripts.utils.parser import parse_aal
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
# LOAD LOOKUP
# ===============================
def get_lookup(cur):
    cur.execute("SELECT id, name FROM hazards")
    hazards = {name: id for id, name in cur.fetchall()}

    cur.execute("SELECT id, name FROM scenarios")
    scenarios = {name: id for id, name in cur.fetchall()}

    return hazards, scenarios


# ===============================
# MAIN
# ===============================
def run(run_id):
    log.info("AAL", "Memuat data AAL...")

    conn = get_conn()
    cur = conn.cursor()

    try:
        hazards, scenarios = get_lookup(cur)
        run_id = get_active_run_id(cur)

        data_map = {}

        for path in FILES_ANALYSIS.values():
            log.info("AAL", f"Baca file: {path}")

            gdf = gpd.read_file(path).fillna(0)

            for _, row in gdf.iterrows():
                id_kab = str(row["id_kabkota"]).strip()

                for col in gdf.columns:
                    if not col.startswith("aal_"):
                        continue

                    try:
                        hazard, scenario = parse_aal(col)

                        if hazard == "multi":
                            hazard = "multihazard"

                        if hazard not in hazards:
                            continue

                        if scenario not in scenarios:
                            continue

                        val = float(row[col])

                        key = (
                            id_kab,
                            hazards[hazard],
                            scenarios[scenario],
                            run_id
                        )

                        data_map[key] = val

                    except Exception as e:
                        log.warn("AAL", f"Lewati kolom {col}: {e}")

        batch_data = [(*k, v) for k, v in data_map.items()]

        log.info("AAL", f"Total baris: {len(batch_data)}")

        cur.execute("DELETE FROM aal WHERE run_id = %s;", (run_id,))

        execute_values(
            cur,
            """
            INSERT INTO aal (
                id_kabkota, hazard_id, scenario_id, run_id, aal
            )
            VALUES %s
            ON CONFLICT (id_kabkota, hazard_id, scenario_id, run_id)
            DO UPDATE SET aal = EXCLUDED.aal
            """,
            batch_data,
            page_size=1000
        )

        conn.commit()
        log.ok("AAL", "Data AAL berhasil dimuat")

    except Exception as e:
        conn.rollback()
        log.error("AAL", f"Gagal memuat AAL: {e}")

    finally:
        cur.close()
        conn.close()
