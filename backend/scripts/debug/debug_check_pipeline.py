import geopandas as gpd
import pandas as pd


# =========================
# DEBUG FUNCTION
# =========================
def debug_pipeline(gdf_zonal, gdf_loss):

    print("\n" + "="*60)
    print("🚀 FULL PIPELINE VALIDATION")
    print("="*60)

    # =========================
    # CLEAN DATA
    # =========================
    print("\n[0] CLEANING DATA")
    before = len(gdf_loss)
    gdf_loss = gdf_loss.dropna(subset=["loss"])
    after = len(gdf_loss)

    print(f"Loss rows before: {before}")
    print(f"Loss rows after : {after}")

    # =========================
    # BASIC INFO
    # =========================
    print("\n[1] BASIC INFO")
    print("ZONAL rows:", len(gdf_zonal))
    print("LOSS rows :", len(gdf_loss))

    # =========================
    # COVERAGE
    # =========================
    print("\n[2] COVERAGE")
    print("Zonal kab:", gdf_zonal["id_kabkota"].nunique())
    print("Loss  kab:", gdf_loss["id_kabkota"].nunique())

    # =========================
    # DUPLICATE CHECK
    # =========================
    print("\n[3] DUPLICATE CHECK")
    dup = gdf_loss.duplicated(
        subset=["id_kabkota", "hazard", "scenario", "rp"]
    ).sum()
    print("Duplicate rows:", dup)

    # =========================
    # NULL CHECK
    # =========================
    print("\n[4] NULL CHECK")
    print("Zonal null:", gdf_zonal.isnull().sum().sum())
    print("Loss null :", gdf_loss.isnull().sum().sum())

    # =========================
    # DISTRIBUSI KOMBINASI
    # =========================
    print("\n[5] DISTRIBUSI (hazard-scenario-rp)")

    dist = (
        gdf_loss
        .groupby(["hazard", "scenario", "rp"])
        .size()
        .reset_index(name="count")
    )

    print(dist)

    # =========================
    # CEK KOMBINASI HILANG
    # =========================
    print("\n[6] CEK KOMBINASI HILANG")

    hazards = gdf_loss["hazard"].unique()
    scenarios = gdf_loss["scenario"].unique()
    rps = gdf_loss["rp"].unique()

    missing = []

    for h in hazards:
        for s in scenarios:
            for rp in rps:
                subset = gdf_loss[
                    (gdf_loss["hazard"] == h) &
                    (gdf_loss["scenario"] == s) &
                    (gdf_loss["rp"] == rp)
                ]
                if subset.empty:
                    missing.append((h, s, rp))

    if missing:
        print("❌ Kombinasi hilang:", missing)
    else:
        print("✅ Semua kombinasi lengkap")

    # =========================
    # LOSS STATS
    # =========================
    print("\n[7] LOSS STATS")
    print(gdf_loss["loss"].describe())

    if (gdf_loss["loss"] < 0).any():
        print("❌ WARNING: Ada loss negatif!")

    # =========================
    # CLIMATE vs NON
    # =========================
    print("\n[8] CLIMATE vs NON-CLIMATE")

    climate = (
        gdf_loss[gdf_loss["hazard"] != "multi"]
        .groupby(["hazard", "scenario"])["loss"]
        .mean()
    )
    print(climate)

    # =========================
    # RP TREND
    # =========================
    print("\n[9] RP TREND")

    rp_trend = (
        gdf_loss[gdf_loss["hazard"] != "multi"]
        .groupby(["hazard", "rp"])["loss"]
        .mean()
        .reset_index()
        .sort_values(["hazard", "rp"])
    )

    print(rp_trend)

    # =========================
    # CEK ANOMALI RP
    # =========================
    print("\n[10] CEK ANOMALI RP")

    for hazard in rp_trend["hazard"].unique():
        sub = rp_trend[rp_trend["hazard"] == hazard]

        prev = None
        for _, row in sub.iterrows():
            if prev is not None and row["loss"] < prev:
                print(f"❌ RP TURUN di {hazard} (RP {row['rp']})")
            prev = row["loss"]

    # =========================
    # MULTIHAZARD CHECK
    # =========================
    print("\n[11] MULTIHAZARD")

    multi = gdf_loss[gdf_loss["hazard"] == "multi"]

    if not multi.empty:
        print(multi.groupby("rp")["loss"].mean())

    # =========================
    # FINAL VERDICT
    # =========================
    print("\n" + "="*60)
    print("🎯 FINAL CHECK")

    if dup == 0 and not missing:
        print("✅ DATA CONSISTENT")
    else:
        print("⚠️ PERLU PERBAIKAN")

    print("="*60)


# =========================
# MAIN
# =========================
if __name__ == "__main__":

    print("📥 Loading data...")

    # =========================
    # ZONAL
    # =========================
    zonal_drought = gpd.read_file(r"data/output/zonal/drought_stats.geojson")
    zonal_flood   = gpd.read_file(r"data/output/zonal/flood_stats.geojson")

    gdf_zonal = pd.concat([zonal_drought, zonal_flood])

    # =========================
    # LOSS
    # =========================
    drought = gpd.read_file(r"data/output/analysis/kabkota_drought_final.geojson")
    drought["hazard"] = "drought"

    flood = gpd.read_file(r"data/output/analysis/kabkota_flood_final.geojson")
    flood["hazard"] = "flood"

    multi = gpd.read_file(r"data/output/analysis/kabkota_multihazard_final.geojson")
    multi["hazard"] = "multi"

    # =========================
    # MELT FUNCTION (FIXED)
    # =========================
    def melt_loss(df):
        loss_cols = [c for c in df.columns if "loss" in c]

        df_long = df.melt(
            id_vars=["id_kabkota", "hazard"],
            value_vars=loss_cols,
            var_name="var",
            value_name="loss"
        )

        # ✅ FIX SCENARIO BUG
        df_long["scenario"] = df_long["var"].apply(
            lambda x: "nonclimate" if "nonclimate" in x else "climate"
        )

        df_long["rp"] = df_long["var"].str.extract(r"(\d+)").astype(int)

        return df_long

    gdf_loss = pd.concat([
        melt_loss(drought),
        melt_loss(flood),
        melt_loss(multi)
    ])

    print("✅ Data loaded")

    # =========================
    # RUN DEBUG
    # =========================
    debug_pipeline(gdf_zonal, gdf_loss)