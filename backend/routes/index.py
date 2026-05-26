from flask import Blueprint, jsonify

index_bp = Blueprint("index", __name__)


@index_bp.route("/")
def home():
    return jsonify({
        "message": "GamanaLK Smart Bus Tracker API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "driver": "/api/driver/*",
            "passenger": "/api/passenger/*",
            "admin": "/api/admin/*"
        }
    })
