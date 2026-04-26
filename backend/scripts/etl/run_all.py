from backend.scripts.utils.db import get_conn
from backend.scripts.utils import log

from backend.scripts.etl.load_regions_adm import run as load_regions
from backend.scripts.etl.load_sawah import run as load_sawah
from backend.scripts.etl.load_losses import run as load_losses
from backend.scripts.etl.load_aal import run as load_aal
from backend.scripts.etl.load_zonal_agg import run as load_zonal
from backend.scripts.etl.load_production import run as load_production


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

        log.info("ETL", f"Run ID: {run_id}")
        return run_id

    except Exception as e:
        conn.rollback()
        log.error("ETL", f"Gagal membuat run: {e}")
        return None

    finally:
        cur.close()
        conn.close()


# ===============================
# MAIN ETL
# ===============================
def run():
    log.header("ETL PROCESS")

    run_id = create_run()

    if not run_id:
        log.error("ETL", "Pipeline dihentikan: gagal membuat run_id")
        return

    try:
        log.info("ETL", "[1/6] Loading regions_adm...")
        load_regions()

        log.info("ETL", "[2/6] Loading regions_sawah...")
        load_sawah()

        log.info("ETL", "[3/6] Loading production...")
        load_production(run_id)

        log.info("ETL", "[4/6] Loading losses...")
        load_losses(run_id)

        log.info("ETL", "[5/6] Loading AAL...")
        load_aal(run_id)

        log.info("ETL", "[6/6] Loading zonal aggregation...")
        load_zonal(run_id)

        log.ok("ETL", "Semua data berhasil dimuat")

    except Exception as e:
        log.error("ETL", f"Pipeline gagal: {e}")


# ===============================
# ENTRY POINT
# ===============================
if __name__ == "__main__":
    run()
