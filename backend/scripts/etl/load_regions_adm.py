import geopandas as gpd
from shapely.ops import transform
from shapely.geometry import MultiPolygon
from scripts.utils.db import get_conn
from scripts.config.settings import FILES_ADMIN


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
    print("🗺️ Loading regions_adm (batas administrasi)...")

    file_path = FILES_ADMIN["regions"]
    print(f"📂 Source file: {file_path}")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # =========================
        # LOAD FILE
        # =========================
        gdf = gpd.read_file(str(file_path))

        print("📊 Columns:", list(gdf.columns))
        print("📊 Total features:", len(gdf))

        # =========================
        # CRS FIX
        # =========================
        if gdf.crs is None:
            print("⚠️ CRS not found, forcing EPSG:4326")
            gdf.set_crs(epsg=4326, inplace=True)
        else:
            gdf = gdf.to_crs(epsg=4326)

        gdf = gdf[gdf.geometry.notnull()]

        # =========================
        # SIMPLIFY (PERFORMANCE)
        # =========================
        print("⚡ Simplifying geometry...")
        gdf["geometry"] = gdf["geometry"].simplify(0.001, preserve_topology=True)

        inserted = 0

        # =========================
        # INSERT LOOP
        # =========================
        for idx, row in gdf.iterrows():
            try:
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

                inserted += 1

                if inserted % 100 == 0:
                    print(f"   ➜ {inserted} regions loaded...")

            except Exception as e:
                conn.rollback()
                print(f"❌ Error row {idx}: {e}")

        conn.commit()
        print(f"✅ regions_adm loaded ({inserted} rows)")

    except Exception as e:
        print("❌ Failed loading regions_adm:", e)

    finally:
        cur.close()
        conn.close()


# =========================
# ENTRY POINT
# =========================
if __name__ == "__main__":
    run()