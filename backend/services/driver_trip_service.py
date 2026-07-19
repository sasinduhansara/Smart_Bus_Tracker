from datetime import datetime, timezone
from typing import Any

from bson.objectid import ObjectId


OPEN_TRIP_STATUSES = ("active", "paused")
TRIP_STATUSES = (*OPEN_TRIP_STATUSES, "completed")
APPROVED_DRIVER_STATUSES = ("approved", "verified")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(value: Any) -> str | None:
    if not isinstance(value, datetime):
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc).isoformat()


def driver_reference_query(driver_id: str) -> dict[str, Any]:
    references: list[dict[str, Any]] = [
        {"driverId": driver_id},
        {"driver_id": driver_id},
    ]

    if ObjectId.is_valid(driver_id):
        driver_object_id = ObjectId(driver_id)
        references.extend((
            {"driverId": driver_object_id},
            {"driver_id": driver_object_id},
        ))

    return {"$or": references}


def owned_trip_query(driver_id: str, trip_id: str) -> dict[str, Any] | None:
    if not ObjectId.is_valid(trip_id):
        return None

    return {
        "_id": ObjectId(trip_id),
        **driver_reference_query(driver_id),
    }


def serialize_location(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    location = {
        "lat": value.get("lat"),
        "lng": value.get("lng"),
        "speed": value.get("speed"),
        "heading": value.get("heading"),
        "accuracy": value.get("accuracy"),
        "timestamp": (
            to_iso(value.get("timestamp"))
            or str(value.get("timestamp") or "")
        ),
    }

    return {
        key: item
        for key, item in location.items()
        if item is not None and item != ""
    }


def serialize_trip(trip: dict[str, Any]) -> dict[str, Any]:
    started_at = trip.get("startedAt") or trip.get("createdAt")
    completed_at = trip.get("completedAt")
    duration_seconds = trip.get("durationSeconds", 0) or 0
    active_duration_seconds = trip.get(
        "activeDurationSeconds",
        duration_seconds,
    ) or 0
    paused_duration_seconds = trip.get("totalPausedSeconds", 0) or 0

    def non_negative_int(value: Any) -> int:
        try:
            return max(int(value or 0), 0)
        except (TypeError, ValueError):
            return 0

    def non_negative_float(value: Any) -> float:
        try:
            return max(float(value or 0), 0)
        except (TypeError, ValueError):
            return 0

    status = str(trip.get("status") or "completed").strip().lower()
    if status not in TRIP_STATUSES:
        status = "completed"

    payload: dict[str, Any] = {
        "id": str(trip.get("_id", "")),
        "driverId": str(
            trip.get("driverId")
            or trip.get("driver_id")
            or ""
        ),
        "busId": str(
            trip.get("busId")
            or trip.get("bus_id")
            or trip.get("vehicleRegistrationNumber")
            or ""
        ),
        "vehicleRegistrationNumber": str(
            trip.get("vehicleRegistrationNumber")
            or trip.get("busId")
            or ""
        ),
        "routeNumber": str(trip.get("routeNumber") or ""),
        "routeName": str(trip.get("routeName") or ""),
        "origin": str(
            trip.get("origin")
            or trip.get("from")
            or trip.get("startLocation")
            or ""
        ),
        "destination": str(
            trip.get("destination")
            or trip.get("to")
            or trip.get("endLocation")
            or ""
        ),
        "status": status,
        "startedAt": to_iso(started_at) or str(started_at or ""),
        "durationSeconds": non_negative_int(duration_seconds),
        "activeDurationSeconds": non_negative_int(active_duration_seconds),
        "pausedDurationSeconds": non_negative_int(paused_duration_seconds),
        "distanceKm": non_negative_float(trip.get("distanceKm", 0)),
    }

    for field in (
        "startTerminalId",
        "startTerminalName",
        "destinationTerminalId",
        "destinationTerminalName",
        "direction",
    ):
        value = str(trip.get(field) or "").strip()
        if value:
            payload[field] = value

    for field in ("startLatitude", "startLongitude", "startAccuracy"):
        value = trip.get(field)
        if value is not None:
            payload[field] = value

    for field in ("pausedAt", "resumedAt", "completedAt"):
        value = trip.get(field)
        serialized_value = to_iso(value) or (str(value) if value else None)
        if serialized_value:
            payload[field] = serialized_value

    last_location = serialize_location(trip.get("lastLocation"))
    if last_location:
        payload["lastLocation"] = last_location

    if completed_at and "completedAt" not in payload:
        payload["completedAt"] = str(completed_at)

    return payload


def build_safe_bus_payload(
    *,
    bus_id: str,
    route_number: str,
    operational_status: str,
    trip_id: str | None,
    status_updated_at: datetime,
    location: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "bus_id": bus_id,
        "vehicleRegistrationNumber": bus_id,
        "routeNumber": route_number,
        "operationalStatus": operational_status,
        "isActive": operational_status == "active",
        "activeTripId": trip_id,
        "tripId": trip_id,
        "statusUpdatedAt": to_iso(status_updated_at),
    }

    if location:
        for field in (
            "lat",
            "lng",
            "speed",
            "heading",
            "accuracy",
            "updatedAt",
        ):
            if location.get(field) is not None:
                payload[field] = location[field]

    return payload


def bus_operational_update(
    *,
    bus_id: str,
    route_number: str,
    driver_id: str,
    operational_status: str,
    trip_id: str | None,
    now: datetime,
    location: dict[str, Any] | None = None,
) -> dict[str, Any]:
    update: dict[str, Any] = {
        "$set": {
            "bus_id": bus_id,
            "trackingKey": bus_id,
            "vehicleRegistrationNumber": bus_id,
            "routeNumber": route_number,
            "driver_id": driver_id,
            "operationalStatus": operational_status,
            "isActive": operational_status == "active",
            "activeTripId": trip_id,
            "tripId": trip_id,
            "statusUpdatedAt": now,
        },
        "$setOnInsert": {
            "createdAt": now,
        },
    }

    if location:
        for field in (
            "lat",
            "lng",
            "speed",
            "heading",
            "accuracy",
            "clientTimestamp",
            "updatedAt",
        ):
            if location.get(field) is not None:
                update["$set"][field] = location[field]

        missing_optional_fields = {
            field: ""
            for field in ("speed", "heading")
            if location.get(field) is None
        }
        if missing_optional_fields:
            update["$unset"] = missing_optional_fields

    return update
