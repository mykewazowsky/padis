import geopandas as gpd
import numpy as np
import re


# =========================
# HELPER
# =========================
def print_section(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def extract_rp(col_name: str):
    match = re.search(r"rp(\d+)", col_name)
    return int(match.group(1)) if match else None


# =========================
# COLUMN STRUCTURE
# =========================
def check_columns(gdf):
    print_section("COLUMN STRUCTURE")

    all_cols = list(gdf.columns)
    print(f"Total kolom: {len(all_cols)}\n")

    zonal_cols = [c for c in all_cols if "zonal" in c or "mean" in c]
    lop_cols = [c for c in all_cols if c.startswith("lop_")]
    loss_cols = [c for c in all_cols if c.startswith("loss_")]
    aal_cols = [c for c in all_cols if c.startswith("aal_")]

    other_cols = [
        c for c in all_cols
        if c not in zonal_cols + lop_cols + loss_cols + aal_cols
    ]

    print("📌 ALL COLUMNS:")
    print(all_cols)

    print("\n📊 SUMMARY:")
    print(f"  Zonal : {len(zonal_cols)}")
    print(f"  LOP   : {len(lop_cols)}")
    print(f"  Loss  : {len(loss_cols)}")
    print(f"  AAL   : {len(aal_cols)}")
    print(f"  Other : {len(other_cols)}")

    print("\n🔹 LOSS COLUMNS:")
    print(loss_cols)

    print("\n🔹 AAL COLUMNS:")
    print(aal_cols)

    # RP check
    rps = sorted({extract_rp(c) for c in loss_cols if extract_rp(c)})
    print("\n🔎 RETURN PERIOD (RP) TERDETEKSI:")
    print(rps)


# =========================
# ZONAL CHECK
# =========================
def check_zonal(gdf):
    print_section("ZONAL CHECK")

    zonal_cols = [c for c in gdf.columns if "zonal" in c or "mean" in c]

    if not zonal_cols:
        print("⚠️ Tidak ada kolom zonal ditemukan")
        return

    for col in zonal_cols:
        vals = gdf[col]

        print(f"\n{col}")
        print(f"  min  : {vals.min()}")
        print(f"  max  : {vals.max()}")
        print(f"  null : {vals.isnull().sum()}")

        if (vals < 0).any():
            print("  ❌ ada nilai negatif")

        if (vals > 1).any():
            print("  ⚠️ nilai > 1 (cek normalisasi)")


# =========================
# LOSS CHECK
# =========================
def check_loss(gdf):
    print_section("LOSS CHECK")

    loss_cols = [c for c in gdf.columns if c.startswith("loss_")]

    if not loss_cols:
        print("⚠️ Tidak ada kolom loss ditemukan")
        return

    for col in loss_cols:
        vals = gdf[col]

        print(f"\n{col}")
        print(f"  min  : {vals.min()}")
        print(f"  max  : {vals.max()}")
        print(f"  null : {vals.isnull().sum()}")

        if (vals < 0).any():
            print("  ❌ LOSS negatif")

        if np.isinf(vals).any():
            print("  ❌ ada nilai infinite")

    print("\n✔ LOSS CHECK SELESAI")


# =========================
# AAL CHECK
# =========================
def check_aal(gdf):
    print_section("AAL CHECK")

    aal_cols = [c for c in gdf.columns if c.startswith("aal_")]
    loss_cols = [c for c in gdf.columns if c.startswith("loss_")]

    if not aal_cols:
        print("⚠️ Tidak ada kolom AAL ditemukan")
        return

    if not loss_cols:
        print("⚠️ Tidak ada kolom loss → tidak bisa validasi AAL")
        return

    max_loss = gdf[loss_cols].max(axis=1)

    for col in aal_cols:
        vals = gdf[col]

        print(f"\n{col}")
        print(f"  min  : {vals.min()}")
        print(f"  max  : {vals.max()}")
        print(f"  null : {vals.isnull().sum()}")

        if (vals < 0).any():
            print("  ❌ AAL negatif")

        if (vals > max_loss).any():
            print("  ❌ AAL lebih besar dari loss maksimum")

    print("\n✔ AAL CHECK SELESAI")


# =========================
# MAIN VALIDATOR
# =========================
def validate_all(path: str):
    print(f"\n📂 Load file: {path}")

    gdf = gpd.read_file(path)

    check_columns(gdf)
    check_zonal(gdf)
    check_loss(gdf)
    check_aal(gdf)

    print("\n🎉 VALIDATION SELESAI")
