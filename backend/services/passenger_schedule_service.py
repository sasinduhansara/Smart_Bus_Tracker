from __future__ import annotations

from datetime import date, datetime, timedelta
from hashlib import sha1
import re
from typing import Any

from services.route_service import get_all_routes
from services.schedule_service import SERVICE_TYPES, list_daily_services


SERVICE_TYPE_ALIASES = {
    "ac": "intercity",
}

SERVICE_TYPE_LABELS = {
    "sltb": "SLTB",
    "private": "Private",
    "intercity": "AC",
}


class PassengerScheduleError(ValueError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "PASSENGER_SCHEDULE_ERROR",
        status: int = 400,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _clean(value: Any, limit: int = 160) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())[:limit]


def _normalized(value: Any) -> str:
    return _clean(value).casefold()


def _normalize_date(value: str) -> str:
    value = _clean(value, 10)

    if not value:
        return date.today().isoformat()

    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as error:
        raise PassengerScheduleError(
            "date must use YYYY-MM-DD format",
            code="INVALID_SERVICE_DATE",
        ) from error


def _canonical_service_type(value: Any) -> str:
    service_type = _clean(value, 30).lower()
    return SERVICE_TYPE_ALIASES.get(service_type, service_type)


def _service_type_label(service_type: str) -> str:
    return SERVICE_TYPE_LABELS.get(
        service_type,
        service_type.replace("_", " ").title(),
    )


def _normalize_service_types(value: Any) -> set[str]:
    if value is None:
        return set()

    values = value.split(",") if isinstance(value, str) else list(value)

    result = {
        _canonical_service_type(item)
        for item in values
        if _clean(item, 30)
    }

    invalid = result.difference(set(SERVICE_TYPES))

    if invalid:
        raise PassengerScheduleError(
            f"Invalid serviceTypes: {', '.join(sorted(invalid))}",
            code="INVALID_SERVICE_TYPES",
        )

    return result


def _public_stop_id(name: str) -> str:
    digest = sha1(
        _normalized(name).encode("utf-8")
    ).hexdigest()[:16]

    return f"stop_{digest}"


def _coordinate(stop: dict[str, Any], field: str) -> float | None:
    value = stop.get(field)

    if value is None:
        location = stop.get("location")

        if isinstance(location, dict):
            coordinates = location.get("coordinates")

            if isinstance(coordinates, list) and len(coordinates) >= 2:
                value = (
                    coordinates[1]
                    if field == "latitude"
                    else coordinates[0]
                )

    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _offset_minutes(stop: dict[str, Any]) -> int:
    try:
        return max(
            0,
            int(round(float(stop.get("arrivalOffsetMinutes", 0)))),
        )
    except (TypeError, ValueError):
        return 0


def _route_stops(route: dict[str, Any]) -> list[dict[str, Any]]:
    raw_stops = route.get("stops")

    if not isinstance(raw_stops, list):
        return []

    stops: list[dict[str, Any]] = []

    for index, stop in enumerate(raw_stops):
        if not isinstance(stop, dict):
            continue

        name = _clean(stop.get("name"))

        if not name:
            continue

        stops.append({
            "id": _public_stop_id(name),
            "routeStopId": _clean(stop.get("id"), 100) or None,
            "name": name,
            "sequence": index + 1,
            "latitude": _coordinate(stop, "latitude"),
            "longitude": _coordinate(stop, "longitude"),
            "arrivalOffsetMinutes": _offset_minutes(stop),
        })

    return stops


def _active_routes() -> list[dict[str, Any]]:
    return [
        route
        for route in get_all_routes()
        if route.get("isActive", True)
        and _clean(
            route.get("recordStatus") or "active"
        ).lower() == "active"
    ]


def search_public_stops(
    query: str,
    *,
    limit: int = 10,
) -> list[dict[str, Any]]:
    query_normalized = _normalized(query)

    if len(query_normalized) < 2:
        return []

    result_limit = max(1, min(int(limit), 25))
    matches: dict[str, dict[str, Any]] = {}

    for route in _active_routes():
        route_number = _clean(route.get("routeNumber"), 40)

        for stop in _route_stops(route):
            if query_normalized not in _normalized(stop["name"]):
                continue

            stop_id = stop["id"]

            if stop_id not in matches:
                matches[stop_id] = {
                    **stop,
                    "routeNumbers": [],
                }

            if (
                route_number
                and route_number
                not in matches[stop_id]["routeNumbers"]
            ):
                matches[stop_id]["routeNumbers"].append(route_number)

    results = list(matches.values())

    for result in results:
        result["routeNumbers"].sort()
        result["routeCount"] = len(result["routeNumbers"])

    results.sort(
        key=lambda item: (
            not _normalized(item["name"]).startswith(query_normalized),
            _normalized(item["name"]),
        )
    )

    return results[:result_limit]


def _find_stop_index(
    stops: list[dict[str, Any]],
    identifier: str,
) -> int | None:
    target = _normalized(identifier)

    for index, stop in enumerate(stops):
        candidates = {
            _normalized(stop.get("id")),
            _normalized(stop.get("routeStopId")),
            _normalized(stop.get("name")),
        }

        if target in candidates:
            return index

    return None


def _service_type(service: dict[str, Any]) -> str:
    return _canonical_service_type(
        service.get("serviceType")
        or service.get("serviceCategory")
    )


def _service_matches_route(
    service: dict[str, Any],
    route: dict[str, Any],
) -> bool:
    route_id = _clean(route.get("id"), 100)
    route_number = _clean(route.get("routeNumber"), 40)

    service_route_id = _clean(service.get("routeId"), 100)
    service_route_number = _clean(
        service.get("routeNumber"),
        40,
    )

    return bool(
        route_id
        and service_route_id == route_id
        or route_number
        and service_route_number.casefold()
        == route_number.casefold()
    )


def search_public_routes(
    *,
    from_stop_id: str,
    to_stop_id: str,
    service_date: str = "",
    service_types: Any = None,
) -> dict[str, Any]:
    normalized_date = _normalize_date(service_date)
    selected_types = _normalize_service_types(service_types)

    if not _clean(from_stop_id):
        raise PassengerScheduleError(
            "fromStopId is required",
            code="FROM_STOP_REQUIRED",
        )

    if not _clean(to_stop_id):
        raise PassengerScheduleError(
            "toStopId is required",
            code="TO_STOP_REQUIRED",
        )

    if _normalized(from_stop_id) == _normalized(to_stop_id):
        raise PassengerScheduleError(
            "Start stop and end stop must be different",
            code="SAME_START_AND_END_STOP",
        )

    daily_services = list_daily_services(
        service_date=normalized_date,
    )

    results: list[dict[str, Any]] = []

    for route in _active_routes():
        stops = _route_stops(route)

        from_index = _find_stop_index(stops, from_stop_id)
        to_index = _find_stop_index(stops, to_stop_id)

        if (
            from_index is None
            or to_index is None
            or from_index >= to_index
        ):
            continue

        raw_route_categories = {
            _clean(category, 30).lower()
            for category in route.get("serviceCategories", [])
            if _clean(category, 30)
        }
        route_categories = {
            _canonical_service_type(category)
            for category in raw_route_categories
        }

        matching_services = [
            service
            for service in daily_services
            if _service_matches_route(service, route)
            and (
                not selected_types
                or _service_type(service) in selected_types
            )
            and _clean(
                service.get("status") or "scheduled"
            ).lower() != "cancelled"
        ]

        if (
            selected_types
            and not route_categories.intersection(selected_types)
            and not matching_services
        ):
            continue

        service_counts_by_type = {
            service_type: sum(
                1
                for service in matching_services
                if _service_type(service) == service_type
            )
            for service_type in sorted(SERVICE_TYPES)
        }
        available_service_types = [
            service_type
            for service_type, count in service_counts_by_type.items()
            if count > 0
        ]

        results.append({
            "id": _clean(route.get("id"), 100),
            "routeNumber": _clean(route.get("routeNumber"), 40),
            "name": _clean(route.get("name")),
            "direction": _clean(
                route.get("direction") or "outbound",
                30,
            ),
            "origin": _clean(route.get("origin")),
            "destination": _clean(route.get("destination")),
            "serviceCategories": sorted(raw_route_categories),
            "availableServiceTypes": available_service_types,
            "serviceTypeLabels": {
                service_type: _service_type_label(service_type)
                for service_type in available_service_types
            },
            "scheduledServiceCountByType": service_counts_by_type,
            "fromStop": stops[from_index],
            "toStop": stops[to_index],
            "selectedStopCount": to_index - from_index + 1,
            "totalStopCount": len(stops),
            "scheduledServiceCount": len(matching_services),
            "hasScheduledServices": bool(matching_services),
        })

    results.sort(
        key=lambda item: (
            not item["hasScheduledServices"],
            item["routeNumber"],
            item["direction"],
        )
    )

    return {
        "date": normalized_date,
        "fromStopId": from_stop_id,
        "toStopId": to_stop_id,
        "serviceTypes": sorted(selected_types),
        "routes": results,
    }


def _find_route(identifier: str) -> dict[str, Any] | None:
    target = _normalized(identifier)

    for route in _active_routes():
        if target in {
            _normalized(route.get("id")),
            _normalized(route.get("routeNumber")),
        }:
            return route

    return None


def _time_with_offset(
    departure_time: Any,
    offset_minutes: int,
) -> str | None:
    match = re.match(
        r"^(\d{1,2}):(\d{2})",
        _clean(departure_time, 20),
    )

    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2))

    if hour > 23 or minute > 59:
        return None

    calculated = (
        datetime(2000, 1, 1, hour, minute)
        + timedelta(minutes=offset_minutes)
    )

    return calculated.strftime("%H:%M")


def get_public_timetable(
    route_identifier: str,
    *,
    service_date: str = "",
    from_stop_id: str = "",
    to_stop_id: str = "",
    service_types: Any = None,
) -> dict[str, Any]:
    normalized_date = _normalize_date(service_date)
    selected_types = _normalize_service_types(service_types)

    route = _find_route(route_identifier)

    if route is None:
        raise PassengerScheduleError(
            "Route not found",
            code="ROUTE_NOT_FOUND",
            status=404,
        )

    stops = _route_stops(route)

    if not stops:
        raise PassengerScheduleError(
            "Route does not have ordered stops",
            code="ROUTE_STOPS_NOT_FOUND",
            status=409,
        )

    from_index = (
        _find_stop_index(stops, from_stop_id)
        if from_stop_id
        else 0
    )

    if from_index is None:
        raise PassengerScheduleError(
            "Selected start stop does not belong to this route",
            code="START_STOP_NOT_ON_ROUTE",
            status=404,
        )

    to_index = (
        _find_stop_index(stops, to_stop_id)
        if to_stop_id
        else len(stops) - 1
    )

    if to_index is None:
        raise PassengerScheduleError(
            "Selected destination stop does not belong to this route",
            code="DESTINATION_STOP_NOT_ON_ROUTE",
            status=404,
        )

    if from_index == to_index:
        raise PassengerScheduleError(
            "Start stop and destination stop must be different",
            code="SAME_START_AND_END_STOP",
        )

    if from_index > to_index:
        raise PassengerScheduleError(
            "Destination stop must appear after the start stop on this route",
            code="INVALID_STOP_ORDER",
        )

    selected_from_stop = stops[from_index]
    selected_to_stop = stops[to_index]
    start_offset_minutes = selected_from_stop["arrivalOffsetMinutes"]
    destination_offset_minutes = selected_to_stop["arrivalOffsetMinutes"]
    journey_duration_minutes = (
        destination_offset_minutes - start_offset_minutes
    )

    services: list[dict[str, Any]] = []

    for service in list_daily_services(service_date=normalized_date):
        if not _service_matches_route(service, route):
            continue

        current_type = _service_type(service)

        if selected_types and current_type not in selected_types:
            continue

        status = _clean(
            service.get("status") or "scheduled",
            30,
        ).lower()

        if status == "cancelled":
            continue

        trip_status = (
            _clean(service.get("tripStatus"), 30).lower()
            or None
        )
        trip_id = _clean(service.get("tripId"), 100) or None

        live_available = bool(
            trip_id
            and (
                status == "in_progress"
                or trip_status in {"active", "paused"}
            )
        )

        departure = _clean(service.get("departureTime"), 20)

        services.append({
            "serviceId": _clean(
                service.get("id") or service.get("_id"),
                100,
            ),
            "routeId": _clean(route.get("id"), 100),
            "routeNumber": _clean(route.get("routeNumber"), 40),
            "serviceType": current_type,
            "serviceTypeLabel": _service_type_label(current_type),
            "serviceDate": normalized_date,
            "scheduledDeparture": departure,
            "departureFromSelectedStop": _time_with_offset(
                departure,
                start_offset_minutes,
            ),
            "arrivalAtDestination": _time_with_offset(
                departure,
                destination_offset_minutes,
            ),
            "selectedStopOffsetMinutes": start_offset_minutes,
            "destinationStopOffsetMinutes": destination_offset_minutes,
            "journeyDurationMinutes": journey_duration_minutes,
            "status": status,
            "tripStatus": trip_status,
            "tripId": trip_id,
            "liveTrackingAvailable": live_available,
            "trackingState": (
                "live"
                if live_available
                else "scheduled"
                if status == "scheduled"
                else status
            ),
            "busId": _clean(service.get("busId"), 100) or None,
            "busRegistration": (
                _clean(service.get("busRegistration"), 60) or None
            ),
            "driverName": (
                _clean(service.get("driverName"), 120) or None
            ),
            "operatorName": (
                _clean(service.get("operatorName"), 120) or None
            ),
        })

    services.sort(
        key=lambda item: (
            item["departureFromSelectedStop"]
            or item["scheduledDeparture"]
            or "99:99",
            item["serviceType"],
        )
    )

    return {
        "date": normalized_date,
        "route": {
            "id": _clean(route.get("id"), 100),
            "routeNumber": _clean(route.get("routeNumber"), 40),
            "name": _clean(route.get("name")),
            "direction": _clean(
                route.get("direction") or "outbound",
                30,
            ),
            "origin": _clean(route.get("origin")),
            "destination": _clean(route.get("destination")),
            "serviceCategories": route.get(
                "serviceCategories",
                [],
            ),
        },
        "selectedStop": selected_from_stop,
        "selectedFromStop": selected_from_stop,
        "selectedToStop": selected_to_stop,
        "journeyDurationMinutes": journey_duration_minutes,
        "services": services,
        "meta": {
            "count": len(services),
            "liveCount": sum(
                1
                for service in services
                if service["liveTrackingAvailable"]
            ),
            "serviceTypes": sorted(selected_types),
            "serviceTypeLabels": {
                service_type: _service_type_label(service_type)
                for service_type in sorted(SERVICE_TYPES)
            },
        },
    }

