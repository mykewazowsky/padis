import geopandas as gpd
from psycopg2.extras import execute_values

from scripts.utils.db import get_conn
from scripts.utils.parser import parse_aal
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
    print("🔄 Loading AAL (FINAL - VERSIONED)...")

    conn = get_conn()
    cur = conn.cursor()

    try:
        hazards, scenarios = get_lookup(cur)
        run_id = get_active_run_id(cur)

        # 🔥 deduplicate pakai dict
        data_map = {}

        # ===============================
        # LOOP FILE
        # ===============================
        for path in FILES_ANALYSIS.values():
            print(f"📂 Processing: {path}")

            gdf = gpd.read_file(path).fillna(0)

            for _, row in gdf.iterrows():
                id_kab = str(row["id_kabkota"]).strip()

                for col in gdf.columns:
                    if not col.startswith("aal_"):
                        continue

                    try:
                        hazard, scenario = parse_aal(col)

                        # fix naming
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
                        print(f"⚠️ Skip {col}: {e}")

        # ===============================
        # PREPARE DATA
        # ===============================
        batch_data = [
            (*k, v) for k, v in data_map.items()
        ]

        print(f"🚀 Total rows to insert: {len(batch_data)}")

        # ===============================
        # CLEAN OLD DATA
        # ===============================
        cur.execute("DELETE FROM aal WHERE run_id = %s;", (run_id,))

        # ===============================
        # BULK INSERT (UPSERT)
        # ===============================
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
        print("✅ AAL loaded successfully (VERSIONED & CLEAN)")

    except Exception as e:
        conn.rollback()
        print("❌ Failed loading AAL:", e)

    finally:
        cur.close()
        conn.close()
