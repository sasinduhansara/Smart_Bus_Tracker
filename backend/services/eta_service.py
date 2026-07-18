import math
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict

import pandas as pd

from config import buses_collection, eta_model
from services.route_service import (
    BusStop,
    RouteDetails,
    RoutePoint,
    get_route_details,
)


FEATURE_ORDER = [
    "distance_km",
    "current_speed_kmh",
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "traffic_level",
]

MODEL_VERSION = "random-forest-regressor-v1"
SRI_LANKA_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


class EtaPredictionError(Exception):
    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class EtaPredictionRequest(TypedDict):
    busId: str
    routeNumber: str
    destinationStopId: str


def _parse_float(value: Any, minimum: float, maximum: float) -> float | None:
    if isinstance(value, bool):
        return None

    try:
        parsed_value = float(value)
    except (TypeError, ValueError):
        return None

    if minimum <= parsed_value <= maximum:
        return parsed_value

    return None


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc)

    if isinstance(value, str):
        normalized_value = value.replace("Z", "+00:00")

        try:
            parsed_value = datetime.fromisoformat(normalized_value)
        except ValueError:
            return None

        if parsed_value.tzinfo is None:
            return parsed_value.replace(tzinfo=timezone.utc)

        return parsed_value.astimezone(timezone.utc)

    return None


def haversine_km(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    earth_radius_km = 6371.0
    delta_latitude = math.radians(latitude_b - latitude_a)
    delta_longitude = math.radians(longitude_b - longitude_a)
    start_latitude = math.radians(latitude_a)
    end_latitude = math.radians(latitude_b)

    haversine_value = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(start_latitude)
        * math.cos(end_latitude)
        * math.sin(delta_longitude / 2) ** 2
    )

    central_angle = 2 * math.atan2(
        math.sqrt(haversine_value),
        math.sqrt(1 - haversine_value),
    )

    return earth_radius_km * central_angle


def _closest_polyline_index(
    latitude: float,
    longitude: float,
    polyline: list[RoutePoint],
) -> int:
    closest_index = 0
    closest_distance = float("inf")

    for index, point in enumerate(polyline):
        distance = haversine_km(
            latitude,
            longitude,
            point["latitude"],
            point["longitude"],
        )

        if distance < closest_distance:
            closest_distance = distance
            closest_index = index

    return closest_index


def _distance_along_polyline(
    polyline: list[RoutePoint],
    start_index: int,
    end_index: int,
) -> float:
    if end_index <= start_index:
        return 0.0

    distance = 0.0

    for index in range(start_index, end_index):
        start = polyline[index]
        end = polyline[index + 1]
        distance += haversine_km(
            start["latitude"],
            start["longitude"],
            end["latitude"],
            end["longitude"],
        )

    return distance


def calculate_remaining_distance_km(
    bus_latitude: float,
    bus_longitude: float,
    destination_stop: BusStop,
    route: RouteDetails,
) -> float:
    polyline = route["polyline"]
    bus_index = _closest_polyline_index(
        bus_latitude,
        bus_longitude,
        polyline,
    )
    destination_index = _closest_polyline_index(
        destination_stop["latitude"],
        destination_stop["longitude"],
        polyline,
    )

    if destination_index < bus_index:
        return haversine_km(
            bus_latitude,
            bus_longitude,
            destination_stop["latitude"],
            destination_stop["longitude"],
        )

    bus_snap_point = polyline[bus_index]
    destination_snap_point = polyline[destination_index]

    return (
        haversine_km(
            bus_latitude,
            bus_longitude,
            bus_snap_point["latitude"],
            bus_snap_point["longitude"],
        )
        + _distance_along_polyline(
            polyline,
            bus_index,
            destination_index,
        )
        + haversine_km(
            destination_snap_point["latitude"],
            destination_snap_point["longitude"],
            destination_stop["latitude"],
            destination_stop["longitude"],
        )
    )


def find_next_stop(
    bus_latitude: float,
    bus_longitude: float,
    route: RouteDetails,
) -> BusStop | None:
    bus_index = _closest_polyline_index(
        bus_latitude,
        bus_longitude,
        route["polyline"],
    )

    for stop in route["stops"]:
        stop_index = _closest_polyline_index(
            stop["latitude"],
            stop["longitude"],
            route["polyline"],
        )

        if stop_index >= bus_index:
            return stop

    return route["stops"][-1] if route["stops"] else None


def estimate_traffic_level(now: datetime) -> float:
    local_time = now.astimezone(SRI_LANKA_TIMEZONE)
    hour = local_time.hour
    weekday = local_time.weekday()
    is_weekend = weekday >= 5

    if not is_weekend and (7 <= hour <= 9 or 16 <= hour <= 19):
        return 0.8

    if not is_weekend and 10 <= hour <= 15:
        return 0.45

    return 0.15


def _get_destination_stop(
    route: RouteDetails,
    destination_stop_id: str,
) -> BusStop | None:
    for stop in route["stops"]:
        if stop["id"] == destination_stop_id:
            return stop

    return None


def _validate_model() -> None:
    if eta_model is None:
        raise EtaPredictionError(
            "ETA model is not available.",
            500,
        )

    feature_names = list(getattr(eta_model, "feature_names_in_", []))

    if feature_names and feature_names != FEATURE_ORDER:
        raise EtaPredictionError(
            "ETA model feature order does not match the backend preprocessing.",
            500,
        )


def _build_model_features(
    remaining_distance_km: float,
    current_speed_kmh: float,
    now: datetime,
) -> dict[str, float | int]:
    local_time = now.astimezone(SRI_LANKA_TIMEZONE)
    weekday = local_time.weekday()

    return {
        "distance_km": round(
            min(max(remaining_distance_km, 0.5), 15.0),
            3,
        ),
        "current_speed_kmh": round(
            min(max(current_speed_kmh, 3.0), 80.0),
            2,
        ),
        "hour_of_day": local_time.hour,
        "day_of_week": weekday,
        "is_weekend": 1 if weekday >= 5 else 0,
        "traffic_level": estimate_traffic_level(now),
    }


def build_eta_prediction(
    request_data: dict[str, Any],
) -> dict[str, Any]:
    bus_id = str(request_data.get("busId") or "").strip()
    requested_route_number = str(
        request_data.get("routeNumber") or "",
    ).strip()
    destination_stop_id = str(
        request_data.get("destinationStopId") or "",
    ).strip()

    if not bus_id or not destination_stop_id:
        raise EtaPredictionError(
            "busId and destinationStopId are required.",
            400,
        )

    _validate_model()

    bus = buses_collection.find_one(
        {
            "bus_id": bus_id,
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
            "updatedAt": 1,
            "operationalStatus": 1,
            "isActive": 1,
        },
    )

    if not bus:
        raise EtaPredictionError(
            "Bus was not found.",
            404,
        )

    operational_status = str(
        bus.get("operationalStatus") or ""
    ).strip().lower()
    if (
        operational_status
        and operational_status != "active"
    ) or bus.get("isActive") is False:
        raise EtaPredictionError(
            "The selected bus is not running an active trip.",
            409,
        )

    bus_route_number = str(bus.get("routeNumber") or "").strip()

    if (
        requested_route_number
        and bus_route_number
        and requested_route_number != bus_route_number
    ):
        raise EtaPredictionError(
            "The selected bus does not belong to the requested route.",
            409,
        )

    effective_route_number = bus_route_number or requested_route_number

    if not effective_route_number:
        raise EtaPredictionError(
            "The selected bus does not have an assigned route.",
            409,
        )

    route = get_route_details(effective_route_number)

    if route is None:
        raise EtaPredictionError(
            "Route was not found.",
            404,
        )

    destination_stop = _get_destination_stop(
        route,
        destination_stop_id,
    )

    if destination_stop is None:
        raise EtaPredictionError(
            "Destination stop was not found on the selected route.",
            404,
        )

    latitude = _parse_float(bus.get("lat"), -90, 90)
    longitude = _parse_float(bus.get("lng"), -180, 180)

    if latitude is None or longitude is None:
        raise EtaPredictionError(
            "The selected bus does not have a valid current location.",
            409,
        )

    updated_at = _parse_datetime(bus.get("updatedAt"))

    if updated_at is None:
        raise EtaPredictionError(
            "The selected bus location does not have a valid timestamp.",
            409,
        )

    now = datetime.now(timezone.utc)
    age_seconds = (now - updated_at).total_seconds()

    if age_seconds > 120:
        raise EtaPredictionError(
            "The selected bus is offline. Wait for a fresh GPS update.",
            409,
        )

    if age_seconds < -30:
        raise EtaPredictionError(
            "The selected bus location timestamp is in the future.",
            409,
        )

    speed = _parse_float(bus.get("speed"), 0, 200)
    current_speed_kmh = speed if speed and speed > 0 else 25.0

    remaining_distance_km = calculate_remaining_distance_km(
        latitude,
        longitude,
        destination_stop,
        route,
    )

    features = _build_model_features(
        remaining_distance_km,
        current_speed_kmh,
        now,
    )
    feature_frame = pd.DataFrame(
        [{feature: features[feature] for feature in FEATURE_ORDER}],
    )
    prediction = float(eta_model.predict(feature_frame)[0])

    if not math.isfinite(prediction) or prediction < 0:
        raise EtaPredictionError(
            "ETA model returned an invalid prediction.",
            500,
        )

    eta_minutes = round(prediction, 2)
    arrival_time = (
        now.astimezone(SRI_LANKA_TIMEZONE)
        + timedelta(minutes=eta_minutes)
    )
    next_stop = find_next_stop(
        latitude,
        longitude,
        route,
    )

    return {
        "status": "success",
        "busId": bus_id,
        "routeNumber": effective_route_number,
        "destinationStop": {
            "id": destination_stop["id"],
            "name": destination_stop["name"],
        },
        "nextStop": (
            {
                "id": next_stop["id"],
                "name": next_stop["name"],
            }
            if next_stop
            else None
        ),
        "etaMinutes": eta_minutes,
        "estimatedArrivalAt": arrival_time.isoformat(),
        "remainingDistanceKm": round(remaining_distance_km, 2),
        "modelVersion": MODEL_VERSION,
    }
