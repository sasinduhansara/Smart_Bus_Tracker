import os

from flask import Flask, jsonify
from flask_cors import CORS
from pymongo.errors import PyMongoError
from werkzeug.exceptions import HTTPException

from config import client
from extensions import socketio
from routes.admin_routes import admin_bp
from routes.auth_routes import auth_bp
from routes.bus_routes import bus_bp
from routes.document_routes import document_bp
from routes.eta_routes import eta_bp
from routes.route_routes import route_bp
from routes.trip_routes import trip_bp
from routes.driver_routes import driver_bp
from routes.admin_bus_request_routes import admin_bus_request_bp
from routes.map_routes import map_bp
from routes.location_routes import location_bp


def get_allowed_origins():
    configured_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:8081,http://localhost:8082",
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

from middleware.rate_limit import apply_rate_limits

allowed_origins = get_allowed_origins()

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins,
        }
    },
)

apply_rate_limits(app)

socketio.init_app(
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
app.register_blueprint(trip_bp)
app.register_blueprint(driver_bp)
app.register_blueprint(admin_bus_request_bp)
app.register_blueprint(map_bp)
app.register_blueprint(location_bp)


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


# ---------------------------------------------------------------------------
# Room-scoped subscriptions (Phase 3)
# ---------------------------------------------------------------------------

from flask_socketio import join_room, leave_room  # noqa: E402


@socketio.on("subscribe_route")
def handle_subscribe_route(data):
    """Passenger/web client subscribes to live updates for a route.

    Payload: {"routeNumber": "138"}
    """
    route_number = (data or {}).get("routeNumber", "").strip()
    if not route_number:
        return
    room = f"route:{route_number}"
    join_room(room)
    app.logger.debug("Client joined room %s", room)


@socketio.on("unsubscribe_route")
def handle_unsubscribe_route(data):
    route_number = (data or {}).get("routeNumber", "").strip()
    if not route_number:
        return
    leave_room(f"route:{route_number}")


@socketio.on("subscribe_bus")
def handle_subscribe_bus(data):
    """Client subscribes to live updates for a specific bus.

    Payload: {"busId": "NB-1234"}
    """
    bus_id = (data or {}).get("busId", "").strip()
    if not bus_id:
        return
    join_room(f"bus:{bus_id}")


@socketio.on("unsubscribe_bus")
def handle_unsubscribe_bus(data):
    bus_id = (data or {}).get("busId", "").strip()
    if not bus_id:
        return
    leave_room(f"bus:{bus_id}")


if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=debug_mode,
        allow_unsafe_werkzeug=debug_mode,
    )
