from backend.scripts.utils.db import get_conn
from backend.scripts.utils import log

from backend.scripts.etl.load_regions_adm import run as load_regions
from backend.scripts.etl.load_sawah import run as load_sawah
from backend.scripts.etl.load_losses import run as load_losses
from backend.scripts.etl.load_aal import run as load_aal
from backend.scripts.etl.load_zonal_agg import run as load_zonal
from backend.scripts.etl.load_production import run as load_production


def run(hazard: str = "multi", run_id: int | None = None) -> None:
    """
    Memuat data ke DB dalam satu transaksi atomik.

    run_id — opsional:
      - None    : buat run row baru (standalone, mis. dari CLI langsung)
      - int     : gunakan run_id dari PipelineRunManager; tidak membuat row baru,
                  hanya mengaktifkan row yang ada setelah data berhasil di-commit.
                  Ini mencegah duplikasi row di tabel runs.
    """
    log.header("ETL PROCESS")

    # Static, idempotent tables — each manages its own connection.
    log.info("ETL", "[1/6] Loading regions_adm...")
    load_regions()

    log.info("ETL", "[2/6] Loading regions_sawah...")
    load_sawah()

    log.info("ETL", "[3/6] Loading production...")
    load_production()

    # Run-specific tables: one connection, one atomic transaction.
    conn = get_conn()
    cur = conn.cursor()
    own_run = run_id is None

    try:
        if own_run:
            # Standalone: create a new run row and activate it immediately.
            cur.execute("UPDATE runs SET is_active = FALSE")
            cur.execute("""
                INSERT INTO runs (created_at, is_active, status, source)
                VALUES (NOW(), TRUE, 'running', 'etl')
                RETURNING id
            """)
            run_id = cur.fetchone()[0]
            log.info("ETL", f"Run ID: {run_id} (dibuat oleh ETL)  hazard={hazard}")
        else:
            # Integrated: reuse the run row created by PipelineRunManager.
            # Do NOT activate yet — activation happens only after a successful commit,
            # so a failed ETL leaves the previous active run untouched.
            log.info("ETL", f"Run ID: {run_id} (dari pipeline)  hazard={hazard}")

        log.info("ETL", "[4/6] Loading losses...")
        load_losses(cur, run_id, hazard)

        log.info("ETL", "[5/6] Loading AAL...")
        load_aal(cur, run_id, hazard)

        log.info("ETL", "[6/6] Loading zonal aggregation...")
        load_zonal(cur, run_id, hazard)

        if own_run:
            cur.execute("UPDATE runs SET status = 'success' WHERE id = %s", (run_id,))
        else:
            # Atomically deactivate all other runs and activate ours with the data.
            cur.execute("UPDATE runs SET is_active = FALSE")
            cur.execute(
                "UPDATE runs SET is_active = TRUE, status = 'success' WHERE id = %s",
                (run_id,),
            )

        conn.commit()
        log.ok("ETL", f"Semua data berhasil dimuat (run_id={run_id}  hazard={hazard})")

    except Exception as e:
        conn.rollback()
        log.error("ETL", f"Pipeline gagal — semua perubahan dibatalkan: {e}")
        raise

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--hazard", choices=["flood", "drought", "multi"], default="multi")
    args = parser.parse_args()
    run(args.hazard)
