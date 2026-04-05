from flask import Blueprint, jsonify, request

from app.services.geoserver_service import publish_featuretype


admin_geoserver_bp = Blueprint(
    "admin_geoserver_bp",
    __name__,
    url_prefix="/api/admin/geoserver",
)


@admin_geoserver_bp.route("/publish", methods=["POST"])
def publish_layer():
    body = request.get_json(silent=True) or {}

    native_name = body.get("native_name", "hazard_features")
    layer_name = body.get("layer_name", "hazard_features")
    srs = body.get("srs", "EPSG:4326")
    schema = body.get("schema", "public")

    try:
        result = publish_featuretype(
            native_name=native_name,
            layer_name=layer_name,
            srs=srs,
            schema=schema,
        )
        return jsonify(result), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500