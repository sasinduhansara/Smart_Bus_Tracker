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


def match_location_to_route(
    latitude: float,
    longitude: float,
    polyline: list[dict[str, Any]],
    snap_threshold_meters: float = ROUTE_SNAP_THRESHOLD_METERS,
) -> RouteMatch:
    """Project GPS onto the nearest route segment without replacing raw truth."""

    best_distance = float("inf")
    best_latitude = latitude
    best_longitude = longitude
    point_x, point_y = _local_xy(latitude, longitude, latitude)

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
