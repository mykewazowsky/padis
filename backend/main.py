import os
from flask import Flask, jsonify
from flask_cors import CORS

from backend.app.routes.admin import admin_bp
from backend.app.routes.layer_routes import layer_bp

def create_app():
    app = Flask(__name__)

    frontend_origin = os.getenv("CORS_ORIGIN", "*")
    CORS(app, resources={r"/*": {"origins": [frontend_origin]}})

    # ===============================
    # REGISTER BLUEPRINT
    # ===============================
    app.register_blueprint(admin_bp)
    app.register_blueprint(layer_bp, url_prefix="/api")  # ✅ INI PENTING

    @app.route("/")
    def home():
        return jsonify({"message": "PADIS Backend Running."})

    return app
