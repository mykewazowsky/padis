import os
from flask import Flask, jsonify
from flask_cors import CORS

from app.routes.admin import admin_bp

def create_app():
    app = Flask(__name__)

    frontend_origin = os.getenv("CORS_ORIGIN", "*")
    CORS(app, resources={r"/*": {"origins": [frontend_origin]}})

    app.register_blueprint(admin_bp)

    @app.route("/")
    def home():
        return jsonify({"message": "PADIS Backend Running."})

    return app