import math
from datetime import datetime, timezone
from typing import Any

from bson.objectid import ObjectId
from flask import Blueprint, current_app, g, jsonify, request
from pymongo.errors import DuplicateKeyError

from config import (
    buses_collection,
    drivers_collection,
    issue_reports_collection,
    trips_collection,
)
from extensions import socketio
from services.driver_trip_service import (
    APPROVED_DRIVER_STATUSES,
    OPEN_TRIP_STATUSES,
    build_safe_bus_payload,
    bus_operational_update,
    driver_reference_query,
    owned_trip_query,
    serialize_trip,
    utc_now,
)
from services.route_service import get_route_details
from utils.auth_utils import jwt_required, roles_required


trip_bp = Blueprint("trip_bp", __name__)

ISSUE_CATEGORIES = {
    "vehicle_breakdown",
    "route_obstruction",
    "traffic_delay",
    "accident",
    "passenger_emergency",
    "technical_issue",
    "gps_problem",
}
ISSUE_SEVERITIES = {"low", "medium", "high", "critical"}
MAX_ISSUE_MESSAGE_LENGTH = 1000


class BusStatusConflict(Exception):
    """Raised when a newer operational status already won the write race."""


def _authenticated_driver():
    driver_id = str(getattr(g, "auth", {}).get("sub", ""))

    if not ObjectId.is_valid(driver_id):
        return None, driver_id, (
            jsonify({"error": "Invalid authenticated driver"}),
            401,
        )

    driver = drivers_collection.find_one({"_id": ObjectId(driver_id)})

    if not driver:
        return None, driver_id, (
            jsonify({"error": "Driver account not found"}),
            404,
        )

    return driver, driver_id, None


def _approved_assignment(driver: dict[str, Any]):
    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    if verification_status not in APPROVED_DRIVER_STATUSES:
        return None, None, (
            jsonify({
                "error": "Driver account has not been approved",
                "verificationStatus": verification_status,
            }),
            403,
        )

    bus_id = str(driver.get("vehicleRegistrationNumber") or "").strip()
    route_number = str(driver.get("busRouteNumber") or "").strip()

    if not bus_id:
        return None, None, (
            jsonify({"error": "No vehicle is assigned to this driver"}),
            409,
        )

    if not route_number:
        return None, None, (
            jsonify({"error": "No route is assigned to this driver"}),
            409,
        )

    return bus_id, route_number, None


def _assignment_is_still_authorized(
    driver_id: str,
    bus_id: str,
    route_number: str,
) -> bool:
    current_driver = drivers_collection.find_one({
        "_id": ObjectId(driver_id),
    })
    if not current_driver:
        return False

    current_bus_id, current_route_number, assignment_error = (
        _approved_assignment(current_driver)
    )
    return (
        assignment_error is None
        and current_bus_id == bus_id
        and current_route_number == route_number
    )


def _find_open_trip(driver_id: str):
    return trips_collection.find_one(
        {
            **driver_reference_query(driver_id),
            "status": {"$in": list(OPEN_TRIP_STATUSES)},
        },
        sort=[("startedAt", -1), ("createdAt", -1)],
    )


def _find_open_bus_trip(bus_id: str):
    return trips_collection.find_one(
        {
            "status": {"$in": list(OPEN_TRIP_STATUSES)},
            "$or": [
                {"busActiveKey": bus_id},
                {"busId": bus_id},
                {"vehicleRegistrationNumber": bus_id},
            ],
        },
        sort=[("startedAt", -1), ("createdAt", -1)],
    )


def _emit_bus_update(payload: dict[str, Any]) -> None:
    try:
        socketio.emit("bus_location_update", payload)
    except Exception:
        # Persistence is authoritative; a temporarily failed live emission is
        # recovered by the passenger application's GET /api/buses refresh.
        current_app.logger.exception("Could not emit bus location update")


def _persist_bus_status(
    *,
    bus_id: str,
    route_number: str,
    driver_id: str,
    status: str,
    trip_id: str | None,
    now: datetime,
) -> dict[str, Any]:
    existing_bus = buses_collection.find_one(
        {"bus_id": bus_id},
        {"_id": 1},
    )
    bus_identity = (
        {"_id": existing_bus["_id"]}
        if isinstance(existing_bus, dict) and existing_bus.get("_id")
        else {"trackingKey": bus_id}
    )
    bus_filter = {
        **bus_identity,
        "$or": [
            {"statusUpdatedAt": {"$lte": now}},
            {"statusUpdatedAt": {"$exists": False}},
        ],
    }

    try:
        result = buses_collection.update_one(
            bus_filter,
            bus_operational_update(
                bus_id=bus_id,
                route_number=route_number,
                driver_id=driver_id,
                operational_status=status,
                trip_id=trip_id,
                now=now,
            ),
            upsert=not isinstance(existing_bus, dict),
        )
    except DuplicateKeyError as error:
        raise BusStatusConflict from error

    if (
        getattr(result, "matched_count", 0) != 1
        and getattr(result, "upserted_id", None) is None
    ):
        raise BusStatusConflict

    return build_safe_bus_payload(
        bus_id=bus_id,
        route_number=route_number,
        operational_status=status,
        trip_id=trip_id,
        status_updated_at=now,
    )


@trip_bp.route("/api/driver/trips/active", methods=["GET"])
@jwt_required
@roles_required("driver")
def get_active_trip():
    driver, driver_id, error_response = _authenticated_driver()
    if error_response:
        return error_response

    trip = _find_open_trip(driver_id)

    return jsonify({
        "status": "success",
        "trip": serialize_trip(trip) if trip else None,
    })


@trip_bp.route("/api/driver/trips", methods=["GET"])
@jwt_required
@roles_required("driver")
def get_trip_history():
    driver, driver_id, error_response = _authenticated_driver()
    if error_response:
        return error_response

    raw_limit = request.args.get("limit", "20")
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        limit = 0

    if not 1 <= limit <= 50:
        return jsonify({
            "error": "limit must be an integer between 1 and 50",
        }), 400

    trips = list(
        trips_collection.find(driver_reference_query(driver_id))
        .sort([("startedAt", -1), ("createdAt", -1)])
        .limit(limit)
    )

    return jsonify({
        "status": "success",
        "trips": [serialize_trip(trip) for trip in trips],
    })


@trip_bp.route("/api/driver/trips/start", methods=["POST"])
@jwt_required
@roles_required("driver")
def start_trip():
    driver, driver_id, error_response = _authenticated_driver()
    if error_response:
        return error_response

    bus_id, route_number, assignment_error = _approved_assignment(driver)
    if assignment_error:
        return assignment_error

    route = get_route_details(route_number)
    if route is None:
        return jsonify({
            "error": "The assigned route does not exist",
            "routeNumber": route_number,
        }), 409

    existing_trip = _find_open_trip(driver_id)
    if existing_trip:
        return jsonify({
            "error": "An active or paused trip already exists",
            "trip": serialize_trip(existing_trip),
        }), 409

    if _find_open_bus_trip(bus_id):
        return jsonify({
            "error": "The assigned bus already has an active or paused trip",
            "code": "BUS_TRIP_CONFLICT",
        }), 409

    now = utc_now()
    stops = route.get("stops") or []
    trip = {
        "driverId": driver_id,
        "activeKey": driver_id,
        "busActiveKey": bus_id,
        "busId": bus_id,
        "vehicleRegistrationNumber": bus_id,
        "routeNumber": route_number,
        "routeName": str(route.get("name") or ""),
        "origin": str(stops[0].get("name") if stops else ""),
        "destination": str(stops[-1].get("name") if stops else ""),
        "status": "active",
        "startedAt": now,
        "createdAt": now,
        "updatedAt": now,
        "durationSeconds": 0,
        "activeDurationSeconds": 0,
        "totalPausedSeconds": 0,
        "distanceKm": 0,
        "locationUpdateCount": 0,
    }

    try:
        result = trips_collection.insert_one(trip)
    except DuplicateKeyError:
        existing_trip = _find_open_trip(driver_id)
        if not existing_trip:
            return jsonify({
                "error": "The assigned bus already has an active or paused trip",
                "code": "BUS_TRIP_CONFLICT",
            }), 409
        return jsonify({
            "error": "An active or paused trip already exists",
            "trip": serialize_trip(existing_trip) if existing_trip else None,
        }), 409

    trip["_id"] = result.inserted_id
    trip_id = str(result.inserted_id)

    if not _assignment_is_still_authorized(
        driver_id,
        bus_id,
        route_number,
    ):
        trips_collection.delete_one({
            "_id": result.inserted_id,
            "status": "active",
        })
        return jsonify({
            "error": "Driver approval or assignment changed while starting the trip",
            "code": "DRIVER_AUTHORITY_CHANGED",
        }), 403

    try:
        bus_payload = _persist_bus_status(
            bus_id=bus_id,
            route_number=route_number,
            driver_id=driver_id,
            status="active",
            trip_id=trip_id,
            now=now,
        )
    except BusStatusConflict:
        trips_collection.delete_one({"_id": result.inserted_id})
        return jsonify({
            "error": "A newer operational status already exists for this bus",
            "code": "STATUS_SUPERSEDED",
        }), 409
    except Exception:
        # Compensate when the bus write fails so the unique activeKey does not
        # strand the driver in a trip that never became operational.
        trips_collection.delete_one({"_id": result.inserted_id})
        raise

    _emit_bus_update(bus_payload)

    return jsonify({
        "status": "started",
        "trip": serialize_trip(trip),
        "bus": bus_payload,
    }), 201


def _transition_trip(trip_id: str, action: str):
    driver, driver_id, error_response = _authenticated_driver()
    if error_response:
        return error_response

    query = owned_trip_query(driver_id, trip_id)
    if query is None:
        return jsonify({"error": "Invalid trip id"}), 400

    trip = trips_collection.find_one(query)
    if not trip:
        return jsonify({"error": "Trip not found"}), 404

    if action == "resume":
        assigned_bus_id, assigned_route_number, assignment_error = (
            _approved_assignment(driver)
        )
        if assignment_error:
            return assignment_error

        trip_bus_id = str(
            trip.get("busId")
            or trip.get("vehicleRegistrationNumber")
            or ""
        ).strip()
        trip_route_number = str(trip.get("routeNumber") or "").strip()
        if (
            assigned_bus_id != trip_bus_id
            or assigned_route_number != trip_route_number
        ):
            return jsonify({
                "error": (
                    "The current vehicle or route assignment no longer matches "
                    "this paused trip"
                ),
                "code": "ASSIGNMENT_CHANGED",
            }), 409

    transition = {
        "pause": ("active", "paused", "paused"),
        "resume": ("paused", "active", "resumed"),
        "complete": (OPEN_TRIP_STATUSES, "completed", "completed"),
    }[action]
    allowed_from, target_status, response_status = transition
    allowed_statuses = (
        set(allowed_from)
        if isinstance(allowed_from, tuple)
        else {allowed_from}
    )

    if trip.get("status") not in allowed_statuses:
        return jsonify({
            "error": (
                f"A {trip.get('status', 'unknown')} trip cannot be "
                f"{action}d"
            ),
            "trip": serialize_trip(trip),
        }), 409

    now = utc_now()
    updates: dict[str, Any] = {
        "status": target_status,
        "updatedAt": now,
    }
    unset_fields: dict[str, str] = {}

    if action == "pause":
        started_at = trip.get("startedAt") or trip.get("createdAt")
        duration_seconds = 0
        if isinstance(started_at, datetime):
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            duration_seconds = max(int((now - started_at).total_seconds()), 0)

        total_paused_seconds = int(trip.get("totalPausedSeconds", 0) or 0)
        updates.update({
            "pausedAt": now,
            "durationSeconds": duration_seconds,
            "activeDurationSeconds": max(
                duration_seconds - total_paused_seconds,
                0,
            ),
        })
    elif action == "resume":
        paused_at = trip.get("pausedAt")
        total_paused_seconds = int(trip.get("totalPausedSeconds", 0) or 0)
        if isinstance(paused_at, datetime):
            if paused_at.tzinfo is None:
                paused_at = paused_at.replace(tzinfo=timezone.utc)
            total_paused_seconds += max(int((now - paused_at).total_seconds()), 0)
        updates.update({
            "resumedAt": now,
            "totalPausedSeconds": total_paused_seconds,
        })
        unset_fields["pausedAt"] = ""
    else:
        started_at = trip.get("startedAt") or trip.get("createdAt")
        if isinstance(started_at, datetime):
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            duration_seconds = max(int((now - started_at).total_seconds()), 0)
        else:
            duration_seconds = 0

        total_paused_seconds = int(trip.get("totalPausedSeconds", 0) or 0)
        paused_at = trip.get("pausedAt")
        if trip.get("status") == "paused" and isinstance(paused_at, datetime):
            if paused_at.tzinfo is None:
                paused_at = paused_at.replace(tzinfo=timezone.utc)
            total_paused_seconds += max(int((now - paused_at).total_seconds()), 0)

        updates.update({
            "completedAt": now,
            "durationSeconds": duration_seconds,
            "activeDurationSeconds": max(
                duration_seconds - total_paused_seconds,
                0,
            ),
            "totalPausedSeconds": total_paused_seconds,
        })
        unset_fields["activeKey"] = ""
        unset_fields["busActiveKey"] = ""
        unset_fields["pausedAt"] = ""

    update_document: dict[str, Any] = {"$set": updates}
    if unset_fields:
        update_document["$unset"] = unset_fields

    result = trips_collection.update_one(
        {**query, "status": {"$in": list(allowed_statuses)}},
        update_document,
    )

    if result.modified_count != 1:
        return jsonify({
            "error": "Trip status changed before this action completed",
        }), 409

    updated_trip = {**trip, **updates}
    for field in unset_fields:
        updated_trip.pop(field, None)

    if action == "resume" and not _assignment_is_still_authorized(
        driver_id,
        str(trip.get("busId") or trip.get("vehicleRegistrationNumber") or ""),
        str(trip.get("routeNumber") or ""),
    ):
        trips_collection.update_one(
            {
                "_id": trip["_id"],
                "status": "active",
                "updatedAt": now,
            },
            {
                "$set": {
                    "status": "paused",
                    "pausedAt": now,
                    "updatedAt": now,
                },
                "$unset": {"resumedAt": ""},
            },
        )
        return jsonify({
            "error": "Driver approval or assignment changed while resuming the trip",
            "code": "DRIVER_AUTHORITY_CHANGED",
        }), 403

    bus_id = str(
        trip.get("busId")
        or trip.get("vehicleRegistrationNumber")
        or ""
    )
    route_number = str(trip.get("routeNumber") or "")
    bus_status = "offline" if action == "complete" else target_status
    public_trip_id = None if action == "complete" else trip_id

    try:
        bus_payload = _persist_bus_status(
            bus_id=bus_id,
            route_number=route_number,
            driver_id=driver_id,
            status=bus_status,
            trip_id=public_trip_id,
            now=now,
        )
    except BusStatusConflict:
        trips_collection.replace_one(
            {
                "_id": trip["_id"],
                "status": target_status,
                "updatedAt": now,
            },
            trip,
        )
        return jsonify({
            "error": "A newer operational status already exists for this bus",
            "code": "STATUS_SUPERSEDED",
        }), 409
    except Exception:
        # Best-effort compensation preserves the prior trip transition when
        # MongoDB cannot persist the corresponding bus state.
        trips_collection.replace_one(
            {
                "_id": trip["_id"],
                "status": target_status,
                "updatedAt": now,
            },
            trip,
        )
        raise

    _emit_bus_update(bus_payload)

    return jsonify({
        "status": response_status,
        "trip": serialize_trip(updated_trip),
        "bus": bus_payload,
    })


@trip_bp.route("/api/driver/trips/<trip_id>/pause", methods=["POST"])
@jwt_required
@roles_required("driver")
def pause_trip(trip_id):
    return _transition_trip(trip_id, "pause")


@trip_bp.route("/api/driver/trips/<trip_id>/resume", methods=["POST"])
@jwt_required
@roles_required("driver")
def resume_trip(trip_id):
    return _transition_trip(trip_id, "resume")


@trip_bp.route("/api/driver/trips/<trip_id>/complete", methods=["POST"])
@jwt_required
@roles_required("driver")
def complete_trip(trip_id):
    return _transition_trip(trip_id, "complete")


def _finite_number(value: Any, minimum: float, maximum: float):
    if isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(parsed) or not minimum <= parsed <= maximum:
        return None
    return parsed


@trip_bp.route("/api/driver/issues", methods=["POST"])
@jwt_required
@roles_required("driver")
def report_issue():
    driver, driver_id, error_response = _authenticated_driver()
    if error_response:
        return error_response

    bus_id, route_number, assignment_error = _approved_assignment(driver)
    if assignment_error:
        return assignment_error

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    category = str(data.get("category") or "").strip().lower()
    severity = str(data.get("severity") or "medium").strip().lower()
    message = str(data.get("message") or "").strip()

    if category not in ISSUE_CATEGORIES:
        return jsonify({
            "error": "Invalid issue category",
            "allowedCategories": sorted(ISSUE_CATEGORIES),
        }), 400

    if severity not in ISSUE_SEVERITIES:
        return jsonify({
            "error": "Invalid issue severity",
            "allowedSeverities": sorted(ISSUE_SEVERITIES),
        }), 400

    if len(message) > MAX_ISSUE_MESSAGE_LENGTH:
        return jsonify({
            "error": f"message must be {MAX_ISSUE_MESSAGE_LENGTH} characters or fewer",
        }), 400

    location = data.get("location")
    normalized_location = None
    if location is not None:
        if not isinstance(location, dict):
            return jsonify({"error": "location must be an object"}), 400
        latitude = _finite_number(location.get("lat"), -90, 90)
        longitude = _finite_number(location.get("lng"), -180, 180)
        if latitude is None or longitude is None:
            return jsonify({"error": "location coordinates are invalid"}), 400
        normalized_location = {"lat": latitude, "lng": longitude}
        accuracy = _finite_number(location.get("accuracy"), 0, 500)
        if location.get("accuracy") is not None:
            if accuracy is None:
                return jsonify({"error": "location accuracy is invalid"}), 400
            normalized_location["accuracy"] = accuracy

    active_trip = _find_open_trip(driver_id)
    now = utc_now()
    issue = {
        "driverId": driver_id,
        "busId": bus_id,
        "vehicleRegistrationNumber": bus_id,
        "routeNumber": route_number,
        "tripId": str(active_trip["_id"]) if active_trip else None,
        "category": category,
        "severity": severity,
        "message": message,
        "location": normalized_location,
        "status": "open",
        "createdAt": now,
        "updatedAt": now,
    }
    result = issue_reports_collection.insert_one(issue)

    return jsonify({
        "status": "reported",
        "issue": {
            "id": str(result.inserted_id),
            "category": category,
            "severity": severity,
            "status": "open",
            "createdAt": now.isoformat(),
        },
    }), 201
