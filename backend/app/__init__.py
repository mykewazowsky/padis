from dotenv import load_dotenv
import os

load_dotenv()

from flask import Flask
from flask_cors import CORS

# Public routes
from app.routes import analytics_bp, auth_bp, layer_bp

# Admin routes
from app.routes.admin.data_routes import admin_data_bp
from app.routes.admin.output_routes import admin_output_bp
from app.routes.admin.process_routes import admin_process_bp
from app.routes.admin.user_routes import admin_user_bp
from app.routes.admin.geoserver_routes import admin_geoserver_bp


def ensure_default_admin():
    """
    Bootstrap default admin jika belum ada.
    Tetap pakai auth_store Anda sekarang.
    (Nanti bisa di-refactor ke Supabase full kalau perlu)
    """
    from app.routes.auth.auth_store import find_user_by_email, create_user
    from app.routes.auth.auth_utils import hash_password

    admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@padis.local")
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD")

    if not admin_password:
        print("[PADIS] DEFAULT_ADMIN_PASSWORD not set. Skip admin bootstrap.")
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
    print(f"  email   : {admin_email}")
    print(f"  password: {admin_password}")
    print("=" * 60)


def ensure_default_user():
    """
    Bootstrap default user (optional, untuk demo/testing)
    """
    from app.routes.auth.auth_store import find_user_by_email, create_user
    from app.routes.auth.auth_utils import hash_password

    user_email = os.getenv("DEFAULT_USER_EMAIL", "user@padis.local")
    user_password = os.getenv("DEFAULT_USER_PASSWORD")

    if not user_password:
        print("[PADIS] DEFAULT_USER_PASSWORD not set. Skip user bootstrap.")
        return

    existing = find_user_by_email(user_email)
    if existing:
        return

    create_user(
        name="User PADIS",
        email=user_email,
        password_hash=hash_password(user_password),
        role="user",
        status="active",
    )

    print("=" * 60)
    print("[PADIS] Default user created")
    print(f"  email   : {user_email}")
    print(f"  password: {user_password}")
    print("=" * 60)


def create_app():
    app = Flask(__name__)

    # =========================
    # Config dasar
    # =========================
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "padis-secret-key")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "padis-jwt-secret")

    # =========================
    # CORS (Frontend Vercel)
    # =========================
    allowed_origins = [
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
        if origin.strip()
    ]

    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins or "*"}},
        supports_credentials=True,
    )

    # =========================
    # Register Blueprints
    # =========================

    # Public
    app.register_blueprint(auth_bp)
    app.register_blueprint(layer_bp)
    app.register_blueprint(analytics_bp)

    # Admin
    app.register_blueprint(admin_data_bp)
    app.register_blueprint(admin_output_bp)
    app.register_blueprint(admin_process_bp)
    app.register_blueprint(admin_user_bp)
    app.register_blueprint(admin_geoserver_bp)  # ← NEW (GeoServer)

    # =========================
    # Bootstrap default user/admin
    # =========================
    if os.getenv("BOOTSTRAP_DEFAULT_ADMIN", "false").lower() == "true":
        ensure_default_admin()

    if os.getenv("BOOTSTRAP_DEFAULT_USER", "false").lower() == "true":
        ensure_default_user()

    # =========================
    # Health check (Railway penting)
    # =========================
    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app