import os
import textwrap
import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np


# =========================================================
# PALETTE SINKRON DENGAN FRONTEND
# =========================================================
def _get_chart_colors(hazard: str, n: int):
    if hazard == "drought":
        primary = "#d4a514"
        secondary = "#fde68a"
        dark = "#8a6300"
    elif hazard == "flood":
        primary = "#1e63b5"
        secondary = "#bfdbfe"
        dark = "#174f92"
    else:
        primary = "#7c3aed"
        secondary = "#d8b4fe"
        dark = "#4c1d95"

    colors = []
    for i in range(n):
        if i == 0:
            colors.append(primary)
        elif i == 1:
            colors.append(dark)
        else:
            colors.append(secondary)

    return colors


# =========================================================
# FORMAT LABEL
# =========================================================
def _format_compact_rupiah(value: float) -> str:
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


def _wrap_label(text: str, width: int = 18) -> str:
    if not text:
        return "-"
    return "\n".join(textwrap.wrap(str(text), width=width))


# =========================================================
# MAIN
# =========================================================
def create_chart_image(
    rows,
    output_dir,
    hazard,
    scenario,
    climate,
    temp_id,
):
    if not rows:
        return None

    temp_chart = os.path.join(
        output_dir,
        f"_chart_{hazard}_{scenario}_{climate}_{temp_id}.png"
    )

    cleaned_rows = []
    for row in rows:
        try:
            kab_kota = row.get("kab_kota", "-")
            loss = float(row.get("loss", 0) or 0)
            cleaned_rows.append({
                "kab_kota": kab_kota,
                "loss": loss,
            })
        except Exception:
            continue

    if not cleaned_rows:
        return None

    # batasi top 8 agar tetap clean di report
    cleaned_rows = sorted(
        cleaned_rows,
        key=lambda x: x["loss"],
        reverse=True
    )[:8]

    names = [_wrap_label(r["kab_kota"], width=18) for r in cleaned_rows]
    values = [r["loss"] for r in cleaned_rows]
    y = np.arange(len(names))

    colors = _get_chart_colors(hazard, len(values))
    max_val = max(values) if values else 0

    fig_h = max(4.4, 0.62 * len(names) + 2.0)
    fig, ax = plt.subplots(figsize=(9.5, fig_h))
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    bars = ax.barh(
        y,
        values,
        color=colors,
        height=0.62,
        edgecolor="none",
        zorder=3,
    )

    ax.invert_yaxis()

    # ================= TITLES =================
    ax.set_title(
        "Distribusi Wilayah Terdampak",
        fontsize=13,
        fontweight="bold",
        loc="left",
        pad=14,
    )

    subtitle = f"{hazard.capitalize()} • {climate.capitalize()} • {scenario.upper()}"
    ax.text(
        0.0,
        1.02,
        subtitle,
        transform=ax.transAxes,
        fontsize=9,
        color="#6b7280",
        ha="left",
        va="bottom",
    )

    # ================= AXIS =================
    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=8.8, color="#111827")
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", labelsize=8, colors="#6b7280")

    ax.grid(
        axis="x",
        linestyle="--",
        linewidth=0.6,
        alpha=0.28,
        color="#94a3b8",
        zorder=0,
    )

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.spines["bottom"].set_color("#d1d5db")

    ax.set_xlim(0, max_val * 1.24 if max_val > 0 else 1)

    # ================= LABEL VALUE =================
    for i, (bar, v) in enumerate(zip(bars, values)):
        x = bar.get_width()
        y_mid = bar.get_y() + (bar.get_height() / 2)

        ax.text(
            x + (max_val * 0.015 if max_val > 0 else 0.1),
            y_mid,
            _format_compact_rupiah(v),
            va="center",
            ha="left",
            fontsize=8.2,
            color="#374151",
            fontweight="bold" if i == 0 else "semibold",
        )

        if i == 0:
            ax.text(
                x + (max_val * 0.11 if max_val > 0 else 0.2),
                y_mid,
                "#1",
                va="center",
                ha="left",
                fontsize=9,
                color="#111827",
                fontweight="bold",
            )

    # ================= FOOTNOTE =================
    ax.text(
        0.0,
        -0.12,
        "Peringkat teratas diberi penekanan visual untuk menunjukkan konsentrasi risiko tertinggi.",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=7.4,
        color="#6b7280",
    )

    ax.text(
        1.0,
        -0.12,
        "Sumber: PADIS processed loss dataset",
        transform=ax.transAxes,
        ha="right",
        va="top",
        fontsize=7,
        color="#9ca3af",
    )

    plt.tight_layout()

    plt.savefig(
        temp_chart,
        dpi=220,
        bbox_inches="tight",
        facecolor=fig.get_facecolor(),
    )

    plt.close(fig)

    return temp_chart
