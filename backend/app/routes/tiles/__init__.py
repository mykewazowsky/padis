from flask import Blueprint

tiles_bp = Blueprint("tiles", __name__, url_prefix="/api/tiles")

from . import tile_routes  # noqa: F401, E402

__all__ = ["tiles_bp"]
