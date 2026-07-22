"""
osrm_service.py

Thin HTTP wrapper around the OSRM API.

Responsibilities:
  - generate_route_geometry: call OSRM Route service to turn ordered stop
    coordinates into a snapped GeoJSON LineString.
  - snap_gps_to_route: call OSRM Match service to map a GPS trace to the
    road network.  Falls back to local projection when OSRM is unavailable.
  - validate_stops_on_route: verify that every stop is within the configured
    corridor of the approved route geometry.

All network calls carry a short timeout and raise OsrmUnavailable on failure
so callers can return a user-friendly 503 instead of a Python traceback.

GeoJSON coordinate order is always [longitude, latitude] throughout this
module and the rest of the tracking stack.
"""

from __future__ import annotations

import math
import os
from typing import Any

import requests

from config import OSRM_BASE_URL


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_REQUEST_TIMEOUT_SECONDS = 10

ROUTE_CORRIDOR_METERS = float(
    os.getenv("ROUTE_CORRIDOR_METERS", "150")
)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class OsrmUnavailable(RuntimeError):
    """Raised when the OSRM server cannot be reached or returns an error."""


class OsrmGeometryError(ValueError):
    """Raised when OSRM returns geometry that cannot be parsed."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _haversine_meters(
    lng_a: float,
    lat_a: float,
    lng_b: float,
    lat_b: float,
) -> float:
    """Return the great-circle distance in metres between two WGS-84 points.

    Arguments use GeoJSON order: longitude first, latitude second.
    """
    earth_radius = 6_371_000.0
    to_rad = math.radians
    d_lat = to_rad(lat_b - lat_a)
    d_lng = to_rad(lng_b - lng_a)
    lat_a_r = to_rad(lat_a)
    lat_b_r = to_rad(lat_b)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat_a_r) * math.cos(lat_b_r) * math.sin(d_lng / 2) ** 2
    )
    return earth_radius * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def _decode_polyline6(encoded: str) -> list[list[float]]:
    """Decode an OSRM Polyline-6 encoded string → list of [lng, lat]."""
    index = 0
    result: list[list[float]] = []
    lat = 0
    lng = 0

    while index < len(encoded):
        # Latitude
        b, shift, lat_result = 0, 0, 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            lat_result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lat += ~(lat_result >> 1) if lat_result & 1 else lat_result >> 1

        # Longitude
        b, shift, lng_result = 0, 0, 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            lng_result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lng += ~(lng_result >> 1) if lng_result & 1 else lng_result >> 1

        result.append([lng / 1e6, lat / 1e6])

    return result


def _point_to_segment_distance_meters(
    point_lng: float,
    point_lat: float,
    seg_a_lng: float,
    seg_a_lat: float,
    seg_b_lng: float,
    seg_b_lat: float,
) -> float:
    """Approximate perpendicular distance from a point to a line segment.

    Uses the local-XY projection approach for short distances (< 50 km).
    """
    lat_m = 110_540.0
    lng_m = 111_320.0 * math.cos(math.radians(point_lat))

    px = point_lng * lng_m
    py = point_lat * lat_m
    ax = seg_a_lng * lng_m
    ay = seg_a_lat * lat_m
    bx = seg_b_lng * lng_m
    by = seg_b_lat * lat_m

    ab_x, ab_y = bx - ax, by - ay
    seg_len_sq = ab_x ** 2 + ab_y ** 2
    if seg_len_sq == 0:
        return math.hypot(px - ax, py - ay)

    t = max(0.0, min(1.0, ((px - ax) * ab_x + (py - ay) * ab_y) / seg_len_sq))
    nearest_x = ax + t * ab_x
    nearest_y = ay + t * ab_y
    return math.hypot(px - nearest_x, py - nearest_y)


def _nearest_distance_to_linestring(
    lng: float,
    lat: float,
    coordinates: list[list[float]],
) -> float:
    """Return the minimum distance in metres from a point to a GeoJSON LineString."""
    if len(coordinates) < 2:
        if not coordinates:
            return float("inf")
        a = coordinates[0]
        return _haversine_meters(lng, lat, a[0], a[1])

    min_dist = float("inf")
    for i in range(len(coordinates) - 1):
        a = coordinates[i]
        b = coordinates[i + 1]
        dist = _point_to_segment_distance_meters(
            lng, lat, a[0], a[1], b[0], b[1],
        )
        if dist < min_dist:
            min_dist = dist
    return min_dist


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_route_geometry(
    ordered_coordinates: list[tuple[float, float]],
) -> dict[str, Any]:
    """Call the OSRM Route service to generate a road-snapped GeoJSON LineString.

    Parameters
    ----------
    ordered_coordinates:
        Ordered list of ``(longitude, latitude)`` tuples corresponding to the
        route's ordered stops.

    Returns
    -------
    dict
        GeoJSON LineString: ``{"type": "LineString", "coordinates": [[lng, lat], ...]}``.

    Raises
    ------
    OsrmUnavailable
        When the OSRM server cannot be reached or returns a non-200 response.
    OsrmGeometryError
        When the response cannot be parsed into a valid LineString.
    ValueError
        When ``ordered_coordinates`` has fewer than two points.
    """
    if len(ordered_coordinates) < 2:
        raise ValueError(
            "At least two coordinates are required to generate a route."
        )

    # Build the OSRM coordinate string: lng,lat;lng,lat;...
    coord_string = ";".join(
        f"{lng:.6f},{lat:.6f}" for lng, lat in ordered_coordinates
    )
    url = (
        f"{OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{coord_string}"
        "?overview=full&geometries=polyline6&steps=false"
    )

    try:
        response = requests.get(url, timeout=_REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
    except requests.Timeout:
        raise OsrmUnavailable(
            "The routing service did not respond in time. Try again or draw the route manually."
        )
    except requests.RequestException as exc:
        raise OsrmUnavailable(
            f"The routing service could not be reached: {exc}"
        )

    if data.get("code") != "Ok":
        raise OsrmGeometryError(
            f"OSRM returned an error: {data.get('code')} – {data.get('message', '')}"
        )

    try:
        encoded = data["routes"][0]["geometry"]
        coordinates = _decode_polyline6(encoded)
    except (KeyError, IndexError, TypeError) as exc:
        raise OsrmGeometryError(
            f"Could not parse the route geometry from the OSRM response: {exc}"
        )

    if len(coordinates) < 2:
        raise OsrmGeometryError(
            "The routing service returned a geometry with fewer than two points."
        )

    total_distance_meters: float = data["routes"][0].get("distance", 0.0)

    return {
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates,
        },
        "totalDistanceMeters": total_distance_meters,
    }


def snap_gps_to_route(
    lat: float,
    lng: float,
    route_geometry: dict[str, Any] | None,
) -> dict[str, Any]:
    """Snap a GPS point to the nearest position on the route geometry.

    First tries OSRM Match.  If OSRM is unavailable or the geometry is absent,
    falls back to local linear projection (which is always available).

    Parameters
    ----------
    lat, lng:
        Raw GPS coordinates in WGS-84.
    route_geometry:
        Stored GeoJSON LineString for the route, or ``None``.

    Returns
    -------
    dict
        ``{"snappedLat": float, "snappedLng": float,
           "distanceFromRouteMeters": float, "source": "osrm" | "local" | "raw"}``
    """
    if route_geometry is None:
        return {
            "snappedLat": lat,
            "snappedLng": lng,
            "distanceFromRouteMeters": 0.0,
            "source": "raw",
        }

    coordinates: list[list[float]] = route_geometry.get("coordinates", [])

    # Attempt OSRM Match for a single point (radius hinted at 50 m).
    url = (
        f"{OSRM_BASE_URL.rstrip('/')}/match/v1/driving/"
        f"{lng:.6f},{lat:.6f}"
        "?geometries=polyline6&radiuses=50&overview=false"
    )
    try:
        response = requests.get(url, timeout=_REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
        if data.get("code") == "Ok":
            tracepoint = data.get("tracepoints", [{}])[0] or {}
            loc = tracepoint.get("location", [])
            if len(loc) == 2:
                s_lng, s_lat = float(loc[0]), float(loc[1])
                dist = _haversine_meters(lng, lat, s_lng, s_lat)
                return {
                    "snappedLat": s_lat,
                    "snappedLng": s_lng,
                    "distanceFromRouteMeters": round(dist, 1),
                    "source": "osrm",
                }
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError, Exception):
        pass  # Fall through to local projection

    # Local fallback: nearest segment projection
    if not coordinates or len(coordinates) < 2:
        return {
            "snappedLat": lat,
            "snappedLng": lng,
            "distanceFromRouteMeters": 0.0,
            "source": "raw",
        }

    dist = _nearest_distance_to_linestring(lng, lat, coordinates)
    # Find nearest point coordinate for display
    nearest_coord = coordinates[0]
    min_d = float("inf")
    for coord in coordinates:
        d = _haversine_meters(lng, lat, coord[0], coord[1])
        if d < min_d:
            min_d = d
            nearest_coord = coord

    return {
        "snappedLat": nearest_coord[1],
        "snappedLng": nearest_coord[0],
        "distanceFromRouteMeters": round(dist, 1),
        "source": "local",
    }


def validate_stops_on_route(
    stops: list[dict[str, Any]],
    geometry: dict[str, Any],
    corridor_meters: float = ROUTE_CORRIDOR_METERS,
) -> dict[str, Any]:
    """Verify that every stop lies within ``corridor_meters`` of the route geometry.

    Parameters
    ----------
    stops:
        List of stop documents.  Each must have ``location.coordinates``
        ``[longitude, latitude]`` or legacy ``latitude``/``longitude`` fields.
    geometry:
        GeoJSON LineString for the route.
    corridor_meters:
        Maximum allowable distance in metres from a stop to the route line.

    Returns
    -------
    dict
        ``{"valid": bool, "violations": [{"stopName": str, "distanceMeters": float}]}``
    """
    coordinates: list[list[float]] = geometry.get("coordinates", [])
    violations: list[dict[str, Any]] = []

    for stop in stops:
        stop_name = stop.get("name", "Unknown stop")

        # Support both GeoJSON and legacy lat/lng formats
        loc = stop.get("location") or {}
        stop_coords = loc.get("coordinates")
        if stop_coords and len(stop_coords) == 2:
            s_lng, s_lat = float(stop_coords[0]), float(stop_coords[1])
        elif "latitude" in stop and "longitude" in stop:
            s_lat = float(stop["latitude"])
            s_lng = float(stop["longitude"])
        else:
            violations.append({
                "stopName": stop_name,
                "distanceMeters": None,
                "reason": "Stop has no coordinates",
            })
            continue

        dist = _nearest_distance_to_linestring(s_lng, s_lat, coordinates)
        if dist > corridor_meters:
            violations.append({
                "stopName": stop_name,
                "distanceMeters": round(dist, 1),
                "reason": (
                    f"Stop is {round(dist, 1)} m from the route line "
                    f"(maximum allowed: {corridor_meters} m)."
                ),
            })

    return {
        "valid": len(violations) == 0,
        "violations": violations,
    }
