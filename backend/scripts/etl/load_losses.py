import geopandas as gpd
from psycopg2.extras import execute_values

from scripts.utils.db import get_conn
from scripts.utils.parser import parse_loss
from scripts.config.settings import FILES_ANALYSIS


# ===============================
# GET ACTIVE RUN
# ===============================
def get_active_run_id(cur):
    cur.execute("SELECT id FROM runs WHERE is_active = TRUE LIMIT 1;")
    result = cur.fetchone()

    if not result:
        raise ValueError("❌ Tidak ada run aktif")

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
    print("🔄 Loading losses (FINAL - VERSIONED)...")

    conn = get_conn()
    cur = conn.cursor()

    try:
        hazards, scenarios, rps = get_lookup(cur)
        run_id = get_active_run_id(cur)

        # 🔥 pakai dict untuk deduplikasi
        data_map = {}

        skipped_unknown = 0

        # ===============================
        # LOOP FILE
        # ===============================
        for path in FILES_ANALYSIS.values():
            print(f"📂 Processing: {path}")

            gdf = gpd.read_file(path).fillna(0)

            for _, row in gdf.iterrows():
                id_kab = str(row["id_kabkota"]).strip()

                for col in gdf.columns:
                    if not col.startswith("loss_"):
                        continue

                    try:
                        hazard, scenario, rp = parse_loss(col)

                        # FIX multi naming
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

                        # 🔥 overwrite jika duplikat
                        data_map[key] = val

                    except Exception as e:
                        print(f"⚠️ Skip col {col}: {e}")

        # ===============================
        # PREPARE FINAL DATA
        # ===============================
        batch_data = [
            (*k, v) for k, v in data_map.items()
        ]

        print(f"🚀 Total rows to insert: {len(batch_data)}")
        print(f"⚠️ Skipped unknown hazard: {skipped_unknown}")

        # ===============================
        # DELETE OLD DATA FOR THIS RUN
        # ===============================
        cur.execute("DELETE FROM losses WHERE run_id = %s;", (run_id,))

        # ===============================
        # BULK INSERT (UPSERT)
        # ===============================
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
        print("✅ Losses loaded successfully (VERSIONED & CLEAN)")

    except Exception as e:
        conn.rollback()
        print("❌ Failed loading losses:", e)

    finally:
        cur.close()
        conn.close()
