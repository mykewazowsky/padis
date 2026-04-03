from pathlib import Path

import geopandas as gpd
from sqlalchemy import text
from shapely.geometry import MultiPolygon, Polygon

from app.db.session import engine

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parents[1]
OUTPUT_DIR = BACKEND_DIR / "data" / "output"

FILES = [
    ("multi", "nonclimate", "rp25"),
    ("multi", "nonclimate", "rp50"),
    ("multi", "nonclimate", "rp100"),
    ("multi", "nonclimate", "rp250"),
    ("multi", "climate", "rp25"),
    ("multi", "climate", "rp50"),
    ("multi", "climate", "rp100"),
    ("multi", "climate", "rp250"),
    ("flood", "nonclimate", "rp25"),
    ("flood", "nonclimate", "rp50"),
    ("flood", "nonclimate", "rp100"),
    ("flood", "nonclimate", "rp250"),
    ("flood", "climate", "rp25"),
    ("flood", "climate", "rp50"),
    ("flood", "climate", "rp100"),
    ("flood", "climate", "rp250"),
    ("drought", "nonclimate", "rp25"),
    ("drought", "nonclimate", "rp50"),
    ("drought", "nonclimate", "rp100"),
    ("drought", "nonclimate", "rp250"),
    ("drought", "climate", "rp25"),
    ("drought", "climate", "rp50"),
    ("drought", "climate", "rp100"),
    ("drought", "climate", "rp250"),
]


def ensure_multipolygon(geom):
    if geom is None:
        return None
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    return geom


def get_geojson_path(hazard: str, climate: str, scenario: str) -> Path:
    return OUTPUT_DIR / f"web_{hazard}_{climate}_{scenario}_v2.geojson"


def truncate_table():
    with engine.begin() as conn:
        conn.execute(text("truncate table hazard_features restart identity;"))


def load_one(hazard: str, climate: str, scenario: str):
    path = get_geojson_path(hazard, climate, scenario)
    if not path.exists():
        print(f"[SKIP] file tidak ada: {path.name}")
        return 0

    gdf = gpd.read_file(path)

    if gdf.empty:
        print(f"[SKIP] kosong: {path.name}")
        return 0

    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    else:
        gdf = gdf.to_crs(4326)

    rename_map = {}
    if "kab_kota" in gdf.columns:
        rename_map["kab_kota"] = "region_name"
    if "prov" in gdf.columns:
        rename_map["prov"] = "province"

    gdf = gdf.rename(columns=rename_map)

    if "region_name" not in gdf.columns:
        gdf["region_name"] = None
    if "province" not in gdf.columns:
        gdf["province"] = None
    if "loss" not in gdf.columns:
        gdf["loss"] = None

    gdf["hazard"] = hazard
    gdf["climate"] = climate
    gdf["scenario"] = scenario

    keep_cols = [
        "region_name",
        "province",
        "hazard",
        "climate",
        "scenario",
        "loss",
        "geometry",
    ]
    gdf = gdf[keep_cols].copy()

    gdf = gdf.rename(columns={"geometry": "geom"})
    gdf = gpd.GeoDataFrame(gdf, geometry="geom", crs="EPSG:4326")

    gdf["geom"] = gdf["geom"].apply(ensure_multipolygon)

    gdf.to_postgis(
        name="hazard_features",
        con=engine,
        if_exists="append",
        index=False,
    )

    print(f"[OK] {path.name}: {len(gdf)} rows")
    return len(gdf)


def main():
    truncate_table()

    total = 0
    for hazard, climate, scenario in FILES:
        total += load_one(hazard, climate, scenario)

    print(f"[DONE] inserted {total} rows into hazard_features")


if __name__ == "__main__":
    main()