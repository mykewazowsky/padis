import os
import re
import pandas as pd


# ================= PATH CONFIG =================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "output")

AAL_MULTI_PATH = os.path.join(OUTPUT_DIR, "kabkota_multihazard_aal_v2.csv")
AAL_FLOOD_PATH = os.path.join(OUTPUT_DIR, "kabkota_flood_aal_v2.csv")
AAL_DROUGHT_PATH = os.path.join(OUTPUT_DIR, "kabkota_drought_aal_v2.csv")


# ================= UTIL =================
def format_rupiah(value):
    try:
        return f"Rp {float(value):,.0f}".replace(",", ".")
    except Exception:
        return "Rp 0"


def format_rupiah_compact(value):
    try:
        value = float(value)
    except Exception:
        return "Rp 0"

    if abs(value) >= 1_000_000_000_000:
        return f"Rp {value / 1_000_000_000_000:.1f} T"
    if abs(value) >= 1_000_000_000:
        return f"Rp {value / 1_000_000_000:.1f} M"
    if abs(value) >= 1_000_000:
        return f"Rp {value / 1_000_000:.1f} Jt"
    return f"Rp {value:,.0f}".replace(",", ".")


def make_region_slug(region: str) -> str:
    if not region:
        return "all-region"
    return re.sub(r"[^a-z0-9-]", "", region.lower().strip().replace(" ", "-"))


def get_legend_palette(hazard):
    if hazard == "drought":
        return [
            {"color": "#fff7d6", "label": "< Rp 500 Jt"},
            {"color": "#fde68a", "label": "Rp 500 Jt – Rp 1 M"},
            {"color": "#f4c21f", "label": "Rp 1 M – Rp 2 M"},
            {"color": "#d4a514", "label": "Rp 2 M – Rp 4 M"},
            {"color": "#8a6300", "label": "≥ Rp 4 M"},
        ]

    if hazard == "flood":
        return [
            {"color": "#eaf2ff", "label": "< Rp 500 Jt"},
            {"color": "#bfdbfe", "label": "Rp 500 Jt – Rp 1 M"},
            {"color": "#60a5fa", "label": "Rp 1 M – Rp 2 M"},
            {"color": "#1e63b5", "label": "Rp 2 M – Rp 4 M"},
            {"color": "#174f92", "label": "≥ Rp 4 M"},
        ]

    return [
        {"color": "#f3e8ff", "label": "< Rp 500 Jt"},
        {"color": "#d8b4fe", "label": "Rp 500 Jt – Rp 1 M"},
        {"color": "#a78bfa", "label": "Rp 1 M – Rp 2 M"},
        {"color": "#7c3aed", "label": "Rp 2 M – Rp 4 M"},
        {"color": "#4c1d95", "label": "≥ Rp 4 M"},
    ]


def _safe_top_region_string(top_row):
    kab = str(top_row.get("kab_kota", "-")).strip()
    prov = str(top_row.get("prov", "-")).strip()
    return f"{kab}, {prov}" if prov and prov != "-" else kab


# ================= MAIN CONTEXT =================
def build_report_context(
    gdf,
    hazard,
    scenario,
    climate,
    region=None,
):
    # ================= LABEL =================
    hazard_label = {
        "multi": "Multi-hazard",
        "flood": "Flood",
        "drought": "Drought",
    }.get(hazard, hazard)

    climate_label = "Climate" if climate == "climate" else "Non-Climate"
    scenario_label = scenario.upper()

    # ================= INIT =================
    total_loss_value = 0.0
    top_region = "-"
    top_loss_value = 0.0
    data_count = 0
    top_regions = []
    filtered_gdf = gdf
    empty_state = False

    # ================= PROCESS GDF =================
    if gdf is not None and "loss" in gdf.columns:
        valid = gdf.copy()
        valid["loss"] = pd.to_numeric(valid["loss"], errors="coerce")
        valid = valid.dropna(subset=["loss"]).copy()

        if region and "kab_kota" in valid.columns:
            valid = valid[
                valid["kab_kota"].astype(str).str.lower().str.strip()
                == region.lower().strip()
            ]

        data_count = int(valid.shape[0])

        if not valid.empty:
            total_loss_value = float(valid["loss"].sum())

            top_row = valid.sort_values("loss", ascending=False).iloc[0]
            top_region = _safe_top_region_string(top_row)
            top_loss_value = float(top_row["loss"])

            top_regions = (
                valid[["kab_kota", "prov", "loss"]]
                .sort_values("loss", ascending=False)
                .head(10)
                .to_dict("records")
            )

            filtered_gdf = valid.copy()
        else:
            empty_state = True
            filtered_gdf = valid.copy()
    else:
        empty_state = True
        filtered_gdf = gdf

    # ================= AAL =================
    aal_map = {
        "multi": (AAL_MULTI_PATH, "aal_nonclimate_v2", "aal_climate_v2"),
        "flood": (AAL_FLOOD_PATH, "aal_flood_nonclimate_v2", "aal_flood_climate_v2"),
        "drought": (AAL_DROUGHT_PATH, "aal_drought_nonclimate_v2", "aal_drought_climate_v2"),
    }

    aal_total_nc = 0.0
    aal_total_cc = 0.0

    path, col_nc, col_cc = aal_map[hazard]

    if os.path.exists(path):
        df_aal = pd.read_csv(path)

        if region and "kab_kota" in df_aal.columns:
            df_aal = df_aal[
                df_aal["kab_kota"].astype(str).str.lower().str.strip()
                == region.lower().strip()
            ]

        if col_nc in df_aal.columns:
            aal_total_nc = float(pd.to_numeric(df_aal[col_nc], errors="coerce").dropna().sum())

        if col_cc in df_aal.columns:
            aal_total_cc = float(pd.to_numeric(df_aal[col_cc], errors="coerce").dropna().sum())

    aal_delta_value = aal_total_cc - aal_total_nc

    if aal_total_nc != 0:
        climate_change_pct_value = (
            (aal_total_cc - aal_total_nc) / aal_total_nc
        ) * 100.0
    else:
        climate_change_pct_value = 0.0

    # ================= BASIC DERIVED METRICS =================
    top_region_share_pct = (
        (top_loss_value / total_loss_value) * 100.0
        if total_loss_value > 0 else 0.0
    )

    top3_total_value = sum(float(row.get("loss", 0) or 0) for row in top_regions[:3])
    top3_share_pct = (
        (top3_total_value / total_loss_value) * 100.0
        if total_loss_value > 0 else 0.0
    )

    # ================= INTERPRETATION =================
    if aal_total_nc == 0 and aal_total_cc == 0:
        interpretation = "Data AAL belum tersedia atau belum dapat dihitung untuk konfigurasi ini."
    elif climate_change_pct_value > 5:
        interpretation = "Terdapat peningkatan risiko yang signifikan akibat perubahan iklim."
    elif climate_change_pct_value > 0:
        interpretation = "Terdapat peningkatan risiko moderat akibat perubahan iklim."
    elif climate_change_pct_value < 0:
        interpretation = "Risiko pada skenario climate lebih rendah dibanding baseline."
    else:
        interpretation = "Perubahan risiko relatif tidak signifikan."

    # ================= SUMMARY & INSIGHT - NATIONAL VS REGIONAL =================
    if empty_state:
        if region:
            summary_text = (
                f"Data untuk wilayah {region} pada skenario {scenario_label} "
                f"dengan kondisi {climate_label} belum tersedia atau belum menghasilkan observasi valid."
            )
            insight_text = (
                "Belum terdapat cukup data untuk menyusun interpretasi risiko wilayah secara memadai."
            )
        else:
            summary_text = (
                "Data untuk kombinasi hazard, climate scenario, dan return period ini "
                "belum tersedia atau tidak menghasilkan observasi valid untuk analisis nasional."
            )
            insight_text = (
                "Belum terdapat cukup data untuk menyusun interpretasi risiko nasional secara memadai."
            )
    else:
        if region:
            summary_text = (
                f"Wilayah {top_region} mengalami estimasi total kerugian sebesar "
                f"{format_rupiah(total_loss_value)} pada skenario {scenario_label} "
                f"dengan kondisi {climate_label}."
            )

            if aal_total_nc == 0 and aal_total_cc == 0:
                insight_text = (
                    f"Total kerugian pada wilayah {top_region} tercatat sebesar "
                    f"{format_rupiah(total_loss_value)}. Data AAL wilayah belum tersedia "
                    "untuk membaca perubahan risiko tahunan."
                )
            else:
                insight_text = (
                    f"Total kerugian pada wilayah {top_region} tercatat sebesar "
                    f"{format_rupiah(total_loss_value)}. Perubahan iklim mengubah AAL "
                    f"wilayah sebesar {climate_change_pct_value:.1f}%."
                )
        else:
            summary_text = (
                f"Total kerugian nasional mencapai {format_rupiah(total_loss_value)}. "
                f"Wilayah paling terdampak adalah {top_region} dengan estimasi kerugian "
                f"{format_rupiah(top_loss_value)}."
            )

            if aal_total_nc == 0 and aal_total_cc == 0:
                insight_text = (
                    f"Kerugian nasional terkonsentrasi pada sejumlah wilayah prioritas, "
                    f"dengan {top_region} menyumbang sekitar {top_region_share_pct:.1f}% "
                    "dari total nasional. Data AAL belum tersedia untuk membaca perubahan risiko tahunan."
                )
            else:
                insight_text = (
                    f"Wilayah {top_region} menyumbang sekitar {top_region_share_pct:.1f}% "
                    f"dari total kerugian nasional, sementara 3 wilayah teratas berkontribusi "
                    f"{top3_share_pct:.1f}% terhadap total kerugian. Perubahan iklim mengubah "
                    f"AAL nasional sebesar {climate_change_pct_value:.1f}%."
                )

    # ================= IMPLICATIONS =================
    if empty_state:
        implication_points = [
            "Belum terdapat cukup data untuk menyusun implikasi analisis.",
        ]
    elif region:
        implication_points = [
            f"Warna dan intensitas pada peta menunjukkan posisi risiko wilayah {region} dalam konfigurasi analisis aktif.",
            "Perubahan nilai AAL dapat digunakan sebagai indikator awal perubahan risiko tahunan akibat perubahan iklim.",
            "Laporan regional sebaiknya dibaca sebagai profil risiko lokal, bukan sebagai perbandingan antarwilayah nasional.",
        ]
    else:
        implication_points = [
            "Wilayah dengan kerugian tertinggi dapat diprioritaskan untuk kajian lanjutan dan intervensi mitigasi.",
            "Konsentrasi kerugian pada sedikit wilayah menunjukkan adanya hotspot risiko yang perlu dipantau lebih dekat.",
            "Perubahan AAL antara baseline dan climate scenario dapat digunakan sebagai indikator arah perubahan risiko nasional.",
        ]

    # ================= REGIONAL CONTENT CONTROL =================
    # Regional tidak perlu chart ranking dan table detail jika hanya 1 fitur
    show_chart = not bool(region)
    show_table = not bool(region)

    # Kalau regional tapi datanya ternyata >1 (misal nanti level kecamatan), bisa diaktifkan otomatis
    if region and len(top_regions) > 1:
        show_chart = True
        show_table = True

    # ================= FORMATTING =================
    for row in top_regions:
        row["loss_fmt"] = format_rupiah(row.get("loss", 0))
        row["loss_compact"] = format_rupiah_compact(row.get("loss", 0))

    top3 = top_regions[:3]
    delta_class = "accent-red" if aal_delta_value >= 0 else "accent-success"

    # ================= PAGE / SECTION HELPERS =================
    climate_impact_summary = (
        "Data perubahan risiko tahunan belum tersedia."
        if aal_total_nc == 0 and aal_total_cc == 0
        else (
            f"AAL berubah dari {format_rupiah(aal_total_nc)} menjadi {format_rupiah(aal_total_cc)}, "
            f"atau {climate_change_pct_value:+.1f}% dibanding baseline."
        )
    )

    distribution_summary = (
        "Tidak tersedia cukup data untuk menganalisis distribusi wilayah terdampak."
        if empty_state
        else (
            f"Tiga wilayah teratas berkontribusi {top3_share_pct:.1f}% terhadap total kerugian."
            if not region
            else f"Analisis regional difokuskan pada satu wilayah terpilih, yaitu {top_region}."
        )
    )

    # ================= RETURN =================
    return {
        # raw data
        "gdf": filtered_gdf,

        # labels
        "hazard_label": hazard_label,
        "climate_label": climate_label,
        "scenario_label": scenario_label,

        # core metrics
        "total_loss": format_rupiah(total_loss_value),
        "total_loss_compact": format_rupiah_compact(total_loss_value),
        "top_region": top_region,
        "top_loss": format_rupiah(top_loss_value),
        "top_loss_compact": format_rupiah_compact(top_loss_value),
        "data_count": data_count,

        # AAL
        "aal_nonclimate": format_rupiah(aal_total_nc),
        "aal_climate": format_rupiah(aal_total_cc),
        "aal_delta": format_rupiah(abs(aal_delta_value)),
        "aal_delta_compact": format_rupiah_compact(abs(aal_delta_value)),
        "climate_change_pct": f"{climate_change_pct_value:+.1f}% vs baseline",
        "climate_change_pct_value": climate_change_pct_value,
        "delta_class": delta_class,

        # narrative
        "summary_text": summary_text,
        "insight_text": insight_text,
        "interpretation": interpretation,
        "implication_points": implication_points,
        "climate_impact_summary": climate_impact_summary,
        "distribution_summary": distribution_summary,

        # ranking
        "top_regions": top_regions,
        "top3": top3,
        "top_region_share_pct": round(top_region_share_pct, 1),
        "top3_share_pct": round(top3_share_pct, 1),

        # visuals
        "legend_items": get_legend_palette(hazard),

        # context
        "region": region,
        "is_regional_report": bool(region),
        "empty_state": empty_state,

        # content control
        "show_chart": show_chart,
        "show_table": show_table,
    }