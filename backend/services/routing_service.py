from __future__ import annotations

import json
import math
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org"
DEFAULT_OSRM_PROFILE = "driving"
DEFAULT_TIMEOUT_SECONDS = 25.0
MAX_ROUTE_STOPS = 100


class RoutingServiceError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "ROUTING_ERROR",
        status: int = 502,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _finite_number(
    value: Any,
    *,
    minimum: float,
    maximum: float,
    field: str,
) -> float:
    if isinstance(value, bool):
        raise RoutingServiceError(
            f"{field} is invalid",
            code="INVALID_STOP_COORDINATE",
            status=400,
        )

    try:
        parsed = float(value)
    except (TypeError, ValueError) as error:
        raise RoutingServiceError(
            f"{field} is invalid",
            code="INVALID_STOP_COORDINATE",
            status=400,
        ) from error

    if not math.isfinite(parsed) or not minimum <= parsed <= maximum:
        raise RoutingServiceError(
            f"{field} is outside the valid range",
            code="INVALID_STOP_COORDINATE",
            status=400,
        )

    return parsed


def _normalize_stops(stops: Any) -> list[dict[str, Any]]:
    if not isinstance(stops, list):
        raise RoutingServiceError(
            "stops must be a list",
            code="INVALID_ROUTE_STOPS",
            status=400,
        )

    if not 2 <= len(stops) <= MAX_ROUTE_STOPS:
        raise RoutingServiceError(
            f"A routed journey must contain between 2 and {MAX_ROUTE_STOPS} stops",
            code="INVALID_ROUTE_STOPS",
            status=400,
        )

    normalized: list[dict[str, Any]] = []

    for index, raw_stop in enumerate(stops, start=1):
        if not isinstance(raw_stop, dict):
            raise RoutingServiceError(
                f"Stop {index} is invalid",
                code="INVALID_ROUTE_STOP",
                status=400,
            )

        name = str(raw_stop.get("name") or "").strip()
        if not name:
            raise RoutingServiceError(
                f"Stop {index} name is required",
                code="INVALID_ROUTE_STOP",
                status=400,
            )

        latitude = _finite_number(
            raw_stop.get("latitude"),
            minimum=-90,
            maximum=90,
            field=f"Stop {index} latitude",
        )
        longitude = _finite_number(
            raw_stop.get("longitude"),
            minimum=-180,
            maximum=180,
            field=f"Stop {index} longitude",
        )

        normalized.append({
            **raw_stop,
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
            "sequence": index,
        })

    return normalized


def _timeout_seconds() -> float:
    raw_value = os.getenv(
        "OSRM_TIMEOUT_SECONDS",
        str(DEFAULT_TIMEOUT_SECONDS),
    )

    try:
        timeout = float(raw_value)
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT_SECONDS

    return timeout if 1 <= timeout <= 120 else DEFAULT_TIMEOUT_SECONDS


def _request_url(stops: list[dict[str, Any]]) -> str:
    base_url = os.getenv(
        "OSRM_BASE_URL",
        DEFAULT_OSRM_BASE_URL,
    ).strip().rstrip("/")

    profile = os.getenv(
        "OSRM_PROFILE",
        DEFAULT_OSRM_PROFILE,
    ).strip() or DEFAULT_OSRM_PROFILE

    coordinates = ";".join(
        f'{stop["longitude"]:.6f},{stop["latitude"]:.6f}'
        for stop in stops
    )

    return (
        f"{base_url}/route/v1/{profile}/{coordinates}"
        "?overview=full"
        "&geometries=geojson"
        "&steps=false"
        "&annotations=duration,distance"
    )


def _read_osrm_response(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Gamana-Smart-Bus-Tracker/0.1",
        },
        method="GET",
    )

    try:
        with urlopen(
            request,
            timeout=_timeout_seconds(),
        ) as response:
            raw_body = response.read().decode("utf-8")
    except HTTPError as error:
        try:
            error_body = error.read().decode("utf-8")
        except Exception:
            error_body = ""

        raise RoutingServiceError(
            f"OSRM returned HTTP {error.code}: {error_body[:300]}",
            code="ROUTING_PROVIDER_HTTP_ERROR",
            status=502,
        ) from error
    except URLError as error:
        raise RoutingServiceError(
            f"Could not connect to OSRM: {error.reason}",
            code="ROUTING_PROVIDER_UNAVAILABLE",
            status=503,
        ) from error
    except TimeoutError as error:
        raise RoutingServiceError(
            "OSRM request timed out",
            code="ROUTING_PROVIDER_TIMEOUT",
            status=504,
        ) from error

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise RoutingServiceError(
            "OSRM returned an invalid JSON response",
            code="INVALID_ROUTING_RESPONSE",
            status=502,
        ) from error

    if not isinstance(payload, dict):
        raise RoutingServiceError(
            "OSRM returned an invalid response",
            code="INVALID_ROUTING_RESPONSE",
            status=502,
        )

    if payload.get("code") != "Ok":
        raise RoutingServiceError(
            str(
                payload.get("message")
                or payload.get("code")
                or "OSRM could not calculate this route"
            ),
            code="ROUTE_NOT_FOUND",
            status=422,
        )

    return payload


def calculate_osrm_route(stops: Any) -> dict[str, Any]:
    normalized_stops = _normalize_stops(stops)
    payload = _read_osrm_response(_request_url(normalized_stops))

    routes = payload.get("routes")
    if not isinstance(routes, list) or not routes:
        raise RoutingServiceError(
            "OSRM did not return a route",
            code="ROUTE_NOT_FOUND",
            status=422,
        )

    route = routes[0]
    if not isinstance(route, dict):
        raise RoutingServiceError(
            "OSRM returned an invalid route",
            code="INVALID_ROUTING_RESPONSE",
            status=502,
        )

    legs = route.get("legs")
    if not isinstance(legs, list) or len(legs) != len(normalized_stops) - 1:
        raise RoutingServiceError(
            "OSRM returned an unexpected number of route legs",
            code="INVALID_ROUTING_RESPONSE",
            status=502,
        )

    geometry = route.get("geometry")
    if (
        not isinstance(geometry, dict)
        or geometry.get("type") != "LineString"
        or not isinstance(geometry.get("coordinates"), list)
    ):
        raise RoutingServiceError(
            "OSRM did not return valid GeoJSON geometry",
            code="INVALID_ROUTING_RESPONSE",
            status=502,
        )

    polyline: list[dict[str, float]] = []

    for coordinate in geometry["coordinates"]:
        if not isinstance(coordinate, list) or len(coordinate) < 2:
            continue

        try:
            longitude = float(coordinate[0])
            latitude = float(coordinate[1])
        except (TypeError, ValueError):
            continue

        polyline.append({
            "latitude": latitude,
            "longitude": longitude,
        })

    if len(polyline) < 2:
        raise RoutingServiceError(
            "OSRM route geometry contains too few points",
            code="INVALID_ROUTING_RESPONSE",
            status=502,
        )

    waypoints = payload.get("waypoints")
    if not isinstance(waypoints, list):
        waypoints = []

    routed_stops: list[dict[str, Any]] = []
    routed_legs: list[dict[str, Any]] = []

    cumulative_duration_seconds = 0.0
    previous_offset_minutes = -1

    for index, stop in enumerate(normalized_stops):
        travel_seconds = 0.0
        travel_distance_meters = 0.0

        if index > 0:
            leg = legs[index - 1]

            try:
                travel_seconds = float(leg.get("duration") or 0)
                travel_distance_meters = float(leg.get("distance") or 0)
            except (TypeError, ValueError) as error:
                raise RoutingServiceError(
                    "OSRM returned invalid leg timing data",
                    code="INVALID_ROUTING_RESPONSE",
                    status=502,
                ) from error

            cumulative_duration_seconds += travel_seconds

            travel_minutes = max(
                1,
                int(round(travel_seconds / 60)),
            )
            arrival_offset_minutes = max(
                previous_offset_minutes + 1,
                int(round(cumulative_duration_seconds / 60)),
            )

            routed_legs.append({
                "fromStopId": str(
                    normalized_stops[index - 1].get("id") or ""
                ),
                "fromStopName": normalized_stops[index - 1]["name"],
                "toStopId": str(stop.get("id") or ""),
                "toStopName": stop["name"],
                "distanceMeters": round(travel_distance_meters, 1),
                "durationSeconds": round(travel_seconds, 1),
                "travelMinutes": travel_minutes,
            })
        else:
            travel_minutes = 0
            arrival_offset_minutes = 0

        routed_stop = {
            **stop,
            "travelMinutesFromPreviousStop": travel_minutes,
            "arrivalOffsetMinutes": arrival_offset_minutes,
        }

        if index < len(waypoints):
            waypoint = waypoints[index]
            location = (
                waypoint.get("location")
                if isinstance(waypoint, dict)
                else None
            )

            if isinstance(location, list) and len(location) >= 2:
                routed_stop["snappedLongitude"] = location[0]
                routed_stop["snappedLatitude"] = location[1]

        routed_stops.append(routed_stop)
        previous_offset_minutes = arrival_offset_minutes

    total_distance_meters = float(route.get("distance") or 0)
    total_duration_seconds = float(route.get("duration") or 0)

    return {
        "provider": "osrm",
        "profile": os.getenv(
            "OSRM_PROFILE",
            DEFAULT_OSRM_PROFILE,
        ),
        "totalDistanceMeters": round(total_distance_meters, 1),
        "totalDistanceKm": round(total_distance_meters / 1000, 2),
        "totalDurationSeconds": round(total_duration_seconds, 1),
        "totalDurationMinutes": max(
            1,
            int(round(total_duration_seconds / 60)),
        ),
        "geometry": geometry,
        "polyline": polyline,
        "legs": routed_legs,
        "stops": routed_stops,
    }
