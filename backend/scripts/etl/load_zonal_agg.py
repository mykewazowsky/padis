import geopandas as gpd
from psycopg2.extras import execute_values

from scripts.utils.db import get_conn
from scripts.utils.parser import parse_zonal
from scripts.config.settings import FILES_ZONAL


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

    cur.execute("SELECT id, rp FROM return_periods")
    rps = {rp: id for id, rp in cur.fetchall()}

    return hazards, scenarios, rps


# ===============================
# MAIN
# ===============================
def run(run_id):
    print("🔄 Loading zonal_kabupaten (FINAL - VERSIONED)...")

    conn = get_conn()
    cur = conn.cursor()

    try:
        hazards, scenarios, rps = get_lookup(cur)
        run_id = get_active_run_id(cur)

        # 🔥 deduplicate
        data_map = {}

        total_rows = 0

        # ===============================
        # LOOP FILE
        # ===============================
        for path in FILES_ZONAL:
            print(f"📂 Processing: {path}")

            gdf = gpd.read_file(path).fillna(0)

            for _, row in gdf.iterrows():
                total_rows += 1

                id_kab = str(row.get("id_kabkota", "")).strip()
                if not id_kab:
                    continue

                for col in gdf.columns:
                    if not col.startswith("mean_"):
                        continue

                    try:
                        hazard, scenario, rp = parse_zonal(col)

                        if hazard == "multi":
                            hazard = "multihazard"

                        if hazard not in hazards:
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

                        # kumpulkan untuk avg
                        if key not in data_map:
                            data_map[key] = []

                        data_map[key].append(val)

                    except Exception:
                        continue

        # ===============================
        # AGGREGATE FINAL
        # ===============================
        batch_data = []

        for key, values in data_map.items():
            mean_val = sum(values) / len(values)
            batch_data.append((*key, mean_val))

        print(f"🚀 Total rows: {len(batch_data)}")

        # ===============================
        # CLEAN OLD DATA
        # ===============================
        cur.execute(
            "DELETE FROM zonal_kabupaten WHERE run_id = %s;",
            (run_id,)
        )

        # ===============================
        # BULK INSERT (UPSERT)
        # ===============================
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
            page_size=1000
        )

        conn.commit()
        print("✅ Zonal loaded successfully (VERSIONED & CLEAN)")

    except Exception as e:
        conn.rollback()
        print("❌ Failed loading zonal:", e)

    finally:
        cur.close()
        conn.close()
