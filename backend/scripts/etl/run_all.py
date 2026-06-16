import os

from backend.scripts.utils.db import get_conn
from backend.scripts.utils import log
from backend.scripts.config.paths import OUTPUT_ANALYSIS_DIR
from backend.scripts.metadata.run_metadata import RunMetadataRecorder, sync_metadata_to_db

from backend.scripts.etl.load_regions_adm import run as load_regions
from backend.scripts.etl.load_sawah import run as load_sawah
from backend.scripts.etl.load_losses import run as load_losses, prepare_data as prepare_losses
from backend.scripts.etl.load_aal import run as load_aal, prepare_data as prepare_aal
from backend.scripts.etl.load_zonal_agg import run as load_zonal, prepare_data as prepare_zonal
from backend.scripts.etl.load_production import run as load_production


# Tiga file final wajib ada sebelum ETL boleh berjalan.
_REQUIRED_FINAL_FILES = (
    "kabkota_flood_final.geojson",
    "kabkota_drought_final.geojson",
    "kabkota_multihazard_final.geojson",
)


def _ensure_final_files_ready() -> None:
    """
    Fail-fast jika salah satu dari ketiga file final GeoJSON belum tersedia.

    ETL membutuhkan ketiga hasil analisis (flood + drought + multihazard) untuk
    memuat tabel losses, aal, dan zonal_kabupaten secara lengkap. Tanpa guard
    ini, ETL akan berjalan setengah jalan dan meninggalkan run dengan data
    parsial — sulit dideteksi belakangan.
    """
    missing = [
        name for name in _REQUIRED_FINAL_FILES
        if not os.path.exists(os.path.join(OUTPUT_ANALYSIS_DIR, name))
    ]
    if missing:
        listing = "\n".join(f"  - {name}" for name in missing)
        raise FileNotFoundError(
            "ETL dibatalkan: file final analisis berikut belum tersedia di "
            f"{OUTPUT_ANALYSIS_DIR}:\n{listing}\n"
            "Jalankan pipeline penuh untuk hazard yang belum (flood / drought / "
            "multihazard) sebelum memuat ke database."
        )


def run(hazard: str = "multi", run_id: int | None = None, operator_name: str = "etl") -> None:
    """
    Memuat data ke DB dalam satu transaksi atomik.

    run_id — opsional:
      - None    : buat run row baru (standalone, mis. dari CLI langsung)
      - int     : gunakan run_id dari PipelineRunManager; tidak membuat row baru,
                  hanya mengaktifkan row yang ada setelah data berhasil di-commit.
                  Ini mencegah duplikasi row di tabel runs.
    """
    log.header("ETL PROCESS")

    # Guard: pastikan ketiga file final GeoJSON sudah tersedia.
    _ensure_final_files_ready()

    # Static, idempotent tables — each manages its own connection.
    log.info("ETL", "[1/6] Loading regions_adm...")
    load_regions()

    log.info("ETL", "[2/6] Loading regions_sawah...")
    load_sawah()

    log.info("ETL", "[3/6] Loading production...")
    load_production()

    # ── Phase 1: baca semua file GeoJSON SEBELUM membuka koneksi ─────────────
    # Pembacaan file bisa memakan waktu lama; koneksi yang dibuka terlalu
    # awal akan di-drop Supabase karena idle timeout.
    log.info("ETL", "[4/6] Membaca data losses dari file...")
    losses_batch = prepare_losses(hazard)

    log.info("ETL", "[5/6] Membaca data AAL dari file...")
    aal_batch = prepare_aal(hazard)

    log.info("ETL", "[6/6] Membaca data zonal dari file...")
    zonal_batch = prepare_zonal(hazard)

    # ── Phase 2: buka koneksi segar dan eksekusi semua SQL sekaligus ─────────
    conn = get_conn()
    cur = conn.cursor()
    own_run = run_id is None
    metadata: RunMetadataRecorder | None = None

    try:
        if own_run:
            # Standalone: create a new run row and activate it immediately.
            cur.execute("UPDATE runs SET is_active = FALSE")
            cur.execute("""
                INSERT INTO runs
                    (created_at, is_active, status, source, operator_name, step, progress, message)
                VALUES
                    (NOW(), TRUE, 'running', 'etl', %s, 'etl', 0, 'ETL dimulai')
                RETURNING id
            """, (operator_name,))
            run_id = cur.fetchone()[0]
            log.info("ETL", f"Run ID: {run_id} (dibuat oleh ETL)  hazard={hazard}")
        else:
            log.info("ETL", f"Run ID: {run_id} (dari pipeline)  hazard={hazard}")

        metadata = RunMetadataRecorder(
            run_id=run_id,
            hazard=hazard,
            operator_name=operator_name,
            source="etl" if own_run else "pipeline",
        )
        if own_run:
            metadata.start({
                "preprocess": False,
                "zonal": False,
                "analysis": False,
                "etl": True,
            })
        metadata.record_stage("etl", "database_write_started", {
            "hazard": hazard,
            "own_run": own_run,
            "tables": ["losses", "aal", "zonal_kabupaten"],
        })

        log.info("ETL", "Tulis losses ke DB...")
        load_losses(cur, run_id, hazard, _prepared=losses_batch)

        log.info("ETL", "Tulis AAL ke DB...")
        load_aal(cur, run_id, hazard, _prepared=aal_batch)

        log.info("ETL", "Tulis zonal aggregation ke DB...")
        load_zonal(cur, run_id, hazard, _prepared=zonal_batch)

        if own_run:
            cur.execute("""
                UPDATE runs
                SET status = 'success', progress = 100,
                    step = 'etl', message = 'ETL selesai', finished_at = NOW()
                WHERE id = %s
            """, (run_id,))
        else:
            # Atomically deactivate all other runs and activate ours with the data.
            cur.execute("UPDATE runs SET is_active = FALSE")
            cur.execute(
                "UPDATE runs SET is_active = TRUE, status = 'success' WHERE id = %s",
                (run_id,),
            )

        conn.commit()
        if metadata is not None:
            metadata.record_stage("etl", "database_write_success", {
                "run_id": run_id,
                "hazard": hazard,
                "tables": ["losses", "aal", "zonal_kabupaten"],
            })
            metadata.refresh_outputs(include_processed=False)
            if own_run:
                metadata.finish("success", "ETL selesai", None)
                sync_metadata_to_db(run_id, metadata.path)
        log.ok("ETL", f"Semua data berhasil dimuat (run_id={run_id}  hazard={hazard})")

    except Exception as e:
        conn.rollback()
        if metadata is not None:
            metadata.record_stage("etl", "database_write_failed", {"error": str(e)})
            if own_run:
                metadata.finish("failed", str(e), None)
                sync_metadata_to_db(run_id, metadata.path)
        if own_run and run_id is not None:
            try:
                cur2 = conn.cursor()
                cur2.execute("""
                    UPDATE runs
                    SET status = 'failed', message = %s, finished_at = NOW()
                    WHERE id = %s
                """, (str(e)[:500], run_id))
                conn.commit()
                cur2.close()
            except Exception:
                pass
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
