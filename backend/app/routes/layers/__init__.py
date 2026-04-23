from flask import Blueprint

layers_bp = Blueprint("layers_bp", __name__, url_prefix="/api/layers")

from .regions import *
from .production import *
from .hazard import *
from .loss import *
from .aal import *
from .values import *   # geometry-free value endpoints for tile-based rendering