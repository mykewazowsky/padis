from dotenv import load_dotenv
import os

load_dotenv()

from flask import Flask
from flask_cors import CORS

from app.routes import analytics_bp, auth_bp, layer_bp
from app.routes.admin.data_routes import admin_data_bp
from app.routes.admin.output_routes import admin_output_bp
from app.routes.admin.process_routes import admin_process_bp
from app.routes.admin.user_routes import admin_user_bp


def ensure_default_admin():
    from app.routes.auth.auth_store import find_user_by_email, create_user
    from app.routes.auth.auth_utils import hash_password

    admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@padis.local")
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD")

    if not admin_password:
        print("[PADIS] DEFAULT_ADMIN_PASSWORD not set. Skip default admin bootstrap.")
        return

    existing = find_user_by_email(admin_email)
    if existing:
        return

    create_user(
        name="Admin PADIS",
        email=admin_email,
        password_hash=hash_password(admin_password),
        role="admin",
        status="active",
    )

    print("=" * 60)
    print("[PADIS] Default admin created")
    print(f"  email    : {admin_email}")
    print("  password : [HIDDEN]")
    print("=" * 60)


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.getenv(
        "SECRET_KEY",
        "padis-secret-key-dev-please-change-2026-secure-long",
    )
    app.config["JWT_SECRET_KEY"] = os.getenv(
        "JWT_SECRET_KEY",
        "padis-jwt-secret-key-dev-please-change-2026-secure-long",
    )
    app.config["FRONTEND_BASE_URL"] = os.getenv(
        "FRONTEND_BASE_URL",
        "http://localhost:3000",
    )

    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    CORS(
        app,
        resources={r"/api/*": {"origins": [frontend_origin]}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "OPTIONS"],
    )

    bootstrap_admin = os.getenv("BOOTSTRAP_DEFAULT_ADMIN", "true").lower() == "true"
    if bootstrap_admin:
        ensure_default_admin()

    app.register_blueprint(auth_bp)
    app.register_blueprint(layer_bp)
    app.register_blueprint(analytics_bp)
    #app.register_blueprint(report_bp)#

    app.register_blueprint(admin_data_bp)
    app.register_blueprint(admin_output_bp)
    app.register_blueprint(admin_process_bp)
    app.register_blueprint(admin_user_bp)

    return app