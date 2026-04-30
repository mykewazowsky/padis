import pandas as pd
from psycopg2.extras import execute_values
from pathlib import Path

from backend.scripts.utils.db import get_conn
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_PRODUCTION

_DEBUG_IDS = {"33.20", "35.10", "35.20"}


# ===============================
# HELPER: FORMAT ID KABKOTA
# ===============================
def format_id_kabkota(val):
    """
    Normalisasi ke format XX.XX.

    Aturan bagian kanan (setelah titik):
    - 0 digit  : "00"
    - 1 digit  : ljust(2, "0")  — "2" -> "20", bukan zfill "02"
    - 2 digit  : pertahankan    — "20" -> "20"
    - >2 digit : ambil 2 digit pertama

    Contoh:
    33.20 -> 33.20 | "33.20" -> 33.20
    33.2  -> 33.20 | 35.1   -> 35.10
    11.01 -> 11.01 | 1.1    -> 01.10
    1     -> 01.00
    """
    try:
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none"):
            return None

        s = s.replace(",", ".")
        parts = s.split(".")

        left = parts[0].zfill(2)

        if len(parts) == 1:
            return f"{left}.00"

        right_raw = parts[1]
        if len(right_raw) == 0:
            right = "00"
        elif len(right_raw) == 1:
            right = right_raw.ljust(2, "0")   # "2" -> "20"
        elif len(right_raw) == 2:
            right = right_raw
        else:
            right = right_raw[:2]             # ambil 2 digit pertama saja

        return f"{left}.{right}"

    except Exception:
        return None


# ===============================
# MAIN
# ===============================
def run():
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

            # Baca id_kabkota sebagai string agar "33.20" tidak di-truncate float menjadi "33.2"
            df = pd.read_csv(full_path, dtype={"id_kabkota": str})

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
            # DEBUG: kode kritis setelah cleaning
            # ===============================
            for dbg in sorted(_DEBUG_IDS):
                hits = df[df["id_kabkota"] == dbg]
                if hits.empty:
                    log.warn("PROD", f"[DEBUG] {dbg} TIDAK ditemukan setelah cleaning")
                else:
                    log.info("PROD", f"[DEBUG] {dbg} ada: {len(hits)} baris, "
                             f"total_prod={hits['total_prod'].tolist()}")

            # ===============================
            # AMBIL DATA TERBARU (MULTI YEAR)
            # ===============================
            if "tahun" in df.columns:
                df["tahun"] = pd.to_numeric(df["tahun"], errors="coerce")
                df = df.sort_values("tahun").drop_duplicates(
                    "id_kabkota", keep="last"
                )
            else:
                dup_count = df.duplicated("id_kabkota").sum()
                if dup_count:
                    log.warn("PROD", f"Kolom 'tahun' tidak ada — {dup_count} duplikat "
                             "id_kabkota ditemukan, keep last digunakan")
                df = df.drop_duplicates("id_kabkota", keep="last")

            log.info("PROD", f"Setelah deduplikasi: {len(df)}")

            # Paranoia check: masih ada duplikat?
            still_dup = df.duplicated("id_kabkota").sum()
            if still_dup:
                log.warn("PROD", f"{still_dup} duplikat masih ada — group by id_kabkota, ambil sum")
                df = (
                    df.groupby("id_kabkota", as_index=False)["total_prod"]
                    .sum()
                )

            # ===============================
            # DEBUG: kode kritis sebelum filter valid_ids
            # ===============================
            for dbg in sorted(_DEBUG_IDS):
                hits = df[df["id_kabkota"] == dbg]
                if hits.empty:
                    log.warn("PROD", f"[DEBUG PRE-FILTER] {dbg} tidak ada sebelum filter valid_ids")
                else:
                    log.info("PROD", f"[DEBUG PRE-FILTER] {dbg} ada: "
                             f"total_prod={hits['total_prod'].tolist()}")

            # ===============================
            # FILTER VALID REGION (FK SAFE)
            # ===============================
            before = len(df)
            invalid_df = df[~df["id_kabkota"].isin(valid_ids)]
            df = df[df["id_kabkota"].isin(valid_ids)]
            after = len(df)

            log.info("PROD", f"Filter wilayah tidak valid: {before} → {after} "
                     f"({before - after} dibuang)")

            if not invalid_df.empty:
                discarded = sorted(invalid_df["id_kabkota"].dropna().unique().tolist())
                log.warn("PROD", f"id_kabkota dibuang ({len(discarded)} unik, "
                         f"maks 50 ditampilkan): {discarded[:50]}")

            # ===============================
            # DEBUG: kode kritis setelah filter
            # ===============================
            for dbg in sorted(_DEBUG_IDS):
                hits = df[df["id_kabkota"] == dbg]
                if hits.empty:
                    log.warn("PROD", f"[DEBUG POST-FILTER] {dbg} HILANG setelah filter valid_ids")
                else:
                    log.info("PROD", f"[DEBUG POST-FILTER] {dbg} lolos filter: "
                             f"total_prod={hits['total_prod'].tolist()}")

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

            log.info("PROD", f"Inserted/updated {len(data)} baris")

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
