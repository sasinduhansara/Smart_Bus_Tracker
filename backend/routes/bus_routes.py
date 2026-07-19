import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from bson.objectid import ObjectId
from flask import Blueprint, current_app, g, jsonify, request
from pymongo.errors import DuplicateKeyError

from config import buses_collection, drivers_collection, trips_collection
from extensions import socketio
from services.driver_trip_service import (
    APPROVED_DRIVER_STATUSES,
    build_safe_bus_payload,
    driver_reference_query,
)
from services.geospatial_service import (
    ROUTE_DEVIATION_CONFIRMATION_COUNT,
    match_location_to_route,
)
from services.route_service import get_route_details
from utils.auth_utils import jwt_required, roles_required


bus_bp = Blueprint("bus_bp", __name__)

MAX_LOCATION_AGE_SECONDS = 120
MAX_LOCATION_FUTURE_SECONDS = 30
MAX_LOCATION_ACCURACY_METERS = 500
try:
    LEGACY_BUS_RECENCY_SECONDS = max(
        int(os.getenv("BUS_LOCATION_TTL_SECONDS", "120")),
        30,
    )
except ValueError:
    LEGACY_BUS_RECENCY_SECONDS = 120
MAX_REASONABLE_SPEED_KMH = 200
MOVEMENT_TOLERANCE_KM = 0.25
SRI_LANKA_LATITUDE_RANGE = (5.5, 10.2)
SRI_LANKA_LONGITUDE_RANGE = (79.0, 82.5)


def parse_number(value: Any, minimum: float, maximum: float):
    if isinstance(value, bool):
        return None

    try:
        parsed_value = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(parsed_value):
        return None

    if not minimum <= parsed_value <= maximum:
        return None

    return parsed_value


def parse_optional_number(value: Any, minimum: float, maximum: float):
    if value is None:
        return None

    return parse_number(value, minimum, maximum)


def parse_iso_timestamp(value: Any):
    if not isinstance(value, str) or not value.strip():
        return None

    normalized_value = value.strip().replace("Z", "+00:00")

    try:
        parsed_value = datetime.fromisoformat(normalized_value)
    except ValueError:
        return None

    if parsed_value.tzinfo is None:
        return None

    return parsed_value.astimezone(timezone.utc)


def normalize_stored_timestamp(value: Any):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    return parse_iso_timestamp(value)


def distance_km(
    first_latitude: float,
    first_longitude: float,
    second_latitude: float,
    second_longitude: float,
) -> float:
    earth_radius_km = 6371
    latitude_delta = math.radians(second_latitude - first_latitude)
    longitude_delta = math.radians(second_longitude - first_longitude)
    first_latitude_radians = math.radians(first_latitude)
    second_latitude_radians = math.radians(second_latitude)
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(first_latitude_radians)
        * math.cos(second_latitude_radians)
        * math.sin(longitude_delta / 2) ** 2
    )
    value = min(max(value, 0), 1)

    return earth_radius_km * 2 * math.atan2(
        math.sqrt(value),
        math.sqrt(1 - value),
    )


def emit_bus_update(payload: dict[str, Any]) -> None:
    try:
        socketio.emit("bus_location_update", payload)
    except Exception:
        current_app.logger.exception("Could not emit bus location update")


@bus_bp.route("/api/location", methods=["POST"])
@jwt_required
@roles_required("driver")
def update_location():
    data = request.get_json(silent=True) or {}

    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    latitude = parse_number(data.get("lat"), -90, 90)
    longitude = parse_number(data.get("lng"), -180, 180)

    if latitude is None or longitude is None:
        return jsonify({
            "error": "Valid latitude and longitude are required",
        }), 400

    if not (
        SRI_LANKA_LATITUDE_RANGE[0]
        <= latitude
        <= SRI_LANKA_LATITUDE_RANGE[1]
        and SRI_LANKA_LONGITUDE_RANGE[0]
        <= longitude
        <= SRI_LANKA_LONGITUDE_RANGE[1]
    ):
        return jsonify({
            "error": "The GPS coordinate is outside the supported service area",
            "code": "OUTSIDE_SERVICE_AREA",
        }), 422

    speed = parse_optional_number(data.get("speed"), 0, 200)
    if data.get("speed") is not None and speed is None:
        return jsonify({"error": "speed must be between 0 and 200 km/h"}), 400

    heading = parse_optional_number(data.get("heading"), 0, 359.999999)
    if data.get("heading") is not None and heading is None:
        return jsonify({"error": "heading must be at least 0 and below 360"}), 400

    accuracy = parse_number(
        data.get("accuracy"),
        0,
        MAX_LOCATION_ACCURACY_METERS,
    )
    if accuracy is None:
        return jsonify({
            "error": (
                "accuracy is required and must be between 0 and "
                f"{MAX_LOCATION_ACCURACY_METERS} metres"
            ),
        }), 400

    client_timestamp = parse_iso_timestamp(data.get("timestamp"))
    if client_timestamp is None:
        return jsonify({
            "error": "timestamp is required and must be an ISO-8601 value with a timezone",
        }), 400

    received_at = datetime.now(timezone.utc)
    age_seconds = (received_at - client_timestamp).total_seconds()
    if age_seconds > MAX_LOCATION_AGE_SECONDS:
        return jsonify({
            "error": "Location update is stale",
            "code": "STALE_LOCATION",
        }), 409
    if age_seconds < -MAX_LOCATION_FUTURE_SECONDS:
        return jsonify({
            "error": "Location timestamp is too far in the future",
            "code": "FUTURE_LOCATION",
        }), 409

    driver_id = str(getattr(g, "auth", {}).get("sub", ""))
    if not ObjectId.is_valid(driver_id):
        return jsonify({"error": "Invalid authenticated driver"}), 401

    driver = drivers_collection.find_one({"_id": ObjectId(driver_id)})
    if not driver:
        return jsonify({"error": "Driver account not found"}), 404

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()
    if verification_status not in APPROVED_DRIVER_STATUSES:
        return jsonify({
            "error": "Only approved drivers can share GPS location",
            "code": "DRIVER_NOT_APPROVED",
            "verificationStatus": verification_status,
        }), 403

    bus_id = str(driver.get("vehicleRegistrationNumber") or "").strip()
    route_number = str(driver.get("busRouteNumber") or "").strip()
    if not bus_id:
        return jsonify({
            "error": "A vehicle assignment is required before GPS tracking can start",
            "code": "VEHICLE_ASSIGNMENT_REQUIRED",
        }), 409
    if not route_number:
        return jsonify({
            "error": "A route assignment is required before GPS tracking can start",
            "code": "ROUTE_ASSIGNMENT_REQUIRED",
        }), 409

    active_trip = trips_collection.find_one({
        **driver_reference_query(driver_id),
        "status": "active",
    })
    if not active_trip:
        paused_trip = trips_collection.find_one({
            **driver_reference_query(driver_id),
            "status": "paused",
        })
        return jsonify({
            "error": (
                "The active trip is paused"
                if paused_trip
                else "An active trip is required before sharing GPS location"
            ),
            "code": "TRIP_PAUSED" if paused_trip else "NO_ACTIVE_TRIP",
            "tripStatus": "paused" if paused_trip else None,
        }), 409

    trip_id = str(active_trip["_id"])
    trip_bus_id = str(
        active_trip.get("busId")
        or active_trip.get("vehicleRegistrationNumber")
        or ""
    )
    trip_route_number = str(active_trip.get("routeNumber") or "")
    if trip_bus_id != bus_id or trip_route_number != route_number:
        return jsonify({
            "error": "The driver's assignment changed during the active trip",
            "code": "ASSIGNMENT_CHANGED",
        }), 409

    route = get_route_details(route_number)

    existing_bus = buses_collection.find_one(
        {"bus_id": bus_id},
        {"clientTimestamp": 1, "statusUpdatedAt": 1},
    )
    if not existing_bus:
        return jsonify({
            "error": (
                "The bus tracking record is unavailable. "
                "End the unfinished trip and start a new trip."
            ),
            "code": "BUS_TRACKING_MISSING",
        }), 409

    previous_client_timestamp = normalize_stored_timestamp(
        existing_bus.get("clientTimestamp")
    )
    if previous_client_timestamp and client_timestamp <= previous_client_timestamp:
        return jsonify({
            "error": "Location update is older than or duplicates the latest update",
            "code": "DUPLICATE_LOCATION",
        }), 409

    previous_trip_location = active_trip.get("lastLocation")
    distance_increment_km = 0.0
    if isinstance(previous_trip_location, dict):
        previous_latitude = parse_number(
            previous_trip_location.get("lat"),
            -90,
            90,
        )
        previous_longitude = parse_number(
            previous_trip_location.get("lng"),
            -180,
            180,
        )
        previous_location_timestamp = normalize_stored_timestamp(
            previous_trip_location.get("timestamp")
        )
        resumed_at = normalize_stored_timestamp(active_trip.get("resumedAt"))

        if (
            previous_latitude is not None
            and previous_longitude is not None
            and previous_location_timestamp is not None
            and (
                resumed_at is None
                or previous_location_timestamp >= resumed_at
            )
        ):
            elapsed_seconds = max(
                (client_timestamp - previous_location_timestamp).total_seconds(),
                0,
            )
            candidate_distance_km = distance_km(
                previous_latitude,
                previous_longitude,
                latitude,
                longitude,
            )
            previous_accuracy = parse_number(
                previous_trip_location.get("accuracy"),
                0,
                MAX_LOCATION_ACCURACY_METERS,
            ) or 0
            accuracy_tolerance_km = (accuracy + previous_accuracy) / 1000
            maximum_distance_km = (
                elapsed_seconds * MAX_REASONABLE_SPEED_KMH / 3600
                + accuracy_tolerance_km
                + MOVEMENT_TOLERANCE_KM
            )

            if candidate_distance_km > maximum_distance_km:
                return jsonify({
                    "error": "Location movement is not physically plausible",
                    "code": "IMPLAUSIBLE_MOVEMENT",
                }), 409

            distance_increment_km = round(candidate_distance_km, 6)

    route_match = match_location_to_route(
        latitude,
        longitude,
        route.get("polyline") if route else [],
    )
    previous_deviation_count = int(
        active_trip.get("routeDeviationConsecutiveCount", 0) or 0,
    )
    accurate_deviation_candidate = (
        accuracy <= 100 and route_match["isRouteDeviationCandidate"]
    )
    route_deviation_count = (
        previous_deviation_count + 1 if accurate_deviation_candidate else 0
    )
    is_route_deviation = (
        route_deviation_count >= ROUTE_DEVIATION_CONFIRMATION_COUNT
    )
    public_route_match = {
        key: value
        for key, value in route_match.items()
        if key != "isRouteDeviationCandidate"
    }
    public_route_match["isRouteDeviation"] = is_route_deviation

    location = {
        "lat": latitude,
        "lng": longitude,
        "accuracy": accuracy,
        "timestamp": client_timestamp,
        **public_route_match,
    }
    if speed is not None:
        location["speed"] = speed
    if heading is not None:
        location["heading"] = heading

    trip_result = trips_collection.update_one(
        {
            "_id": active_trip["_id"],
            "status": "active",
            "$or": [
                {"lastLocation.timestamp": {"$lt": client_timestamp}},
                {"lastLocation.timestamp": {"$exists": False}},
            ],
        },
        {
            "$set": {
                "lastLocation": location,
                "lastLocationAt": received_at,
                "updatedAt": received_at,
                "routeDeviationConsecutiveCount": route_deviation_count,
                "isRouteDeviation": is_route_deviation,
            },
            "$inc": {
                "distanceKm": distance_increment_km,
                "locationUpdateCount": 1,
            },
        },
    )
    if trip_result.modified_count != 1:
        return jsonify({
            "error": "Trip status changed before the location could be saved",
            "code": "TRIP_STATE_CHANGED",
        }), 409

    bus_update = {
        "bus_id": bus_id,
        "trackingKey": bus_id,
        "vehicleRegistrationNumber": bus_id,
        "routeNumber": route_number,
        "lat": latitude,
        "lng": longitude,
        "accuracy": accuracy,
        "clientTimestamp": client_timestamp,
        "updatedAt": received_at,
        "driver_id": driver_id,
        "operationalStatus": "active",
        "isActive": True,
        "activeTripId": trip_id,
        "tripId": trip_id,
        "statusUpdatedAt": received_at,
        "lastSeenAt": received_at,
        "direction": active_trip.get("direction"),
        **public_route_match,
    }
    if speed is not None:
        bus_update["speed"] = speed
    if heading is not None:
        bus_update["heading"] = heading

    bus_identity = (
        {"_id": existing_bus["_id"]}
        if existing_bus.get("_id")
        else {"bus_id": bus_id}
    )
    bus_filter = {
        **bus_identity,
        "$and": [
            {
                "$or": [
                    {"clientTimestamp": {"$lt": client_timestamp}},
                    {"clientTimestamp": {"$exists": False}},
                ],
            },
            {
                "$or": [
                    {"statusUpdatedAt": {"$lte": received_at}},
                    {"statusUpdatedAt": {"$exists": False}},
                ],
            },
        ],
    }

    def rollback_trip_location():
        rollback = {"$set": {
            "updatedAt": active_trip.get("updatedAt"),
            "routeDeviationConsecutiveCount": previous_deviation_count,
            "isRouteDeviation": bool(active_trip.get("isRouteDeviation")),
        }}
        rollback["$inc"] = {
            "distanceKm": -distance_increment_km,
            "locationUpdateCount": -1,
        }
        if previous_trip_location is None:
            rollback["$unset"] = {"lastLocation": "", "lastLocationAt": ""}
        else:
            rollback["$set"].update({
                "lastLocation": previous_trip_location,
                "lastLocationAt": active_trip.get("lastLocationAt"),
            })
        trips_collection.update_one(
            {
                "_id": active_trip["_id"],
                "status": "active",
                "lastLocation.timestamp": client_timestamp,
            },
            rollback,
        )

    try:
        bus_result = buses_collection.update_one(
            bus_filter,
            {
                "$set": bus_update,
                "$setOnInsert": {"createdAt": received_at},
            },
            upsert=False,
        )
    except DuplicateKeyError:
        rollback_trip_location()
        return jsonify({
            "error": "A newer bus status or location update already exists",
            "code": "STATUS_SUPERSEDED",
        }), 409
    except Exception:
        rollback_trip_location()
        raise

    if (
        getattr(bus_result, "matched_count", 0) != 1
        and getattr(bus_result, "upserted_id", None) is None
    ):
        rollback_trip_location()
        return jsonify({
            "error": "A newer bus status or location update already exists",
            "code": "STATUS_SUPERSEDED",
        }), 409

    socket_payload = build_safe_bus_payload(
        bus_id=bus_id,
        route_number=route_number,
        operational_status="active",
        trip_id=trip_id,
        status_updated_at=received_at,
        location={
            "lat": latitude,
            "lng": longitude,
            **public_route_match,
            "direction": active_trip.get("direction"),
            "speed": speed,
            "heading": heading,
            "updatedAt": received_at.isoformat(),
        },
    )
    socket_payload["accuracy"] = accuracy
    emit_bus_update(socket_payload)

    return jsonify({
        "status": "success",
        "bus": socket_payload,
        "tripId": trip_id,
    })


@bus_bp.route("/api/buses", methods=["GET"])
def get_buses():
    """Return only public, operationally relevant bus tracking fields."""

    response_time = datetime.now(timezone.utc)
    legacy_cutoff = response_time - timedelta(
        seconds=LEGACY_BUS_RECENCY_SECONDS
    )
    buses = buses_collection.find(
        {
            "lat": {"$ne": None},
            "lng": {"$ne": None},
            "$or": [
                {"operationalStatus": {"$in": ["active", "paused"]}},
                {
                    "operationalStatus": {"$exists": False},
                    "updatedAt": {"$gte": legacy_cutoff},
                },
                {
                    "operationalStatus": None,
                    "updatedAt": {"$gte": legacy_cutoff},
                },
            ],
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
            "accuracy": 1,
            "rawLatitude": 1,
            "rawLongitude": 1,
            "displayLatitude": 1,
            "displayLongitude": 1,
            "distanceFromRouteMeters": 1,
            "isRouteDeviation": 1,
            "direction": 1,
            "updatedAt": 1,
            "lastSeenAt": 1,
            "operationalStatus": 1,
            "isActive": 1,
            "activeTripId": 1,
            "tripId": 1,
            "statusUpdatedAt": 1,
        },
    )

    result = []
    for bus in buses:
        bus_id = str(bus.get("bus_id") or "").strip()
        latitude = parse_number(bus.get("lat"), -90, 90)
        longitude = parse_number(bus.get("lng"), -180, 180)
        if not bus_id or latitude is None or longitude is None:
            continue

        bus["bus_id"] = bus_id
        bus["lat"] = latitude
        bus["lng"] = longitude

        if str(bus.get("operationalStatus") or "").lower() == "active":
            updated_at = normalize_stored_timestamp(bus.get("updatedAt"))
            age_seconds = (
                (response_time - updated_at).total_seconds()
                if updated_at is not None
                else float("inf")
            )
            if (
                age_seconds > LEGACY_BUS_RECENCY_SECONDS
                or age_seconds < -MAX_LOCATION_FUTURE_SECONDS
            ):
                bus["operationalStatus"] = "offline"
                bus["isActive"] = False

        for field in ("updatedAt", "statusUpdatedAt"):
            if isinstance(bus.get(field), datetime):
                value = bus[field]
                if value.tzinfo is None:
                    value = value.replace(tzinfo=timezone.utc)
                bus[field] = value.isoformat()
        result.append(bus)

    return jsonify(result)
