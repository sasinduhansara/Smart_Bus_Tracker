import math
import os
from typing import Any, TypedDict


class RouteMatch(TypedDict):
    rawLatitude: float
    rawLongitude: float
    displayLatitude: float
    displayLongitude: float
    distanceFromRouteMeters: float
    isRouteDeviationCandidate: bool


def _environment_metres(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default

    return value if 1 <= value <= 5000 else default


ROUTE_SNAP_THRESHOLD_METERS = _environment_metres(
    "ROUTE_SNAP_THRESHOLD_METERS",
    75,
)
ROUTE_DEVIATION_THRESHOLD_METERS = _environment_metres(
    "ROUTE_DEVIATION_THRESHOLD_METERS",
    100,
)
ROUTE_DEVIATION_CONFIRMATION_COUNT = 3


def _local_xy(
    latitude: float,
    longitude: float,
    reference_latitude: float,
) -> tuple[float, float]:
    latitude_metres = 110_540
    longitude_metres = 111_320 * math.cos(math.radians(reference_latitude))
    return longitude * longitude_metres, latitude * latitude_metres


def _coordinate_from_xy(
    x: float,
    y: float,
    reference_latitude: float,
) -> tuple[float, float]:
    latitude_metres = 110_540
    longitude_metres = 111_320 * math.cos(math.radians(reference_latitude))
    return y / latitude_metres, x / longitude_metres


from services.osrm_service import snap_gps_to_route

def match_location_to_route(
    latitude: float,
    longitude: float,
    polyline: list[dict[str, Any]],
    geometry: dict[str, Any] | None = None,
    snap_threshold_meters: float = ROUTE_SNAP_THRESHOLD_METERS,
) -> RouteMatch:
    """Project GPS onto the nearest route segment without replacing raw truth."""

    best_distance = float("inf")
    best_latitude = latitude
    best_longitude = longitude
    point_x, point_y = _local_xy(latitude, longitude, latitude)

    # If GeoJSON geometry is available, use the new OSM service
    if geometry and geometry.get("type") == "LineString":
        snap_result = snap_gps_to_route(latitude, longitude, geometry)
        best_distance = snap_result["distanceFromRouteMeters"]
        best_latitude = snap_result["snappedLat"]
        best_longitude = snap_result["snappedLng"]
    else:
        # Fallback to local planar projection over legacy polyline
        for index in range(len(polyline) - 1):
            start = polyline[index]
            end = polyline[index + 1]
            try:
                start_latitude = float(start["latitude"])
                start_longitude = float(start["longitude"])
                end_latitude = float(end["latitude"])
                end_longitude = float(end["longitude"])
            except (KeyError, TypeError, ValueError):
                continue
    
            start_x, start_y = _local_xy(
                start_latitude,
                start_longitude,
                latitude,
            )
            end_x, end_y = _local_xy(
                end_latitude,
                end_longitude,
                latitude,
            )
            segment_x = end_x - start_x
            segment_y = end_y - start_y
            segment_length_squared = segment_x**2 + segment_y**2
            projection = (
                ((point_x - start_x) * segment_x + (point_y - start_y) * segment_y)
                / segment_length_squared
                if segment_length_squared > 0
                else 0
            )
            projection = min(max(projection, 0), 1)
            snapped_x = start_x + projection * segment_x
            snapped_y = start_y + projection * segment_y
            distance = math.hypot(point_x - snapped_x, point_y - snapped_y)
    
            if distance < best_distance:
                best_distance = distance
                best_latitude, best_longitude = _coordinate_from_xy(
                    snapped_x,
                    snapped_y,
                    latitude,
                )
    
        if not math.isfinite(best_distance):
            best_distance = 0
            best_latitude = latitude
            best_longitude = longitude

    should_snap = best_distance <= snap_threshold_meters
    return {
        "rawLatitude": latitude,
        "rawLongitude": longitude,
        "displayLatitude": best_latitude if should_snap else latitude,
        "displayLongitude": best_longitude if should_snap else longitude,
        "distanceFromRouteMeters": round(best_distance, 1),
        "isRouteDeviationCandidate": (
            best_distance > ROUTE_DEVIATION_THRESHOLD_METERS
        ),
    }

def find_next_stop(
    latitude: float,
    longitude: float,
    stops: list[dict[str, Any]],
    current_sequence: int = 1,
) -> dict[str, Any] | None:
    """Find the next stop the bus is approaching."""
    if not stops:
        return None

    # Sort stops by sequence
    sorted_stops = sorted(stops, key=lambda s: s.get("sequence", 0))
    
    # Filter for stops at or after current sequence
    remaining_stops = [s for s in sorted_stops if s.get("sequence", 0) >= current_sequence]
    if not remaining_stops:
        return None

    next_stop = remaining_stops[0]
    
    # Check if we've arrived at next_stop (within geofence)
    # Support both GeoJSON and legacy coords
    loc = next_stop.get("location") or {}
    coords = loc.get("coordinates")
    if coords and len(coords) == 2:
        s_lng, s_lat = float(coords[0]), float(coords[1])
    elif "latitude" in next_stop and "longitude" in next_stop:
        s_lat = float(next_stop["latitude"])
        s_lng = float(next_stop["longitude"])
    else:
        return next_stop # Can't verify distance, just return it
        
    # Calculate distance using local_xy for simplicity
    p_x, p_y = _local_xy(latitude, longitude, latitude)
    s_x, s_y = _local_xy(s_lat, s_lng, latitude)
    distance = math.hypot(p_x - s_x, p_y - s_y)
    
    # If we are within the departure radius, we have already visited this stop,
    # so the next stop is the one after it.
    departure_radius = float(next_stop.get("departureGeofenceRadiusMeters", 50))
    if distance <= departure_radius and len(remaining_stops) > 1:
        return remaining_stops[1]
        
    return next_stop

