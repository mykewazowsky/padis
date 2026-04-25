from flask import Blueprint

admin_bp = Blueprint("admin_bp", __name__)

# Import semua route modules setelah blueprint dibuat.
# data_routes menggunakan admin_bp langsung (dekorasi @admin_bp.route).
# Modul lain mendefinisikan blueprint-nya sendiri — didaftarkan di app/__init__.py.
from . import data_routes     # noqa: E402,F401
from . import output_routes   # noqa: E402,F401
from . import process_routes  # noqa: E402,F401
from . import user_routes     # noqa: E402,F401
from . import geoserver_routes  # noqa: E402,F401
