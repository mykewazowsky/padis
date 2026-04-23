from flask import Blueprint

admin_bp = Blueprint("admin_bp", __name__)

# Import semua route setelah blueprint dibuat
from . import data_routes  # noqa: E402,F401
from . import output_routes  # noqa: E402,F401
from . import process_routes  # noqa: E402,F401