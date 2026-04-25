import csv
from io import BytesIO, StringIO
from datetime import datetime

from flask import Blueprint, request, send_file, jsonify
from sqlalchemy import text
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

from .auth.auth_utils import login_required
from ..db.session import SessionLocal
from ..utils.report.report_context import make_region_slug

report_bp = Blueprint("report_bp", __name__)

# ── ID mappings — must match DB ────────────────────────────────────────────────
_HAZARD_ALIAS  = {"multi": "multihazard"}
_HAZARD_ID     = {"flood": 1, "drought": 2, "multihazard": 3}
_SCENARIO_ID   = {"nonclimate": 1, "climate": 2}
_RP_STR_TO_INT = {"rp25": 25, "rp50": 50, "rp100": 100, "rp250": 250}
_RP_ID         = {25: 1, 50: 2, 100: 3, 250: 4}
_HAZARD_LABEL  = {"flood": "Flood", "drought": "Drought", "multihazard": "Multi-hazard"}

ALLOWED_HAZARDS   = {"flood", "drought", "multi"}
ALLOWED_SCENARIOS = {"rp25", "rp50", "rp100", "rp250"}
ALLOWED_CLIMATE   = {"nonclimate", "climate"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _validate(hazard, scenario, climate):
    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": f"Hazard tidak valid: {hazard}"}), 400
    if scenario not in ALLOWED_SCENARIOS:
        return jsonify({"error": f"Scenario tidak valid: {scenario}"}), 400
    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": f"Climate tidak valid: {climate}"}), 400
    return None


def _get_ids(hazard, scenario, climate):
    db_hazard   = _HAZARD_ALIAS.get(hazard, hazard)
    hazard_id   = _HAZARD_ID[db_hazard]
    scenario_id = _SCENARIO_ID[climate]
    rp          = _RP_STR_TO_INT[scenario]
    rp_id       = _RP_ID[rp]
    return db_hazard, hazard_id, scenario_id, rp_id


def _latest_run_id(db):
    row = db.execute(text(
        "SELECT id FROM runs ORDER BY id DESC LIMIT 1"
    )).fetchone()
    return row.id if row else None


def _query_data(db, hazard_id, scenario_id, rp_id, run_id):
    """All regions with loss, aal, hazard_index, production for the given filters."""
    return db.execute(text("""
        SELECT
            r.id_kabkota,
            r.kab_kota,
            r.prov,
            COALESCE(l.loss,       0)::float AS loss,
            COALESCE(a.aal,        0)::float AS aal,
            COALESCE(z.mean_value, 0)::float AS hazard_index,
            COALESCE(p.total_prod, 0)::float AS total_prod
        FROM regions_adm r
        LEFT JOIN losses l
            ON  r.id_kabkota  = l.id_kabkota
            AND l.hazard_id   = :hazard_id
            AND l.scenario_id = :scenario_id
            AND l.rp_id       = :rp_id
            AND l.run_id      = :run_id
        LEFT JOIN aal a
            ON  r.id_kabkota  = a.id_kabkota
            AND a.hazard_id   = :hazard_id
            AND a.scenario_id = :scenario_id
            AND a.run_id      = :run_id
        LEFT JOIN zonal_kabupaten z
            ON  r.id_kabkota  = z.id_kabkota
            AND z.hazard_id   = :hazard_id
            AND z.scenario_id = :scenario_id
            AND z.rp_id       = :rp_id
            AND z.run_id      = :run_id
        LEFT JOIN (
            SELECT id_kabkota, SUM(total_prod)::float AS total_prod
            FROM production GROUP BY id_kabkota
        ) p ON r.id_kabkota = p.id_kabkota
        ORDER BY loss DESC NULLS LAST, r.kab_kota ASC
    """), {
        "hazard_id":   hazard_id,
        "scenario_id": scenario_id,
        "rp_id":       rp_id,
        "run_id":      run_id,
    }).fetchall()


def _aal_total(db, hazard_id, scenario_id, run_id):
    row = db.execute(text("""
        SELECT COALESCE(SUM(aal), 0)::float AS total
        FROM aal
        WHERE hazard_id   = :hid
          AND scenario_id = :sid
          AND run_id      = :run_id
    """), {"hid": hazard_id, "sid": scenario_id, "run_id": run_id}).fetchone()
    return float(row.total) if row else 0.0


def _fmt(v):
    """Compact Rupiah formatter."""
    try:
        v = float(v)
    except Exception:
        return "Rp 0"
    if abs(v) >= 1e12:
        return f"Rp {v / 1e12:.1f} T"
    if abs(v) >= 1e9:
        return f"Rp {v / 1e9:.1f} M"
    if abs(v) >= 1e6:
        return f"Rp {v / 1e6:.1f} Jt"
    return "Rp {:,.0f}".format(v).replace(",", ".")


# ══════════════════════════════════════════════════════════════════════════════
# CSV DOWNLOAD
# ══════════════════════════════════════════════════════════════════════════════

@report_bp.route("/api/download-csv")
@login_required
def download_csv():
    hazard   = request.args.get("hazard",   "multi")
    scenario = request.args.get("scenario", "rp25")
    climate  = request.args.get("climate",  "nonclimate")
    region   = request.args.get("region",   "").strip()

    err = _validate(hazard, scenario, climate)
    if err:
        return err

    _db_hazard, hazard_id, scenario_id, rp_id = _get_ids(hazard, scenario, climate)

    db = SessionLocal()
    try:
        run_id = _latest_run_id(db)
        if not run_id:
            return jsonify({"error": "No runs found"}), 404

        rows = _query_data(db, hazard_id, scenario_id, rp_id, run_id)

        if region:
            rows = [r for r in rows
                    if r.kab_kota.strip().lower() == region.lower()]

        if not rows:
            return jsonify({"error": "Tidak ada data untuk filter yang dipilih."}), 404

        out = StringIO()
        writer = csv.writer(out)
        writer.writerow([
            "ID Kabkota",
            "Kabupaten / Kota",
            "Provinsi",
            f"Loss (Rp) — {hazard.upper()} {scenario.upper()} {climate}",
            f"AAL (Rp) — {hazard.upper()} {climate}",
            "Hazard Index (0–1)",
            "Total Produksi (ton)",
        ])
        for r in rows:
            writer.writerow([
                r.id_kabkota,
                r.kab_kota,
                r.prov,
                round(r.loss, 2),
                round(r.aal, 2),
                round(r.hazard_index, 6),
                round(r.total_prod, 2),
            ])

        buf = BytesIO(out.getvalue().encode("utf-8-sig"))  # BOM for Excel
        region_slug = make_region_slug(region)
        return send_file(
            buf,
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"padis_{hazard}_{climate}_{scenario}_{region_slug}.csv",
        )
    finally:
        db.close()


# ══════════════════════════════════════════════════════════════════════════════
# PDF REPORT  (ReportLab — no browser dependency)
# ══════════════════════════════════════════════════════════════════════════════

# ── ReportLab palette ─────────────────────────────────────────────────────────
_C_PRIMARY    = colors.HexColor("#0F4C81")
_C_DARK_BLUE  = colors.HexColor("#1E40AF")
_C_ACCENT     = colors.HexColor("#10B981")
_C_DANGER     = colors.HexColor("#EF4444")
_C_LIGHT_BLUE = colors.HexColor("#EFF6FF")
_C_BORDER     = colors.HexColor("#E2E8F0")
_C_TEXT       = colors.HexColor("#1F2937")
_C_MUTED      = colors.HexColor("#6B7280")
_C_ROW_ALT    = colors.HexColor("#F8FAFC")
_C_TH_BG      = colors.HexColor("#1E40AF")


def _ps(name, **kw):
    return ParagraphStyle(name, **kw)


def _build_pdf(buf, ctx):
    """Render the PADIS risk report into *buf* using ReportLab PLATYPUS."""
    PAGE_W, PAGE_H = A4
    margin     = 15 * mm
    content_w  = PAGE_W - 2 * margin

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=15 * mm,
    )

    # ── Paragraph styles ──────────────────────────────────────────────────────
    ST_TITLE  = _ps("st_title",  fontName="Helvetica-Bold",    fontSize=18,
                    textColor=colors.white,                    leading=22, alignment=TA_LEFT)
    ST_SUB    = _ps("st_sub",    fontName="Helvetica",          fontSize=9,
                    textColor=colors.HexColor("#BFDBFE"),      leading=12)
    ST_DATE   = _ps("st_date",   fontName="Helvetica",          fontSize=8,
                    textColor=colors.HexColor("#BFDBFE"),      leading=10, alignment=TA_RIGHT)
    ST_H2     = _ps("st_h2",     fontName="Helvetica-Bold",    fontSize=10,
                    textColor=_C_PRIMARY,                      leading=13, spaceAfter=3)
    ST_KPI_V  = _ps("st_kpiv",   fontName="Helvetica-Bold",    fontSize=13,
                    textColor=_C_PRIMARY,                      leading=16, alignment=TA_CENTER)
    ST_KPI_L  = _ps("st_kpil",   fontName="Helvetica",          fontSize=7,
                    textColor=_C_MUTED,                        leading=9,  alignment=TA_CENTER)
    ST_BODY   = _ps("st_body",   fontName="Helvetica",          fontSize=8,
                    textColor=_C_TEXT,                         leading=11)
    ST_CELL   = _ps("st_cell",   fontName="Helvetica",          fontSize=7.5,
                    textColor=_C_TEXT,                         leading=9)
    ST_CELL_R = _ps("st_cellr",  fontName="Helvetica",          fontSize=7.5,
                    textColor=_C_TEXT,                         leading=9,  alignment=TA_RIGHT)
    ST_TH     = _ps("st_th",     fontName="Helvetica-Bold",    fontSize=7.5,
                    textColor=colors.white,                    leading=9,  alignment=TA_CENTER)
    ST_NOTE   = _ps("st_note",   fontName="Helvetica-Oblique", fontSize=7,
                    textColor=_C_MUTED,                        leading=10)
    ST_FOOTER = _ps("st_footer", fontName="Helvetica",          fontSize=7,
                    textColor=_C_MUTED,                        leading=9,  alignment=TA_CENTER)

    story = []

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 1 — HEADER
    # ══════════════════════════════════════════════════════════════════════════
    report_title = (
        f"Laporan Risiko — {ctx['region']}"
        if ctx["is_regional"]
        else "Laporan Risiko Nasional — PADIS"
    )
    subtitle = (
        f"Bahaya: {ctx['hazard_label']}  |  Skenario: {ctx['scenario_label']}"
        f"  |  Iklim: {ctx['climate_label']}"
    )

    # Title bar
    hdr = Table(
        [[Paragraph(report_title, ST_TITLE), Paragraph(ctx["generated_at"], ST_DATE)]],
        colWidths=[content_w * 0.72, content_w * 0.28],
    )
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), _C_PRIMARY),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (0,  0),  10),
        ("RIGHTPADDING",  (1, 0), (1,  0),  10),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(hdr)

    # Subtitle bar
    sub = Table(
        [[Paragraph(subtitle, ST_SUB)]],
        colWidths=[content_w],
    )
    sub.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), _C_DARK_BLUE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(sub)
    story.append(Spacer(1, 5 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # KPI CARDS  (4 metrics in one row)
    # ══════════════════════════════════════════════════════════════════════════
    kpi_cw = content_w / 4
    kpi = Table(
        [
            [
                Paragraph(ctx["total_loss"],     ST_KPI_V),
                Paragraph(ctx["top_loss"],        ST_KPI_V),
                Paragraph(ctx["aal_nonclimate"],  ST_KPI_V),
                Paragraph(str(ctx["data_count"]), ST_KPI_V),
            ],
            [
                Paragraph("Total Kerugian",       ST_KPI_L),
                Paragraph("Kerugian Tertinggi",   ST_KPI_L),
                Paragraph("AAL Non-Iklim",        ST_KPI_L),
                Paragraph("Wilayah Terdampak",    ST_KPI_L),
            ],
        ],
        colWidths=[kpi_cw] * 4,
        rowHeights=[18, 12],
    )
    kpi.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), _C_LIGHT_BLUE),
        ("BOX",           (0, 0), (0, -1),  0.5, _C_BORDER),
        ("BOX",           (1, 0), (1, -1),  0.5, _C_BORDER),
        ("BOX",           (2, 0), (2, -1),  0.5, _C_BORDER),
        ("BOX",           (3, 0), (3, -1),  0.5, _C_BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, 0),  6),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  2),
        ("TOPPADDING",    (0, 1), (-1, 1),  2),
        ("BOTTOMPADDING", (0, 1), (-1, 1),  6),
    ]))
    story.append(kpi)
    story.append(Spacer(1, 3 * mm))

    # ── AAL comparison row ────────────────────────────────────────────────────
    aal_up    = ctx["aal_pct_up"]
    d_color   = "#EF4444" if aal_up else "#10B981"
    arrow     = "▲" if aal_up else "▼"

    aal_row = Table(
        [[
            Paragraph(
                f'<b>AAL Tanpa Perubahan Iklim:</b>  {ctx["aal_nonclimate"]}',
                ST_BODY,
            ),
            Paragraph(
                f'<b>AAL Dengan Perubahan Iklim:</b>  {ctx["aal_climate"]}',
                ST_BODY,
            ),
            Paragraph(
                f'<font color="{d_color}"><b>{arrow} {ctx["aal_delta"]}  ({ctx["aal_pct"]})</b></font>',
                ST_BODY,
            ),
        ]],
        colWidths=[content_w * 0.34, content_w * 0.34, content_w * 0.32],
    )
    aal_row.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#F0F9FF")),
        ("BOX",           (0, 0), (-1, -1), 0.5, _C_BORDER),
        ("LINEAFTER",     (0, 0), (1, 0),   0.5, _C_BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ]))
    story.append(aal_row)
    story.append(Spacer(1, 4 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # TOP REGIONS TABLE
    # ══════════════════════════════════════════════════════════════════════════
    table_title = (
        f"Data Wilayah: {ctx['region']}"
        if ctx["is_regional"]
        else "10 Kabupaten/Kota dengan Kerugian Tertinggi"
    )
    story.append(Paragraph(table_title, ST_H2))

    # Column widths must sum to content_w (≈ 181 mm for A4 with 15 mm margins)
    col_ws = [8*mm, 38*mm, 28*mm, 28*mm, 26*mm, 18*mm, 23*mm, 12*mm]

    tbl_data = [[
        Paragraph("No",           ST_TH),
        Paragraph("Kabupaten/Kota", ST_TH),
        Paragraph("Provinsi",     ST_TH),
        Paragraph("Loss (Rp)",    ST_TH),
        Paragraph("AAL (Rp)",     ST_TH),
        Paragraph("H-Index",      ST_TH),
        Paragraph("Produksi (t)", ST_TH),
        Paragraph("Share",        ST_TH),
    ]]

    for row in ctx["top_regions"]:
        tbl_data.append([
            Paragraph(str(row["rank"]),        ST_CELL),
            Paragraph(row["kab_kota"],         ST_CELL),
            Paragraph(row["prov"],             ST_CELL),
            Paragraph(row["loss_fmt"],         ST_CELL_R),
            Paragraph(row["aal_fmt"],          ST_CELL_R),
            Paragraph(row["hidx"],             ST_CELL_R),
            Paragraph(row["prod_fmt"],         ST_CELL_R),
            Paragraph(f'{row["share_pct"]}%',  ST_CELL_R),
        ])

    row_styles = [
        ("BACKGROUND",    (0, 0), (-1, 0),  _C_TH_BG),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",          (0, 0), (-1, -1), 0.3, _C_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(tbl_data)):
        bg = _C_ROW_ALT if i % 2 == 0 else colors.white
        row_styles.append(("BACKGROUND", (0, i), (-1, i), bg))

    data_tbl = Table(tbl_data, colWidths=col_ws, repeatRows=1)
    data_tbl.setStyle(TableStyle(row_styles))
    story.append(data_tbl)
    story.append(Spacer(1, 4 * mm))

    # ── Insight narrative ─────────────────────────────────────────────────────
    if not ctx["empty_state"]:
        top_share  = ctx["top_loss_share"]
        top3_share = ctx["top3_share"]
        insight = (
            f"Berdasarkan analisis skenario <b>{ctx['scenario_label']}</b> "
            f"({ctx['climate_label']}), total kerugian padi mencapai "
            f"<b>{ctx['total_loss']}</b> dari <b>{ctx['data_count']}</b> kabupaten/kota. "
            f"Wilayah tertinggi adalah <b>{ctx['top_region']}</b> "
            f"({top_share:.1f}% dari total loss). "
            f"Tiga wilayah teratas menyumbang {top3_share:.1f}% dari keseluruhan kerugian. "
        )
        if aal_up:
            insight += (
                f"Proyeksi AAL meningkat <b>{ctx['aal_delta']} ({ctx['aal_pct']})</b> "
                f"pada skenario perubahan iklim, mengindikasikan risiko masa depan yang lebih tinggi."
            )
        else:
            insight += (
                f"Proyeksi AAL menurun <b>{ctx['aal_delta']} ({ctx['aal_pct']})</b> "
                f"pada skenario perubahan iklim."
            )
        story.append(Paragraph(insight, ST_BODY))

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2 — DEFINISI & METADATA
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("Definisi Variabel & Catatan Metodologi", ST_H2))
    story.append(HRFlowable(width=content_w, thickness=0.5, color=_C_BORDER, spaceAfter=4))

    defs = [
        ("Loss (Kerugian)",
         "Estimasi kerugian produksi padi akibat bencana pada skenario return period "
         "tertentu, dinyatakan dalam Rupiah."),
        ("AAL (Annual Average Loss)",
         "Ekspektasi kerugian tahunan rata-rata berdasarkan probabilitas kejadian, "
         "dinyatakan dalam Rupiah."),
        ("Hazard Index",
         "Indeks bahaya normalisasi (0–1) yang menggambarkan intensitas ancaman bencana. "
         "Nilai lebih tinggi berarti ancaman lebih besar."),
        ("Produksi Padi",
         "Total produksi padi tahunan di kabupaten/kota (dalam ton), "
         "berdasarkan data pertanian terkini."),
        ("Return Period",
         "RP25 = 1 kali per 25 tahun, RP50 = 1 kali per 50 tahun, "
         "RP100 = 1 kali per 100 tahun, RP250 = 1 kali per 250 tahun."),
        ("Skenario Iklim",
         "Non-Climate = kondisi iklim historis/saat ini. "
         "Climate = proyeksi dengan dampak perubahan iklim masa depan."),
    ]

    def_data = [
        [Paragraph(f"<b>{term}</b>", ST_CELL), Paragraph(defn, ST_NOTE)]
        for term, defn in defs
    ]
    def_tbl = Table(def_data, colWidths=[45*mm, content_w - 45*mm])
    def_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, -1),  _C_LIGHT_BLUE),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("GRID",          (0, 0), (-1, -1), 0.3, _C_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    story.append(def_tbl)
    story.append(Spacer(1, 6 * mm))

    # Metadata
    story.append(Paragraph("Metadata Laporan", ST_H2))
    story.append(HRFlowable(width=content_w, thickness=0.5, color=_C_BORDER, spaceAfter=4))

    meta_rows = [
        ("Jenis Bahaya",    ctx["hazard_label"]),
        ("Skenario",        ctx["scenario_label"]),
        ("Kondisi Iklim",   ctx["climate_label"]),
        ("Waktu Dibuat",    ctx["generated_at"]),
        ("Cakupan Wilayah", ctx["region"] or "Seluruh Indonesia"),
        ("Sumber Data",     "PADIS — Paddy Loss and Damage Information System"),
    ]
    meta_data = [
        [Paragraph(f"<b>{k}</b>", ST_CELL), Paragraph(v, ST_CELL)]
        for k, v in meta_rows
    ]
    meta_tbl = Table(meta_data, colWidths=[45*mm, content_w - 45*mm])
    meta_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, -1),  _C_LIGHT_BLUE),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("GRID",          (0, 0), (-1, -1), 0.3, _C_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 8 * mm))

    # Footer
    story.append(HRFlowable(width=content_w, thickness=0.5, color=_C_BORDER, spaceAfter=4))
    story.append(Paragraph(
        "Laporan ini dibuat otomatis oleh PADIS (Paddy Loss and Damage Information System). "
        "Data dan analisis bersifat indikatif untuk keperluan perencanaan.",
        ST_FOOTER,
    ))

    doc.build(story)


# ══════════════════════════════════════════════════════════════════════════════
# REPORT ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@report_bp.route("/api/generate-report-v2")
@login_required
def generate_report_v2():
    hazard   = request.args.get("hazard",   "multi")
    scenario = request.args.get("scenario", "rp25")
    climate  = request.args.get("climate",  "nonclimate")
    region   = request.args.get("region",   "").strip()

    err = _validate(hazard, scenario, climate)
    if err:
        return err

    db_hazard, hazard_id, scenario_id, rp_id = _get_ids(hazard, scenario, climate)

    db = SessionLocal()
    try:
        run_id = _latest_run_id(db)
        if not run_id:
            return jsonify({"error": "No runs found"}), 404

        rows = _query_data(db, hazard_id, scenario_id, rp_id, run_id)

        if region:
            rows = [r for r in rows
                    if r.kab_kota.strip().lower() == region.lower()]

        # ── Statistics ────────────────────────────────────────────────────────
        valid      = [r for r in rows if r.loss > 0]
        data_count = len(valid)
        total_loss = sum(r.loss for r in valid)
        top_rows   = valid[:10]

        aal_nc    = _aal_total(db, hazard_id, _SCENARIO_ID["nonclimate"], run_id)
        aal_cc    = _aal_total(db, hazard_id, _SCENARIO_ID["climate"],    run_id)
        aal_delta = aal_cc - aal_nc
        aal_pct   = ((aal_delta / aal_nc) * 100.0) if aal_nc else 0.0

        top_row        = valid[0] if valid else None
        top_name       = f"{top_row.kab_kota}, {top_row.prov}" if top_row else "-"
        top_loss_v     = top_row.loss if top_row else 0.0
        top_loss_share = (top_loss_v / total_loss * 100.0) if total_loss else 0.0
        top3_share     = (sum(r.loss for r in valid[:3]) / total_loss * 100.0) if total_loss else 0.0

        formatted_top = [
            {
                "rank":      i + 1,
                "kab_kota":  r.kab_kota,
                "prov":      r.prov,
                "loss_fmt":  _fmt(r.loss),
                "aal_fmt":   _fmt(r.aal),
                "hidx":      f"{r.hazard_index:.4f}",
                "prod_fmt":  f"{r.total_prod:,.0f}".replace(",", "."),
                "share_pct": round((r.loss / total_loss * 100) if total_loss else 0, 1),
            }
            for i, r in enumerate(top_rows)
        ]

        ctx = {
            "hazard_label":   _HAZARD_LABEL.get(db_hazard, db_hazard),
            "climate_label":  "Climate" if climate == "climate" else "Non-Climate",
            "scenario_label": scenario.upper(),
            "generated_at":   datetime.now().strftime("%d %B %Y, %H:%M WIB"),
            "region":         region,
            "is_regional":    bool(region),
            "data_count":     data_count,

            "total_loss":     _fmt(total_loss),
            "top_region":     top_name,
            "top_loss":       _fmt(top_loss_v),
            "top_loss_share": round(top_loss_share, 1),
            "top3_share":     round(top3_share, 1),

            "aal_nonclimate": _fmt(aal_nc),
            "aal_climate":    _fmt(aal_cc),
            "aal_delta":      _fmt(abs(aal_delta)),
            "aal_pct":        f"{aal_pct:+.1f}%",
            "aal_pct_up":     aal_delta >= 0,

            "top_regions":    formatted_top,
            "empty_state":    data_count == 0,
        }
    finally:
        db.close()

    buf = BytesIO()
    _build_pdf(buf, ctx)
    buf.seek(0)

    region_slug = make_region_slug(region)
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"padis_report_{hazard}_{climate}_{scenario}_{region_slug}.pdf",
    )
