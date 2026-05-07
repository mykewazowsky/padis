from .analytics_routes import analytics_bp
from .auth import auth_bp
from .admin import admin_bp

__all__ = [
    "analytics_bp",
    "auth_bp",
    "admin_bp",
]
