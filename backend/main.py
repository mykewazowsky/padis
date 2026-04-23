import os
from flask import Flask, jsonify, request
from flask_cors import CORS

from backend.app.routes.admin import admin_bp
from backend.app.routes.layer_routes import layer_bp
from backend.app.routes.layers import layers_bp
from backend.app.routes.tiles import tiles_bp
from backend.app.routes.report_routes import report_bp


def create_app():
    app = Flask(__name__)

    # =========================
    # CORS FIX (WAJIB 🔥)
    # =========================
    origins_env = os.getenv("FRONTEND_ORIGINS", "")

    allowed_origins = [
        origin.strip()
        for origin in origins_env.split(",")
        if origin.strip()
    ]

    print("[CORS] Allowed origins:", allowed_origins)

    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    @app.after_request
    def after_request(response):
        origin = request.headers.get("Origin")

        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin

        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"

        return response

    # ===============================
    # REGISTER BLUEPRINT
    # ===============================
    app.register_blueprint(admin_bp)
    app.register_blueprint(layer_bp, url_prefix="/api")

    # 🔥 TAMBAHKAN INI
    app.register_blueprint(layers_bp)
    app.register_blueprint(tiles_bp) 
    app.register_blueprint(report_bp) 

    @app.route("/")
    def home():
        return jsonify({"message": "PADIS Backend Running."})

    return app