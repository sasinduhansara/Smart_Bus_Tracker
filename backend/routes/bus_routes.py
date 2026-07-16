from datetime import datetime, timezone

from bson.objectid import ObjectId
from flask import Blueprint, g, jsonify, request

from config import buses_collection, drivers_collection
from utils.auth_utils import jwt_required, roles_required


bus_bp = Blueprint("bus_bp", __name__)


def parse_coordinate(value, minimum, maximum):
    if isinstance(value, bool):
        return None

    try:
        parsed_value = float(value)
    except (TypeError, ValueError):
        return None

    if parsed_value < minimum or parsed_value > maximum:
        return None

    return parsed_value


def parse_optional_number(
    value,
    minimum,
    maximum,
):
    if value is None:
        return None

    return parse_coordinate(
        value,
        minimum,
        maximum,
    )


@bus_bp.route(
    "/api/location",
    methods=["POST"],
)
@jwt_required
@roles_required("driver")
def update_location():
    from app import socketio

    data = request.get_json(silent=True) or {}

    latitude = parse_coordinate(
        data.get("lat"),
        -90,
        90,
    )

    longitude = parse_coordinate(
        data.get("lng"),
        -180,
        180,
    )

    if latitude is None or longitude is None:
        return jsonify({
            "error": (
                "Valid latitude and longitude are required"
            ),
        }), 400

    speed = parse_optional_number(
        data.get("speed"),
        0,
        200,
    )

    heading = parse_optional_number(
        data.get("heading"),
        0,
        360,
    )

    driver_id = str(
        getattr(g, "auth", {}).get("sub", ""),
    )

    if not ObjectId.is_valid(driver_id):
        return jsonify({
            "error": "Invalid authenticated driver",
        }), 401

    driver = drivers_collection.find_one({
        "_id": ObjectId(driver_id),
    })

    if not driver:
        return jsonify({
            "error": "Driver account not found",
        }), 404

    verification_status = str(
        driver.get(
            "verificationStatus",
            "pending",
        ),
    ).strip().lower()

    if verification_status not in {
        "approved",
        "verified",
    }:
        return jsonify({
            "error": (
                "Only approved drivers can share GPS location"
            ),
            "verificationStatus": verification_status,
        }), 403

    vehicle_registration_number = str(
        driver.get(
            "vehicleRegistrationNumber",
            "",
        ),
    ).strip()

    route_number = str(
        driver.get(
            "busRouteNumber",
            "",
        ),
    ).strip()

    if not vehicle_registration_number:
        return jsonify({
            "error": (
                "A vehicle registration number is required "
                "before GPS tracking can start"
            ),
        }), 400

    bus_id = vehicle_registration_number
    updated_at = datetime.now(timezone.utc)

    location_payload = {
        "bus_id": bus_id,
        "vehicleRegistrationNumber": (
            vehicle_registration_number
        ),
        "routeNumber": route_number,
        "lat": latitude,
        "lng": longitude,
        "updatedAt": updated_at,
    }

    if speed is not None:
        location_payload["speed"] = speed

    if heading is not None:
        location_payload["heading"] = heading

    client_timestamp = data.get("timestamp")

    if client_timestamp:
        location_payload["clientTimestamp"] = str(
            client_timestamp,
        )

    buses_collection.update_one(
        {
            "bus_id": bus_id,
        },
        {
            "$set": {
                **location_payload,
                "driver_id": driver_id,
            },
            "$setOnInsert": {
                "createdAt": updated_at,
            },
        },
        upsert=True,
    )

    socket_payload = {
        **location_payload,
        "updatedAt": updated_at.isoformat(),
    }

    socketio.emit(
        "bus_location_update",
        socket_payload,
    )

    return jsonify({
        "status": "success",
        "bus": socket_payload,
    })


@bus_bp.route(
    "/api/buses",
    methods=["GET"],
)
def get_buses():
    """
    Public endpoint used by the passenger application.

    Only safe bus tracking information is returned.
    """

    buses = buses_collection.find(
        {
            "lat": {
                "$ne": None,
            },
            "lng": {
                "$ne": None,
            },
        },
        {
            "_id": 0,
            "bus_id": 1,
            "vehicleRegistrationNumber": 1,
            "routeNumber": 1,
            "lat": 1,
            "lng": 1,
            "speed": 1,
            "heading": 1,
            "updatedAt": 1,
        },
    )

    result = []

    for bus in buses:
        updated_at = bus.get("updatedAt")

        if isinstance(updated_at, datetime):
            bus["updatedAt"] = (
                updated_at.isoformat()
            )

        result.append(bus)

    return jsonify(result)