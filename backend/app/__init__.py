from dotenv import load_dotenv
import os

load_dotenv()

from flask import Flask, request
from flask_cors import CORS

# =========================
# IMPORT ROUTES (UPDATED 🔥)
# =========================
from .routes import analytics_bp, auth_bp, admin_bp
from .routes.layers import layers_bp
from .routes.tiles import tiles_bp
from .routes.report_routes import report_bp
from .routes.auth.auth_store import seed_default_users

def create_app():
    app = Flask(__name__)

    # =========================
    # CONFIG
    # =========================
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "padis-secret-key")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "padis-jwt-secret")

    # =========================
    # CORS CONFIG
    # =========================
    origins_env = os.getenv("FRONTEND_ORIGINS") or os.getenv("FRONTEND_ORIGIN", "")

    allowed_origins = [
        origin.strip()
        for origin in origins_env.split(",")
        if origin.strip()
    ]

    if not allowed_origins:
        allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    print("[CORS] Allowed origins:", allowed_origins)

    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    # =========================
    # HANDLE PREFLIGHT
    # =========================
    @app.after_request
    def after_request(response):
        origin = request.headers.get("Origin")

        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin

        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"

        return response

    # =========================
    # REGISTER BLUEPRINT
    # =========================
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(admin_bp)

    # Layer data (GeoJSON + values)
    app.register_blueprint(layers_bp)   # /api/layers/*

    # Vector tile endpoint
    app.register_blueprint(tiles_bp)    # /api/tiles/<layer>/<z>/<x>/<y>

    app.register_blueprint(report_bp)

    # =========================
    # HEALTH CHECK
    # =========================
    @app.route("/health")
    def health():
        return {"status": "ok"}

    # =========================
    # DEBUG ROUTES
    # =========================
    print("========== ROUTES ==========")
    print(app.url_map)
    print("============================")

    # =========================
    # SEED DEFAULT USERS
    # =========================
    seed_default_users()

    return app