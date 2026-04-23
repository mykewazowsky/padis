import os
import math
import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import matplotlib.patheffects as pe

import numpy as np

from matplotlib.patches import FancyArrowPatch, Rectangle
from mpl_toolkits.axes_grid1.inset_locator import inset_axes


# =========================================================
# PALETTE SINKRON DENGAN FRONTEND
# =========================================================
def _get_hazard_palette(hazard: str):
    if hazard == "drought":
        return ["#fff7d6", "#fde68a", "#f4c21f", "#d4a514", "#8a6300"]

    if hazard == "flood":
        return ["#eaf2ff", "#bfdbfe", "#60a5fa", "#1e63b5", "#174f92"]

    # multi-hazard
    return ["#f3e8ff", "#d8b4fe", "#a78bfa", "#7c3aed", "#4c1d95"]


def _get_hazard_accent(hazard: str):
    if hazard == "drought":
        return "#d4a514"
    if hazard == "flood":
        return "#1e63b5"
    return "#7c3aed"


# =========================================================
# FORMAT ANGKA - SINKRON DENGAN FRONTEND
# =========================================================
def _format_compact_idr(value: float) -> str:
    try:
        value = float(value)
    except Exception:
        return "Rp 0"

    abs_value = abs(value)

    if abs_value >= 1_000_000_000_000:
        short = value / 1_000_000_000_000
        return f"Rp {short:.1f} T"

    if abs_value >= 1_000_000_000:
        short = value / 1_000_000_000
        return f"Rp {short:.1f} M"

    if abs_value >= 1_000_000:
        short = value / 1_000_000
        return f"Rp {short:.1f} Jt"

    return f"Rp {value:,.0f}".replace(",", ".")


# =========================================================
# CLASS BREAKS - IKUTI LOGIC DASHBOARD
# =========================================================
def _compute_dashboard_breaks(values: np.ndarray):
    """
    Sinkron dengan frontend:
    - ambil value > 0
    - unique
    - kalau <= 5 langsung pakai
    - kalau > 5 pakai min, 25%, 50%, 75%, max
    """
    positive_values = [float(v) for v in values if v is not None and float(v) > 0]

    if not positive_values:
        return []

    positive_values = sorted(positive_values)
    unique_values = sorted(set(positive_values))
    count = len(unique_values)

    if count <= 5:
        return unique_values

    last_index = count - 1

    breaks = [
        unique_values[0],
        unique_values[math.floor(last_index * 0.25)],
        unique_values[math.floor(last_index * 0.50)],
        unique_values[math.floor(last_index * 0.75)],
        unique_values[last_index],
    ]

    # pastikan unik dan terurut
    breaks = sorted(set(float(v) for v in breaks))
    return breaks


def _get_class_index(value, breaks):
    if value is None or not breaks:
        return -1

    try:
        value = float(value)
    except Exception:
        return -1

    if value <= 0:
        return -1

    sorted_breaks = sorted(breaks)

    if len(sorted_breaks) == 1:
        return 0

    if value < sorted_breaks[1]:
        return 0

    for i in range(1, len(sorted_breaks) - 1):
        if value >= sorted_breaks[i] and value < sorted_breaks[i + 1]:
            return i

    return len(sorted_breaks) - 1


def _build_legend_items(breaks, palette):
    if not breaks:
        return []

    sorted_breaks = sorted(breaks)
    items = []

    for index, current in enumerate(sorted_breaks):
        next_val = sorted_breaks[index + 1] if index + 1 < len(sorted_breaks) else None

        if len(sorted_breaks) == 1:
            label = f"≥ {_format_compact_idr(current)}"
        elif index == 0 and next_val is not None:
            label = f"< {_format_compact_idr(next_val)}"
        elif next_val is not None:
            label = f"{_format_compact_idr(current)} – {_format_compact_idr(next_val)}"
        else:
            label = f"≥ {_format_compact_idr(current)}"

        items.append({
            "color": palette[min(index, len(palette) - 1)],
            "label": label,
        })

    return items


# =========================================================
# DRAW HELPERS
# =========================================================
def _draw_north_arrow(ax):
    arrow = FancyArrowPatch(
        (0.955, 0.12),
        (0.955, 0.25),
        transform=ax.transAxes,
        arrowstyle="-|>",
        mutation_scale=18,
        linewidth=1.2,
        color="#111827",
        zorder=40,
    )
    ax.add_patch(arrow)

    ax.text(
        0.955,
        0.27,
        "N",
        transform=ax.transAxes,
        ha="center",
        va="bottom",
        fontsize=9,
        fontweight="bold",
        color="#111827",
        zorder=41,
    )


def _draw_custom_legend(ax, legend_items, title="Loss (IDR)"):
    if not legend_items:
        return

    x0 = 0.03
    y0 = 0.055
    box_w = 0.30
    row_h = 0.038
    title_h = 0.052
    padding = 0.015
    total_h = title_h + (len(legend_items) * row_h) + padding * 2

    panel = Rectangle(
        (x0, y0),
        box_w,
        total_h,
        transform=ax.transAxes,
        facecolor="white",
        edgecolor="#e5e7eb",
        linewidth=0.8,
        alpha=0.97,
        zorder=30,
    )
    ax.add_patch(panel)

    ax.text(
        x0 + padding,
        y0 + total_h - 0.03,
        title,
        transform=ax.transAxes,
        fontsize=8,
        fontweight="bold",
        color="#111827",
        zorder=31,
    )

    for i, item in enumerate(legend_items):
        yy = y0 + total_h - title_h - (i * row_h) - 0.01

        color_box = Rectangle(
            (x0 + padding, yy),
            0.018,
            0.018,
            transform=ax.transAxes,
            facecolor=item["color"],
            edgecolor="#d1d5db",
            linewidth=0.4,
            zorder=31,
        )
        ax.add_patch(color_box)

        ax.text(
            x0 + padding + 0.025,
            yy + 0.001,
            item["label"],
            transform=ax.transAxes,
            fontsize=7,
            color="#374151",
            va="bottom",
            zorder=31,
        )


def _add_province_labels(ax, gdf_3857, min_distance=190000):
    if "prov" not in gdf_3857.columns or gdf_3857.empty:
        return

    try:
        prov_group = gdf_3857.dissolve(by="prov")
        prov_group["label_point"] = prov_group.geometry.representative_point()
    except Exception:
        return

    placed = []

    for prov_name, row in prov_group.iterrows():
        try:
            x, y = row["label_point"].coords[0]
        except Exception:
            continue

        too_close = False
        for px, py in placed:
            if math.hypot(x - px, y - py) < min_distance:
                too_close = True
                break

        if too_close:
            continue

        txt = ax.text(
            x,
            y,
            str(prov_name),
            fontsize=6.5,
            color="#111827",
            ha="center",
            va="center",
            fontweight="bold",
            alpha=0.82,
            zorder=22,
        )
        txt.set_path_effects([
            pe.Stroke(linewidth=2.3, foreground="white"),
            pe.Normal(),
        ])

        placed.append((x, y))


def _add_inset_map(ax, gdf_3857, region_name=None, accent="#1e63b5"):
    if gdf_3857 is None or gdf_3857.empty:
        return

    try:
        inset_ax = inset_axes(ax, width="22%", height="22%", loc="upper left")
        inset_ax.set_facecolor("white")

        gdf_3857.plot(
            ax=inset_ax,
            color="#f3f4f6",
            edgecolor="#9ca3af",
            linewidth=0.2,
            zorder=1,
        )

        if region_name and "kab_kota" in gdf_3857.columns:
            highlight = gdf_3857[
                gdf_3857["kab_kota"].astype(str).str.lower().str.strip()
                == region_name.lower().strip()
            ]
            if not highlight.empty:
                highlight.plot(
                    ax=inset_ax,
                    color=accent,
                    edgecolor="white",
                    linewidth=0.3,
                    zorder=2,
                )

        inset_ax.set_title("Inset", fontsize=7, pad=2)
        inset_ax.set_axis_off()

    except Exception:
        pass


def _safe_add_basemap(ax):
    try:
        import contextily as ctx
    except ImportError:
        print("[WARNING] contextily not available, skip basemap")
        return

    providers = [
        ctx.providers.CartoDB.PositronNoLabels,
        ctx.providers.CartoDB.Positron,
    ]

    for provider in providers:
        try:
            ctx.add_basemap(
                ax,
                source=provider,
                attribution=False,
            )
            return
        except Exception:
            continue


# =========================================================
# MAIN
# =========================================================
def create_map_image(
    gdf,
    output_dir,
    hazard,
    scenario,
    climate,
    temp_id,
    hazard_label,
    climate_label,
    scenario_label,
    region_name=None,
):
    if gdf is None or gdf.empty or "loss" not in gdf.columns:
        return None

    temp_map = os.path.join(
        output_dir,
        f"_map_{hazard}_{scenario}_{climate}_{temp_id}.png"
    )

    plot_gdf = gdf.copy()
    plot_gdf = plot_gdf.dropna(subset=["loss"]).copy()

    if plot_gdf.empty:
        return None

    try:
        plot_gdf["loss"] = plot_gdf["loss"].astype(float)
    except Exception:
        plot_gdf["loss"] = np.nan
        plot_gdf = plot_gdf.dropna(subset=["loss"]).copy()

    if plot_gdf.empty:
        return None

    accent = _get_hazard_accent(hazard)
    palette = _get_hazard_palette(hazard)

    # ================= CRS =================
    try:
        plot_gdf = plot_gdf.to_crs(epsg=3857)
    except Exception:
        pass

    # ================= CLASS BREAKS =================
    values = plot_gdf["loss"].fillna(0).astype(float).values
    breaks = _compute_dashboard_breaks(values)
    legend_items = _build_legend_items(breaks, palette)

    def classify_color(val):
        idx = _get_class_index(val, breaks)
        if idx < 0:
            return "#e5e7eb"
        return palette[min(idx, len(palette) - 1)]

    plot_gdf["__color__"] = plot_gdf["loss"].apply(classify_color)

    # ================= FIGURE =================
    fig, ax = plt.subplots(figsize=(12.6, 6.4))
    fig.patch.set_facecolor("white")
    ax.set_facecolor("#ffffff")

    # ================= BASE POLYGON =================
    plot_gdf.plot(
        ax=ax,
        color=plot_gdf["__color__"],
        linewidth=0.5,
        edgecolor="#d1d5db",
        zorder=6,
        alpha=0.95,
    )

    # ================= HIGHLIGHT =================
    highlight = None

    if region_name and "kab_kota" in plot_gdf.columns:
        highlight = plot_gdf[
            plot_gdf["kab_kota"].astype(str).str.lower().str.strip()
            == region_name.lower().strip()
        ]
    else:
        try:
            top_idx = plot_gdf["loss"].idxmax()
            highlight = plot_gdf.loc[[top_idx]]
        except Exception:
            highlight = None

    if highlight is not None and not highlight.empty:
        highlight.plot(
            ax=ax,
            facecolor="none",
            edgecolor=accent,
            linewidth=4.2,
            alpha=0.55,
            zorder=14,
        )
        highlight.plot(
            ax=ax,
            facecolor="none",
            edgecolor="#111827",
            linewidth=1.7,
            zorder=15,
        )

        try:
            for _, row in highlight.iterrows():
                point = row.geometry.representative_point()
                label_text = row.get("kab_kota", "")
                txt = ax.text(
                    point.x,
                    point.y,
                    label_text,
                    fontsize=8,
                    color="#111827",
                    fontweight="bold",
                    ha="center",
                    va="center",
                    zorder=16,
                )
                txt.set_path_effects([
                    pe.Stroke(linewidth=3.0, foreground="white"),
                    pe.Normal(),
                ])
        except Exception:
            pass

    # ================= REGIONAL ZOOM =================
    if region_name and highlight is not None and not highlight.empty:
        try:
            minx, miny, maxx, maxy = highlight.total_bounds
            dx = maxx - minx
            dy = maxy - miny

            if dx == 0 or dy == 0:
                pad_x = 15000
                pad_y = 15000
            else:
                pad_x = dx * 0.50
                pad_y = dy * 0.50

            ax.set_xlim(minx - pad_x, maxx + pad_x)
            ax.set_ylim(miny - pad_y, maxy + pad_y)
        except Exception:
            pass

    # ================= BASEMAP =================
    _safe_add_basemap(ax)

    # redraw boundaries
    plot_gdf.plot(
        ax=ax,
        facecolor="none",
        linewidth=0.32,
        edgecolor="#f8fafc",
        zorder=12,
    )

    if highlight is not None and not highlight.empty:
        highlight.plot(
            ax=ax,
            facecolor="none",
            edgecolor="#111827",
            linewidth=1.7,
            zorder=17,
        )

    # ================= MAP HEADER =================
    title_text = f"{hazard_label} • {climate_label} • {scenario_label}"
    if region_name:
        title_text += f" • {region_name}"

    ax.text(
        0.012,
        0.986,
        title_text,
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=11,
        fontweight="bold",
        color="#111827",
        zorder=32,
    )

    subtitle_text = (
        "Klasifikasi sinkron dengan dashboard PADIS"
        if not region_name else
        "Peta detail wilayah terpilih"
    )

    ax.text(
        0.012,
        0.955,
        subtitle_text,
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=8,
        color="#6b7280",
        zorder=32,
    )

    # ================= SCALE BAR =================
    try:
        from matplotlib_scalebar.scalebar import ScaleBar

        scalebar = ScaleBar(
            dx=1,
            units="m",
            location="lower right",
            box_alpha=0.88,
            color="#111827",
            font_properties={"size": 8},
        )
        ax.add_artist(scalebar)

    except ImportError:
        print("[WARNING] matplotlib_scalebar not available, skip scalebar")
    except Exception:
        pass

    # ================= NORTH ARROW =================
    _draw_north_arrow(ax)

    # ================= LEGEND =================
    _draw_custom_legend(ax, legend_items, title="Loss (IDR)")

    # ================= LABEL PROVINCE =================
    if not region_name:
        _add_province_labels(ax, plot_gdf)

    # ================= INSET =================
    _add_inset_map(ax, plot_gdf, region_name=region_name, accent=accent)

    # ================= FRAME =================
    for spine in ax.spines.values():
        spine.set_visible(True)
        spine.set_linewidth(0.8)
        spine.set_edgecolor("#e5e7eb")

    ax.set_axis_off()

    plt.subplots_adjust(left=0.02, right=0.985, top=0.97, bottom=0.03)

    plt.savefig(
        temp_map,
        dpi=220,
        bbox_inches="tight",
        facecolor=fig.get_facecolor(),
    )

    plt.close(fig)

    return temp_map
