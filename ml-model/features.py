"""
features.py – Gamana.lk ETA Model Feature Engineering (v2)

Builds a 25-feature vector from raw GPS, route, and trip data stored in
MongoDB.  Designed for both offline training (from location_history + trips)
and online inference inside eta_service.py.

Feature groups
--------------
Spatial (5)
  distance_km              Remaining polyline distance to destination stop
  progress_ratio           Fraction of route already completed (0-1)
  bearing_to_stop          Compass bearing from bus to destination (deg)
  stop_index_delta         Remaining number of stops ahead
  route_length_km          Total route length

Kinematic (4)
  current_speed_kmh        Bus GPS speed (clamped 0-120 km/h)
  speed_ewma_kmh           Exponentially-weighted moving average of speed
  is_stopped               Binary: speed < 3 km/h
  acceleration_kmh_s       (speed_t – speed_{t-1}) / Δt

Temporal (6)
  hour_of_day              0-23 (Sri Lanka local time)
  minute_of_hour           0-59
  day_of_week              0=Mon…6=Sun
  is_weekend               Binary
  is_peak_morning          Binary: weekday 07:00-09:00
  is_peak_evening          Binary: weekday 16:00-19:00

Traffic (3)
  traffic_level            Heuristic 0.0-1.0
  congestion_zone          0=rural 1=suburban 2=urban (from route metadata)
  road_density_score       Normalised road count within 1 km (0-1, from OSM cache)

Weather proxy (2)
  is_rainy_period          Binary heuristic (monsoon months May-Oct)
  rain_hour_proxy          1 if rainy_period AND evening peak else 0

Route context (5)
  is_express               Binary flag from route.serviceCategories
  is_ac                    Binary flag
  stop_spacing_km          Average distance between consecutive stops
  terminal_radius_m        Start terminal geofence radius
  total_stop_count         Total stops on route
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Sequence

SRI_LANKA_TZ = timezone(timedelta(hours=5, minutes=30))
MONSOON_MONTHS = {5, 6, 7, 8, 9, 10}  # May–October

# ----- Ordered feature list (must match eta_service.FEATURE_ORDER when migrating) -----
FEATURE_NAMES_V2: list[str] = [
    # Spatial
    "distance_km",
    "progress_ratio",
    "bearing_to_stop",
    "stop_index_delta",
    "route_length_km",
    # Kinematic
    "current_speed_kmh",
    "speed_ewma_kmh",
    "is_stopped",
    "acceleration_kmh_s",
    # Temporal
    "hour_of_day",
    "minute_of_hour",
    "day_of_week",
    "is_weekend",
    "is_peak_morning",
    "is_peak_evening",
    # Traffic
    "traffic_level",
    "congestion_zone",
    "road_density_score",
    # Weather proxy
    "is_rainy_period",
    "rain_hour_proxy",
    # Route context
    "is_express",
    "is_ac",
    "stop_spacing_km",
    "terminal_radius_m",
    "total_stop_count",
]

assert len(FEATURE_NAMES_V2) == 25, "Expected 25 features"


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _haversine_km(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat_a), math.radians(lat_b)
    Δφ = math.radians(lat_b - lat_a)
    Δλ = math.radians(lng_b - lng_a)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    """True bearing from A to B in degrees [0, 360)."""
    φ1 = math.radians(lat_a)
    φ2 = math.radians(lat_b)
    Δλ = math.radians(lng_b - lng_a)
    x = math.sin(Δλ) * math.cos(φ2)
    y = math.cos(φ1) * math.sin(φ2) - math.sin(φ1) * math.cos(φ2) * math.cos(Δλ)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _polyline_length_km(polyline: list[dict[str, float]]) -> float:
    total = 0.0
    for i in range(len(polyline) - 1):
        total += _haversine_km(
            polyline[i]["latitude"], polyline[i]["longitude"],
            polyline[i + 1]["latitude"], polyline[i + 1]["longitude"],
        )
    return total


def _closest_index(lat: float, lng: float, polyline: list[dict[str, float]]) -> int:
    best_idx, best_d = 0, float("inf")
    for i, pt in enumerate(polyline):
        d = _haversine_km(lat, lng, pt["latitude"], pt["longitude"])
        if d < best_d:
            best_d, best_idx = d, i
    return best_idx


def _distance_along(polyline: list[dict[str, float]], i: int, j: int) -> float:
    if j <= i:
        return 0.0
    return sum(
        _haversine_km(
            polyline[k]["latitude"], polyline[k]["longitude"],
            polyline[k + 1]["latitude"], polyline[k + 1]["longitude"],
        )
        for k in range(i, j)
    )


def _traffic_level(dt_local: datetime) -> float:
    h, wd = dt_local.hour, dt_local.weekday()
    is_wknd = wd >= 5
    if not is_wknd and (7 <= h <= 9 or 16 <= h <= 19):
        return 0.8
    if not is_wknd and 10 <= h <= 15:
        return 0.45
    return 0.15


# ---------------------------------------------------------------------------
# Public builder
# ---------------------------------------------------------------------------

def build_feature_vector(
    *,
    bus_lat: float,
    bus_lng: float,
    bus_speed_kmh: float,
    bus_heading: float,
    prev_speed_kmh: float | None,
    prev_timestamp: datetime | None,
    current_timestamp: datetime,
    destination_lat: float,
    destination_lng: float,
    route_polyline: list[dict[str, float]],
    route_stops: list[dict[str, Any]],
    route_metadata: dict[str, Any],
    speed_ewma: float | None = None,
) -> dict[str, float | int]:
    """
    Build the full v2 feature dict for training or inference.

    Parameters
    ----------
    bus_lat / bus_lng           Current GPS position.
    bus_speed_kmh               Speed from GPS (km/h).
    bus_heading                 Compass heading (degrees).
    prev_speed_kmh              Speed at previous GPS sample (for acceleration).
    prev_timestamp              Datetime of previous sample (for acceleration).
    current_timestamp           Datetime of this GPS sample (UTC).
    destination_lat/lng         Coordinates of the destination stop.
    route_polyline              Ordered list of {latitude, longitude} dicts.
    route_stops                 Ordered list of stop dicts.
    route_metadata              Full route document or dict from route_service.
    speed_ewma                  Running exponential weighted average of speed
                                (caller maintained; None to derive from
                                current speed).
    """

    # --- Derived timestamps ---
    local = current_timestamp.astimezone(SRI_LANKA_TZ)
    h, m, wd = local.hour, local.minute, local.weekday()
    is_wknd = int(wd >= 5)
    is_peak_morning = int(not is_wknd and 7 <= h <= 9)
    is_peak_evening = int(not is_wknd and 16 <= h <= 19)
    is_monsoon = int(local.month in MONSOON_MONTHS)
    rain_hour_proxy = int(bool(is_monsoon and is_peak_evening))

    # --- Route geometry ---
    n_pts = len(route_polyline)
    route_length_km = _polyline_length_km(route_polyline) if n_pts >= 2 else 0.0

    bus_idx = _closest_index(bus_lat, bus_lng, route_polyline) if n_pts else 0
    dst_idx = _closest_index(destination_lat, destination_lng, route_polyline) if n_pts else 0

    dist_covered_km = _distance_along(route_polyline, 0, bus_idx)
    dist_remaining_km = _distance_along(route_polyline, bus_idx, dst_idx)
    # Fall back to direct haversine when polyline is missing/short
    if dist_remaining_km <= 0:
        dist_remaining_km = _haversine_km(bus_lat, bus_lng, destination_lat, destination_lng)

    progress_ratio = (
        dist_covered_km / route_length_km if route_length_km > 0 else 0.0
    )
    progress_ratio = max(0.0, min(1.0, progress_ratio))

    # --- Stops ahead ---
    stop_index_delta = 0
    for stop in route_stops:
        stop_lat = float(stop.get("latitude") or stop.get("lat") or 0)
        stop_lng = float(stop.get("longitude") or stop.get("lng") or 0)
        if stop_lat == 0 and stop_lng == 0:
            continue
        si = _closest_index(stop_lat, stop_lng, route_polyline)
        if si >= bus_idx:
            stop_index_delta += 1

    # --- Kinematic ---
    speed = max(0.0, min(bus_speed_kmh, 120.0))
    is_stopped = int(speed < 3.0)
    ewma = speed if speed_ewma is None else speed_ewma

    acceleration = 0.0
    if prev_speed_kmh is not None and prev_timestamp is not None:
        delta_t = (current_timestamp - prev_timestamp).total_seconds()
        if delta_t > 0:
            acceleration = (bus_speed_kmh - prev_speed_kmh) / delta_t  # km/h/s

    # --- Bearing ---
    bearing = _bearing(bus_lat, bus_lng, destination_lat, destination_lng)

    # --- Traffic ---
    traffic = _traffic_level(local)

    # --- Route metadata ---
    categories = route_metadata.get("serviceCategories") or []
    is_express = int("intercity" in categories or "express" in categories)
    is_ac = int("ac" in categories)

    n_stops = len(route_stops)
    stop_spacing_km = (route_length_km / max(n_stops - 1, 1)) if n_stops >= 2 else 1.0

    terminal_radius = float(
        route_metadata.get("terminalRadiusMeters")
        or route_metadata.get("terminalRadius")
        or 500.0
    )

    # --- Congestion zone / road density (heuristic) ---
    # Future: use OSM Overpass data. For now: urban if route length < 25 km
    if route_length_km < 10:
        congestion_zone = 2
    elif route_length_km < 40:
        congestion_zone = 1
    else:
        congestion_zone = 0
    road_density_score = round(1.0 - (route_length_km / 200.0), 3)
    road_density_score = max(0.0, min(1.0, road_density_score))

    return {
        # Spatial
        "distance_km": round(max(0.1, dist_remaining_km), 4),
        "progress_ratio": round(progress_ratio, 4),
        "bearing_to_stop": round(bearing, 2),
        "stop_index_delta": stop_index_delta,
        "route_length_km": round(route_length_km, 3),
        # Kinematic
        "current_speed_kmh": round(speed, 2),
        "speed_ewma_kmh": round(ewma, 2),
        "is_stopped": is_stopped,
        "acceleration_kmh_s": round(acceleration, 4),
        # Temporal
        "hour_of_day": h,
        "minute_of_hour": m,
        "day_of_week": wd,
        "is_weekend": is_wknd,
        "is_peak_morning": is_peak_morning,
        "is_peak_evening": is_peak_evening,
        # Traffic
        "traffic_level": round(traffic, 3),
        "congestion_zone": congestion_zone,
        "road_density_score": road_density_score,
        # Weather proxy
        "is_rainy_period": is_monsoon,
        "rain_hour_proxy": rain_hour_proxy,
        # Route context
        "is_express": is_express,
        "is_ac": is_ac,
        "stop_spacing_km": round(stop_spacing_km, 4),
        "terminal_radius_m": round(terminal_radius, 1),
        "total_stop_count": n_stops,
    }
