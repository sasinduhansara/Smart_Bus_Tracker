import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from pymongo.errors import PyMongoError
from werkzeug.exceptions import HTTPException

from config import client
from routes.admin_routes import admin_bp
from routes.auth_routes import auth_bp
from routes.bus_routes import bus_bp
from routes.document_routes import document_bp
from routes.eta_routes import eta_bp
from routes.route_routes import route_bp


def get_allowed_origins():
    configured_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:8081",
    ).strip()

    if configured_origins == "*":
        return "*"

    return [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]


app = Flask(__name__)

app.config["PROPAGATE_EXCEPTIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

debug_mode = os.getenv(
    "FLASK_DEBUG",
    "false",
).strip().lower() == "true"

app.config["DEBUG"] = debug_mode

allowed_origins = get_allowed_origins()

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins,
        }
    },
)

socketio = SocketIO(
    app,
    cors_allowed_origins=allowed_origins,
    async_mode="threading",
)


app.register_blueprint(bus_bp)
app.register_blueprint(eta_bp)
app.register_blueprint(route_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(document_bp)


@app.errorhandler(PyMongoError)
def handle_mongo_error(error):
    app.logger.exception(
        "MongoDB operation failed",
        exc_info=error,
    )

    response = {
        "error": "Database connection failed"
    }

    if app.debug:
        response["details"] = str(error)

    return jsonify(response), 503


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    if isinstance(error, HTTPException):
        return jsonify({
            "error": error.description
        }), error.code

    app.logger.exception(
        "Unexpected server error",
        exc_info=error,
    )

    response = {
        "error": "Internal server error"
    }

    if app.debug:
        response["details"] = str(error)

    return jsonify(response), 500


@app.route("/")
def home():
    return jsonify({
        "message": "Smart Bus Tracking Backend is running!"
    })


@app.route("/api/db-check")
def db_check():
    try:
        client.admin.command("ping")

        return jsonify({
            "status": "MongoDB connected successfully!"
        })
    except Exception as error:
        app.logger.exception(
            "MongoDB health check failed",
            exc_info=error,
        )

        response = {
            "status": "MongoDB connection failed"
        }

        if app.debug:
            response["error"] = str(error)

        return jsonify(response), 503


@socketio.on("connect")
def handle_connect():
    app.logger.info("Socket client connected")


@socketio.on("disconnect")
def handle_disconnect():
    app.logger.info("Socket client disconnected")


if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=debug_mode,
        allow_unsafe_werkzeug=debug_mode,
    )
