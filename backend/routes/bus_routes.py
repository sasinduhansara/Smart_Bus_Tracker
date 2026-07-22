import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from bson.objectid import ObjectId
from flask import Blueprint, current_app, g, jsonify, request
from pymongo.errors import DuplicateKeyError

from config import (
    buses_collection,
    drivers_collection,
    live_bus_states_collection,
    trips_collection,
)
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



@bus_bp.route("/api/buses", methods=["GET"])
def get_buses():
    """
    Return public bus tracking data.

    The buses collection contains master and legacy tracking fields.
    The live_bus_states collection contains the latest authoritative
    GPS location and operational status for active trips.
    """

    response_time = datetime.now(timezone.utc)
    legacy_cutoff = response_time - timedelta(
        seconds=LEGACY_BUS_RECENCY_SECONDS,
    )

    # Load recent active/paused live states.
    raw_live_states = list(
        live_bus_states_collection.find(
            {
                "operationalStatus": {
                    "$in": ["active", "paused"],
                },
            },
            {
                "_id": 0,
                "busId": 1,
                "routeNumber": 1,
                "tripId": 1,
                "location": 1,
                "speed": 1,
                "heading": 1,
                "accuracy": 1,
                "distanceFromRouteMeters": 1,
                "isRouteDeviation": 1,
                "operationalStatus": 1,
                "recordedAt": 1,
                "updatedAt": 1,
            },
        )
    )

    live_states_by_bus_id: dict[str, dict[str, Any]] = {}

    for live_state in raw_live_states:
        bus_id = str(
            live_state.get("busId") or "",
        ).strip()

        location = live_state.get("location") or {}
        coordinates = location.get("coordinates") or []

        if not bus_id or len(coordinates) != 2:
            continue

        longitude = parse_number(
            coordinates[0],
            -180,
            180,
        )
        latitude = parse_number(
            coordinates[1],
            -90,
            90,
        )

        if latitude is None or longitude is None:
            continue

        updated_at = normalize_stored_timestamp(
            live_state.get("updatedAt")
            or live_state.get("recordedAt")
        )

        if updated_at is None:
            continue

        age_seconds = (
            response_time - updated_at
        ).total_seconds()

        if (
            age_seconds > LEGACY_BUS_RECENCY_SECONDS
            or age_seconds < -MAX_LOCATION_FUTURE_SECONDS
        ):
            continue

        live_states_by_bus_id[bus_id] = live_state

    live_bus_ids = list(
        live_states_by_bus_id.keys(),
    )

    legacy_bus_query = {
        "lat": {"$ne": None},
        "lng": {"$ne": None},
        "$or": [
            {
                "operationalStatus": {
                    "$in": ["active", "paused"],
                },
            },
            {
                "operationalStatus": {
                    "$exists": False,
                },
                "updatedAt": {
                    "$gte": legacy_cutoff,
                },
            },
            {
                "operationalStatus": None,
                "updatedAt": {
                    "$gte": legacy_cutoff,
                },
            },
        ],
    }

    if live_bus_ids:
        bus_query = {
            "$or": [
                legacy_bus_query,
                {
                    "bus_id": {
                        "$in": live_bus_ids,
                    },
                },
                {
                    "vehicleRegistrationNumber": {
                        "$in": live_bus_ids,
                    },
                },
            ],
        }
    else:
        bus_query = legacy_bus_query

    master_buses = list(
        buses_collection.find(
            bus_query,
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
    )

    def merge_live_state(
        bus: dict[str, Any],
        live_state: dict[str, Any],
        bus_id: str,
    ) -> dict[str, Any] | None:
        location = live_state.get("location") or {}
        coordinates = location.get("coordinates") or []

        if len(coordinates) != 2:
            return None

        longitude = parse_number(
            coordinates[0],
            -180,
            180,
        )
        latitude = parse_number(
            coordinates[1],
            -90,
            90,
        )

        if latitude is None or longitude is None:
            return None

        updated_at = normalize_stored_timestamp(
            live_state.get("updatedAt")
            or live_state.get("recordedAt")
        )

        if updated_at is None:
            return None

        operational_status = str(
            live_state.get("operationalStatus")
            or "active"
        ).strip().lower()

        if operational_status not in {
            "active",
            "paused",
        }:
            operational_status = "active"

        trip_id = str(
            live_state.get("tripId") or "",
        ).strip()

        merged_bus = {
            **bus,
            "bus_id": bus_id,
            "vehicleRegistrationNumber": (
                bus.get("vehicleRegistrationNumber")
                or bus_id
            ),
            "routeNumber": (
                live_state.get("routeNumber")
                or bus.get("routeNumber")
            ),
            "lat": latitude,
            "lng": longitude,
            "rawLatitude": latitude,
            "rawLongitude": longitude,
            "displayLatitude": latitude,
            "displayLongitude": longitude,
            "speed": live_state.get("speed", 0),
            "heading": live_state.get("heading", 0),
            "distanceFromRouteMeters": live_state.get(
                "distanceFromRouteMeters",
                0,
            ),
            "isRouteDeviation": bool(
                live_state.get(
                    "isRouteDeviation",
                    False,
                )
            ),
            "operationalStatus": operational_status,
            "isActive": operational_status == "active",
            "activeTripId": trip_id,
            "tripId": trip_id,
            "updatedAt": updated_at,
            "lastSeenAt": updated_at,
            "statusUpdatedAt": updated_at,
        }

        accuracy = parse_optional_number(
            live_state.get("accuracy"),
            0,
            MAX_LOCATION_ACCURACY_METERS,
        )

        if accuracy is not None:
            merged_bus["accuracy"] = accuracy

        return merged_bus

    result: list[dict[str, Any]] = []
    seen_bus_ids: set[str] = set()

    for bus in master_buses:
        bus_id = str(
            bus.get("bus_id")
            or bus.get("vehicleRegistrationNumber")
            or ""
        ).strip()

        if not bus_id:
            continue

        live_state = live_states_by_bus_id.get(
            bus_id,
        )

        if live_state:
            merged_bus = merge_live_state(
                bus,
                live_state,
                bus_id,
            )

            if merged_bus is None:
                continue

            bus = merged_bus
        else:
            latitude = parse_number(
                bus.get("lat"),
                -90,
                90,
            )
            longitude = parse_number(
                bus.get("lng"),
                -180,
                180,
            )

            if latitude is None or longitude is None:
                continue

            bus["bus_id"] = bus_id
            bus["lat"] = latitude
            bus["lng"] = longitude

            if (
                str(
                    bus.get("operationalStatus")
                    or ""
                ).lower()
                == "active"
            ):
                updated_at = normalize_stored_timestamp(
                    bus.get("updatedAt"),
                )

                age_seconds = (
                    (
                        response_time - updated_at
                    ).total_seconds()
                    if updated_at is not None
                    else float("inf")
                )

                if (
                    age_seconds
                    > LEGACY_BUS_RECENCY_SECONDS
                    or age_seconds
                    < -MAX_LOCATION_FUTURE_SECONDS
                ):
                    bus["operationalStatus"] = "offline"
                    bus["isActive"] = False

        seen_bus_ids.add(bus_id)

        for field in (
            "updatedAt",
            "lastSeenAt",
            "statusUpdatedAt",
        ):
            if isinstance(
                bus.get(field),
                datetime,
            ):
                value = bus[field]

                if value.tzinfo is None:
                    value = value.replace(
                        tzinfo=timezone.utc,
                    )

                bus[field] = value.isoformat()

        result.append(bus)

    # Include a live state even when its master bus document
    # has no previous tracking coordinates.
    for bus_id, live_state in live_states_by_bus_id.items():
        if bus_id in seen_bus_ids:
            continue

        merged_bus = merge_live_state(
            {},
            live_state,
            bus_id,
        )

        if merged_bus is None:
            continue

        for field in (
            "updatedAt",
            "lastSeenAt",
            "statusUpdatedAt",
        ):
            if isinstance(
                merged_bus.get(field),
                datetime,
            ):
                value = merged_bus[field]

                if value.tzinfo is None:
                    value = value.replace(
                        tzinfo=timezone.utc,
                    )

                merged_bus[field] = value.isoformat()

        result.append(merged_bus)

    return jsonify(result)