import geopandas as gpd
from shapely.ops import transform
from shapely.geometry import MultiPolygon
from backend.scripts.utils.db import get_conn
from backend.scripts.utils import log
from backend.scripts.config.settings import FILES_ADMIN


# =========================
# HELPERS
# =========================
def force_2d(geom):
    return transform(lambda x, y, z=None: (x, y), geom)


def to_multipolygon(geom):
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    return geom


# =========================
# MAIN LOAD FUNCTION
# =========================
def run():
    log.info("REGIONS-ADM", "Memuat regions_adm (batas administrasi)...")

    file_path = FILES_ADMIN["regions"]
    log.info("REGIONS-ADM", f"Sumber: {file_path}")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # =========================
        # LOAD FILE
        # =========================
        gdf = gpd.read_file(str(file_path))

        log.info("REGIONS-ADM", f"Kolom: {list(gdf.columns)}")
        log.info("REGIONS-ADM", f"Total fitur: {len(gdf)}")

        # =========================
        # CRS FIX
        # =========================
        if gdf.crs is None:
            log.warn("REGIONS-ADM", "CRS tidak ditemukan, memaksa EPSG:4326")
            gdf.set_crs(epsg=4326, inplace=True)
        else:
            gdf = gdf.to_crs(epsg=4326)

        gdf = gdf[gdf.geometry.notnull()]

        # =========================
        # SIMPLIFY (PERFORMANCE)
        # =========================
        log.info("REGIONS-ADM", "Menyederhanakan geometri...")
        gdf["geometry"] = gdf["geometry"].simplify(0.001, preserve_topology=True)

        inserted = 0

        # =========================
        # INSERT LOOP
        # =========================
        for idx, row in gdf.iterrows():
            try:
                cur.execute("SAVEPOINT row_sp")
                geom = row["geometry"]

                geom = force_2d(geom)
                geom = to_multipolygon(geom)

                geom_wkt = geom.wkt

                cur.execute("""
                    INSERT INTO regions_adm (id_kabkota, kab_kota, prov, geom)
                    VALUES (%s, %s, %s, ST_GeomFromText(%s, 4326))
                    ON CONFLICT (id_kabkota) DO UPDATE SET
                        kab_kota = EXCLUDED.kab_kota,
                        prov = EXCLUDED.prov,
                        geom = EXCLUDED.geom
                """, (
                    row["id_kabkota"],
                    row["kab_kota"],
                    row["prov"],
                    geom_wkt
                ))

                cur.execute("RELEASE SAVEPOINT row_sp")
                inserted += 1

                if inserted % 100 == 0:
                    log.info("REGIONS-ADM", f"Dimuat: {inserted} baris...")

            except Exception as e:
                cur.execute("ROLLBACK TO SAVEPOINT row_sp")
                log.warn("REGIONS-ADM", f"Lewati baris {idx}: {e}")

        conn.commit()
        log.ok("REGIONS-ADM", f"regions_adm selesai ({inserted} baris)")

    except Exception as e:
        log.error("REGIONS-ADM", f"Gagal memuat regions_adm: {e}")

    finally:
        cur.close()
        conn.close()


# =========================
# ENTRY POINT
# =========================
if __name__ == "__main__":
    run()
