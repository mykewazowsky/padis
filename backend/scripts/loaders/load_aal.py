from pathlib import Path
import os

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parents[1]
OUTPUT_DIR = BACKEND_DIR / "data" / "output"

load_dotenv(BACKEND_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL tidak ditemukan di .env")

engine = create_engine(DATABASE_URL)

FILES = [
    {
        "hazard": "multi",
        "path": OUTPUT_DIR / "kabkota_multihazard_aal_v2.csv",
        "region_col": "kab_kota",
        "province_col": "prov",
        "nonclimate_col": "aal_nonclimate_v2",
        "climate_col": "aal_climate_v2",
    },
    {
        "hazard": "flood",
        "path": OUTPUT_DIR / "kabkota_flood_aal_v2.csv",
        "region_col": "kab_kota",
        "province_col": "prov",
        "nonclimate_col": "aal_flood_nonclimate_v2",
        "climate_col": "aal_flood_climate_v2",
    },
    {
        "hazard": "drought",
        "path": OUTPUT_DIR / "kabkota_drought_aal_v2.csv",
        "region_col": "kab_kota",
        "province_col": "prov",
        "nonclimate_col": "aal_drought_nonclimate_v2",
        "climate_col": "aal_drought_climate_v2",
    },
]


def ensure_table():
    sql = """
    create table if not exists aal_summary (
      id bigserial primary key,
      region_name text,
      province text,
      hazard text not null,
      aal_nonclimate numeric,
      aal_climate numeric,
      created_at timestamptz not null default now()
    );
    """
    with engine.begin() as conn:
        conn.execute(text(sql))


def truncate_table():
    with engine.begin() as conn:
        conn.execute(text("truncate table aal_summary restart identity;"))


def load_one_file(config: dict) -> pd.DataFrame:
    path = config["path"]
    if not path.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {path}")

    df = pd.read_csv(path)

    required_cols = [
        config["region_col"],
        config["province_col"],
        config["nonclimate_col"],
        config["climate_col"],
    ]
    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        raise ValueError(f"Kolom tidak ditemukan di {path.name}: {missing}")

    df = df.rename(
        columns={
            config["region_col"]: "region_name",
            config["province_col"]: "province",
            config["nonclimate_col"]: "aal_nonclimate",
            config["climate_col"]: "aal_climate",
        }
    )

    df = df[["region_name", "province", "aal_nonclimate", "aal_climate"]].copy()
    df["hazard"] = config["hazard"]

    return df


def main():
    ensure_table()
    truncate_table()

    all_frames = []
    for config in FILES:
        df = load_one_file(config)
        all_frames.append(df)
        print(f"[OK] loaded {config['hazard']}: {len(df)} rows")

    final_df = pd.concat(all_frames, ignore_index=True)

    final_df.to_sql("aal_summary", engine, if_exists="append", index=False)

    print(f"[DONE] inserted {len(final_df)} total rows into aal_summary")


if __name__ == "__main__":
    main()