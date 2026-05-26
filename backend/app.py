"""
   GamanaLK - Smart Bus Tracker Backend
   Python + Flask + MongoDB
"""

import os
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_pymongo import PyMongo

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "gamanalk_secret")
CORS(app, supports_credentials=True, origins=["http://localhost:8081", "http://localhost:8082", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://192.168.8.102:8081"])

# MongoDB setup - use MONGO_URI directly from .env
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/bus_tracker")
app.config["MONGO_URI"] = MONGO_URI
print(f"📦 Connecting to MongoDB...")
mongo = PyMongo(app)
app.mongo = mongo

socketio = SocketIO(app, cors_allowed_origins="*")

from routes.index import index_bp
from routes.driver_routes import driver_bp
from routes.passenger_routes import passenger_bp
from routes.admin_routes import admin_bp

app.register_blueprint(index_bp)
app.register_blueprint(driver_bp)
app.register_blueprint(passenger_bp)
app.register_blueprint(admin_bp)

# Seed default admin on startup
with app.app_context():
    from models.admin import AdminModel
    admin_model = AdminModel(mongo)
    admin_model.seed_default_admin()

from services.socket_service import register_socket_events, active_buses

register_socket_events(socketio)


@app.route("/api/active-buses")
def get_active_buses():
    return jsonify(list(active_buses.values()))


@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "ok",
        "message": "GamanaLK API is running",
        "timestamp": __import__("datetime").datetime.now().isoformat()
    })


if __name__ == "__main__":
    print("🚀 GamanaLK Server Starting...")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)

