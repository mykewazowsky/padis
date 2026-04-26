import geopandas as gpd
from shapely.ops import transform
from shapely.geometry import MultiPolygon

from backend.scripts.utils.db import get_conn
from backend.scripts.config.settings import FILE_SAWAH


def force_2d(geom):
    return transform(lambda x, y, z=None: (x, y), geom)


def to_multipolygon(geom):
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    return geom


def run():
    print("🌾 Loading regions_sawah (sawah-admin intersection)...")

    file_path = FILE_SAWAH
    print(f"📂 Source file: {file_path}")

    conn = get_conn()
    cur = conn.cursor()

    try:
        gdf = gpd.read_file(str(file_path))

        print("📊 Columns:", list(gdf.columns))
        print("📊 Total features:", len(gdf))

        if gdf.crs is None:
            print("⚠️ CRS not found, forcing EPSG:4326")
            gdf.set_crs(epsg=4326, inplace=True)
        else:
            gdf = gdf.to_crs(epsg=4326)

        gdf = gdf[gdf.geometry.notnull()]

        print("⚡ Simplifying geometry...")
        gdf["geometry"] = gdf["geometry"].simplify(0.001, preserve_topology=True)

        inserted = 0

        for idx, row in gdf.iterrows():
            try:
                cur.execute("SAVEPOINT row_sp")
                geom = force_2d(row["geometry"])
                geom = to_multipolygon(geom)

                cur.execute("""
                    INSERT INTO regions_sawah (id_kabkota, kab_kota, prov, geom)
                    VALUES (%s, %s, %s, ST_GeomFromText(%s, 4326))
                    ON CONFLICT (id_kabkota) DO UPDATE SET
                        kab_kota = EXCLUDED.kab_kota,
                        prov     = EXCLUDED.prov,
                        geom     = EXCLUDED.geom
                """, (
                    row["id_kabkota"],
                    row["kab_kota"],
                    row["prov"],
                    geom.wkt,
                ))

                cur.execute("RELEASE SAVEPOINT row_sp")
                inserted += 1

                if inserted % 100 == 0:
                    print(f"   ➜ {inserted} sawah regions loaded...")

            except Exception as e:
                cur.execute("ROLLBACK TO SAVEPOINT row_sp")
                print(f"⚠️ Skip row {idx}: {e}")

        conn.commit()
        print(f"✅ regions_sawah loaded ({inserted} rows)")

    except Exception as e:
        print("❌ Failed loading regions_sawah:", e)

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run()
