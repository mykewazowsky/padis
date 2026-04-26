import pandas as pd
from psycopg2.extras import execute_values
from pathlib import Path

from backend.scripts.utils.db import get_conn
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_PRODUCTION


# ===============================
# HELPER: FORMAT ID KABKOTA
# ===============================
def format_id_kabkota(val):
    """
    Pastikan format: XX.XX
    contoh:
    11.1  -> 11.01
    11.01 -> 11.01
    """
    try:
        parts = str(val).strip().replace(",", ".").split(".")

        if len(parts) == 1:
            return f"{parts[0].zfill(2)}.00"

        return f"{parts[0].zfill(2)}.{parts[1].zfill(2)}"

    except Exception:
        return None


# ===============================
# MAIN
# ===============================
def run(run_id=None):
    log.info("PROD", "Memuat data produksi...")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ===============================
        # GET VALID REGIONS (FK SAFE)
        # ===============================
        cur.execute("SELECT id_kabkota FROM regions_adm")
        valid_ids = set(r[0] for r in cur.fetchall())

        log.info("PROD", f"Valid regions: {len(valid_ids)}")

        # ===============================
        # LOOP FILE
        # ===============================
        for name, path in FILES_PRODUCTION.items():

            full_path = Path(path)
            log.info("PROD", f"Baca file: {full_path}")

            if not full_path.exists():
                log.error("PROD", f"File tidak ditemukan: {full_path}")
                continue

            df = pd.read_csv(full_path)

            log.info("PROD", f"Kolom: {df.columns.tolist()}")
            log.info("PROD", f"Total baris: {len(df)}")

            # ===============================
            # CLEANING
            # ===============================
            df["id_kabkota"] = df["id_kabkota"].apply(format_id_kabkota)
            df["total_prod"] = pd.to_numeric(df["total_prod"], errors="coerce")

            # hapus yang invalid
            df = df.dropna(subset=["id_kabkota", "total_prod"])

            # ===============================
            # AMBIL DATA TERBARU (MULTI YEAR)
            # ===============================
            if "tahun" in df.columns:
                df = df.sort_values("tahun").drop_duplicates(
                    "id_kabkota", keep="last"
                )

            log.info("PROD", f"Setelah deduplikasi: {len(df)}")

            # ===============================
            # FILTER VALID REGION (FK SAFE)
            # ===============================
            before = len(df)
            df = df[df["id_kabkota"].isin(valid_ids)]
            after = len(df)

            log.info("PROD", f"Filter wilayah tidak valid: {before} → {after}")

            # ===============================
            # PREPARE DATA
            # ===============================
            data = list(
                df[["id_kabkota", "total_prod"]]
                .itertuples(index=False, name=None)
            )

            if not data:
                log.warn("PROD", "Tidak ada data valid untuk dimasukkan")
                continue

            # ===============================
            # INSERT / UPSERT
            # ===============================
            execute_values(
                cur,
                """
                INSERT INTO production (id_kabkota, total_prod)
                VALUES %s
                ON CONFLICT (id_kabkota)
                DO UPDATE SET total_prod = EXCLUDED.total_prod
                """,
                data,
                page_size=1000
            )

        conn.commit()
        log.ok("PROD", "Data produksi berhasil dimuat")

    except Exception as e:
        conn.rollback()
        log.error("PROD", f"Gagal memuat produksi: {e}")

    finally:
        cur.close()
        conn.close()


# ===============================
# ENTRY POINT
# ===============================
if __name__ == "__main__":
    run()
