from scripts.utils.db import get_conn

from scripts.etl.load_regions_adm import run as load_regions
from scripts.etl.load_sawah import run as load_sawah
from scripts.etl.load_losses import run as load_losses
from scripts.etl.load_aal import run as load_aal
from scripts.etl.load_zonal_agg import run as load_zonal
from scripts.etl.load_production import run as load_production


# ===============================
# CREATE NEW RUN
# ===============================
def create_run():
    conn = get_conn()
    cur = conn.cursor()

    try:
        # nonaktifkan run lama
        cur.execute("UPDATE runs SET is_active = FALSE")

        # buat run baru
        cur.execute(
            """
            INSERT INTO runs (created_at, is_active)
            VALUES (NOW(), TRUE)
            RETURNING id
            """
        )

        run_id = cur.fetchone()[0]
        conn.commit()

        print(f"🆔 RUN ID: {run_id}")
        return run_id

    except Exception as e:
        conn.rollback()
        print("❌ Failed create run:", e)
        return None

    finally:
        cur.close()
        conn.close()


# ===============================
# MAIN ETL
# ===============================
def run():
    print("🚀 START ETL PROCESS\n")

    run_id = create_run()

    if not run_id:
        print("❌ ETL STOPPED: gagal create run_id")
        return

    try:
        # ===============================
        # STEP 1: REGIONS (static)
        # ===============================
        print("🔄 Loading regions...")
        load_regions()

        # ===============================
        # STEP 2: SAWAH (static)
        # ===============================
        print("🔄 Loading sawah...")
        load_sawah()

        # ===============================
        # STEP 3: PRODUCTION (exposure)
        # ===============================
        print("🔄 Loading production...")
        load_production(run_id)

        # ===============================
        # STEP 4: LOSSES
        # ===============================
        print("🔄 Loading losses...")
        load_losses(run_id)

        # ===============================
        # STEP 5: AAL
        # ===============================
        print("🔄 Loading AAL...")
        load_aal(run_id)

        # ===============================
        # STEP 6: ZONAL (AGGREGATED)
        # ===============================
        print("🔄 Loading zonal (aggregated)...")
        load_zonal(run_id)

        print("\n🔥 ALL DATA SUCCESSFULLY UPLOADED")

    except Exception as e:
        print(f"\n❌ ETL FAILED: {e}")


# ===============================
# ENTRY POINT
# ===============================
if __name__ == "__main__":
    run()
