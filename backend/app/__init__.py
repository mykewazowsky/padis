from dotenv import load_dotenv
import os

load_dotenv()

from flask import Flask, request
from flask_cors import CORS

from .routes import analytics_bp, auth_bp, admin_bp
from .routes.layers import layers_bp
from .routes.tiles import tiles_bp
from .routes.report_routes import report_bp
from .routes.auth.auth_store import seed_default_users

# Admin sub-blueprints (phase 3: fix missing blueprint registration)
from .routes.admin.output_routes import admin_output_bp
from .routes.admin.process_routes import admin_process_bp
from .routes.admin.user_routes import admin_user_bp
from .routes.admin.geoserver_routes import admin_geoserver_bp


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "padis-secret-key")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "padis-jwt-secret")

    # ── CORS ──────────────────────────────────────────────────────────────────
    origins_env = os.getenv("FRONTEND_ORIGINS") or os.getenv("FRONTEND_ORIGIN", "")
    allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
    if not allowed_origins:
        allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

    print("[CORS] Allowed origins:", allowed_origins)

    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    @app.after_request
    def after_request(response):
        origin = request.headers.get("Origin")
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    # ── Blueprints ─────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")

    # admin_bp: routes defined directly on admin_bp (data_routes.py)
    app.register_blueprint(admin_bp)
    # Admin sub-blueprints: routes defined on their own blueprint objects
    app.register_blueprint(admin_output_bp)
    app.register_blueprint(admin_process_bp)
    app.register_blueprint(admin_user_bp)
    app.register_blueprint(admin_geoserver_bp)

    app.register_blueprint(layers_bp)
    app.register_blueprint(tiles_bp)
    app.register_blueprint(report_bp)

    # ── Health ─────────────────────────────────────────────────────────────────
    @app.route("/health")
    def health():
        return {"status": "ok"}

    print("========== ROUTES ==========")
    print(app.url_map)
    print("============================")

    seed_default_users()

    return app
