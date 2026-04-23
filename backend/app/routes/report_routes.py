import os
from io import BytesIO
from datetime import datetime

from flask import Blueprint, request, send_file, jsonify, render_template
from playwright.sync_api import sync_playwright

from app.routes.auth.auth_utils import login_required

from app.utils.report.report_context import (
    build_report_context,
    make_region_slug,
)
from app.utils.report.map_renderer import create_map_image
from app.utils.report.chart_renderer import create_chart_image


report_bp = Blueprint("report_bp", __name__)


# ================= PATH (FIXED) =================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ⬇️ langsung ke folder backend
BACKEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

# ⬇️ folder data/output yang benar
OUTPUT_DIR = os.path.join(BACKEND_DIR, "data", "output")

print("=== PATH DEBUG ===")
print("BASE_DIR:", BASE_DIR)
print("BACKEND_DIR:", BACKEND_DIR)
print("OUTPUT_DIR:", OUTPUT_DIR)
print("==================")


# ================= CONFIG =================
ALLOWED_HAZARDS = {"flood", "drought", "multi"}
ALLOWED_SCENARIOS = {"rp25", "rp50", "rp100", "rp250"}
ALLOWED_CLIMATE = {"nonclimate", "climate"}

FILE_MAP = {
    ("multi", "nonclimate"): "web_multi_nonclimate_{scenario}_v2.geojson",
    ("multi", "climate"): "web_multi_climate_{scenario}_v2.geojson",
    ("flood", "nonclimate"): "web_flood_nonclimate_{scenario}_v2.geojson",
    ("flood", "climate"): "web_flood_climate_{scenario}_v2.geojson",
    ("drought", "nonclimate"): "web_drought_nonclimate_{scenario}_v2.geojson",
    ("drought", "climate"): "web_drought_climate_{scenario}_v2.geojson",
}


# ================= HELPERS =================
def validate_request_params(hazard, scenario, climate):
    if hazard not in ALLOWED_HAZARDS:
        return jsonify({"error": "hazard tidak valid"}), 400

    if scenario not in ALLOWED_SCENARIOS:
        return jsonify({"error": "scenario tidak valid"}), 400

    if climate not in ALLOWED_CLIMATE:
        return jsonify({"error": "climate condition tidak valid"}), 400

    return None


def resolve_geojson_path(hazard, scenario, climate):
    filename = FILE_MAP[(hazard, climate)].format(scenario=scenario)
    full_path = os.path.join(OUTPUT_DIR, filename)

    # 🔥 DEBUG
    print("DEBUG FILE:", filename)
    print("DEBUG PATH:", full_path)
    print("FILE EXISTS:", os.path.exists(full_path))

    return full_path


def load_report_gdf(file_path):
    import geopandas as gpd

    if not os.path.exists(file_path):
        return None

    return gpd.read_file(file_path)


# ================= CSV DOWNLOAD =================
@report_bp.route("/api/download-csv")
@login_required
def download_csv():
    import geopandas as gpd

    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")
    region = request.args.get("region", "").strip()

    region_slug = make_region_slug(region)

    validation_error = validate_request_params(hazard, scenario, climate)
    if validation_error:
        return validation_error

    file_path = resolve_geojson_path(hazard, scenario, climate)

    if not os.path.exists(file_path):
        return jsonify({
            "error": "file tidak ditemukan",
            "path": file_path  # DEBUG penting
        }), 404

    gdf = gpd.read_file(file_path)

    required_columns = ["id_kabkota", "kab_kota", "prov", "loss"]
    available_columns = [col for col in required_columns if col in gdf.columns]

    if not available_columns:
        return jsonify({"error": "kolom data tidak sesuai"}), 500

    df = gdf[available_columns].copy()

    if region and "kab_kota" in df.columns:
        df = df[
            df["kab_kota"].astype(str).str.lower().str.strip() == region.lower()
        ]

    buffer = BytesIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"padis_loss_{hazard}_{climate}_{scenario}_{region_slug}.csv",
    )


# ================= REPORT GENERATOR =================
@report_bp.route("/api/generate-report-v2")
@login_required
def generate_report_v2():
    import tempfile

    hazard = request.args.get("hazard", "multi")
    scenario = request.args.get("scenario", "rp25")
    climate = request.args.get("climate", "nonclimate")
    region = request.args.get("region", "").strip()

    region_slug = make_region_slug(region)
    generated_at = datetime.now().strftime("%d %B %Y")

    validation_error = validate_request_params(hazard, scenario, climate)
    if validation_error:
        return validation_error

    file_path = resolve_geojson_path(hazard, scenario, climate)

    if not os.path.exists(file_path):
        return jsonify({
            "error": "file tidak ditemukan",
            "path": file_path
        }), 404

    gdf = load_report_gdf(file_path)

    context = build_report_context(
        gdf=gdf,
        hazard=hazard,
        scenario=scenario,
        climate=climate,
        region=region,
    )

    temp_id = os.urandom(4).hex()

    # ================= MAP =================
    map_path = create_map_image(
        gdf=context["gdf"],
        output_dir=OUTPUT_DIR,
        hazard=hazard,
        scenario=scenario,
        climate=climate,
        temp_id=temp_id,
        hazard_label=context["hazard_label"],
        climate_label=context["climate_label"],
        scenario_label=context["scenario_label"],
        region_name=region if context["is_regional_report"] else None,
    )

    # ================= CHART =================
    chart_path = None
    if context.get("show_chart", False):
        chart_path = create_chart_image(
            rows=context["top_regions"],
            hazard=hazard,
            scenario=scenario,
            climate=climate,
            output_dir=OUTPUT_DIR,
            temp_id=temp_id,
        )

    # ================= TEMPLATE =================
    template_name = (
        "report/report_padis_regional.html"
        if context["is_regional_report"]
        else "report/report_padis_nasional.html"
    )

    css_path = os.path.join(BASE_DIR, "..", "static", "report", "report.css")

    html = render_template(
        template_name,
        css_path=css_path,
        map_path=map_path,
        chart_path=chart_path,
        generated_at=generated_at,
        **context,
    )

    # ================= PDF =================
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".html",
        delete=False,
        encoding="utf-8",
    ) as tmp:
        tmp.write(html)
        tmp_path = tmp.name

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()

            page.goto(
                f"file:///{tmp_path.replace(os.sep, '/')}",
                wait_until="load",
            )

            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={
                    "top": "0mm",
                    "right": "0mm",
                    "bottom": "0mm",
                    "left": "0mm",
                },
            )

            browser.close()

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

        if map_path and os.path.exists(map_path):
            os.remove(map_path)

        if chart_path and os.path.exists(chart_path):
            os.remove(chart_path)

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"padis_report_{hazard}_{climate}_{scenario}_{region_slug}.pdf",
    )