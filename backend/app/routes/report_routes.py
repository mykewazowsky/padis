import csv
import os
from io import BytesIO, StringIO
from datetime import datetime

from flask import Blueprint, request, send_file, jsonify, render_template
from sqlalchemy import text
from playwright.sync_api import sync_playwright

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


def _aal_total(db, hazard_id, scenario_id):
    row = db.execute(text("""
        SELECT COALESCE(SUM(aal), 0)::float AS total
        FROM aal
        WHERE hazard_id = :hid AND scenario_id = :sid
    """), {"hid": hazard_id, "sid": scenario_id}).fetchone()
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
# REPORT GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

@report_bp.route("/api/generate-report-v2")
@login_required
def generate_report_v2():
    import tempfile

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

        # ── Compute statistics ──────────────────────────────────────────────
        valid      = [r for r in rows if r.loss > 0]
        data_count = len(valid)
        total_loss = sum(r.loss for r in valid)
        top_rows   = valid[:10]

        # AAL both scenarios for comparison
        aal_nc = _aal_total(db, hazard_id, _SCENARIO_ID["nonclimate"])
        aal_cc = _aal_total(db, hazard_id, _SCENARIO_ID["climate"])

        aal_delta = aal_cc - aal_nc
        aal_pct   = ((aal_delta / aal_nc) * 100.0) if aal_nc else 0.0

        top_row       = valid[0] if valid else None
        top_name      = f"{top_row.kab_kota}, {top_row.prov}" if top_row else "-"
        top_loss_v    = top_row.loss if top_row else 0.0
        top_loss_share = (top_loss_v / total_loss * 100.0) if total_loss else 0.0

        top3_loss   = sum(r.loss for r in valid[:3])
        top3_share  = (top3_loss / total_loss * 100.0) if total_loss else 0.0

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

        # ── Context ─────────────────────────────────────────────────────────
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

    # ── Render HTML ────────────────────────────────────────────────────────────
    template = (
        "report/report_padis_regional.html"
        if ctx["is_regional"]
        else "report/report_padis_nasional.html"
    )
    html = render_template(template, **ctx)

    # ── PDF via Playwright ─────────────────────────────────────────────────────
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".html", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(html)
        tmp_path = tmp.name

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page    = browser.new_page()
            page.goto(
                f"file:///{tmp_path.replace(os.sep, '/')}",
                wait_until="networkidle",
            )
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0mm", "right": "0mm",
                        "bottom": "0mm", "left": "0mm"},
            )
            browser.close()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    region_slug = make_region_slug(region)
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"padis_report_{hazard}_{climate}_{scenario}_{region_slug}.pdf",
    )
