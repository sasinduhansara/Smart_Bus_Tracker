from __future__ import annotations

import json
import math
import os
import re
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_PHOTON_BASE_URL = "https://photon.komoot.io"
DEFAULT_PHOTON_TIMEOUT_SECONDS = 12.0
DEFAULT_OVERPASS_TIMEOUT_SECONDS = 7.0

DEFAULT_OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)

SRI_LANKA_BBOX = "79.4,5.7,82.1,10.1"
SRI_LANKA_CENTRE_LAT = 7.8731
SRI_LANKA_CENTRE_LON = 80.7718


BUS_LOCATION_CACHE_TTL_SECONDS = 86_400.0

_BUS_LOCATION_CACHE: dict[
    tuple[str, int, int],
    tuple[float, list[dict[str, Any]]],
] = {}


def _copy_results(
    results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return [dict(result) for result in results]


def _get_cached_bus_locations(
    cache_key: tuple[str, int, int],
) -> list[dict[str, Any]] | None:
    cached = _BUS_LOCATION_CACHE.get(cache_key)

    if cached is None:
        return None

    cached_at, results = cached

    if time.monotonic() - cached_at > BUS_LOCATION_CACHE_TTL_SECONDS:
        _BUS_LOCATION_CACHE.pop(cache_key, None)
        return None

    return _copy_results(results)


def _cache_bus_locations(
    cache_key: tuple[str, int, int],
    results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    copied_results = _copy_results(results)

    _BUS_LOCATION_CACHE[cache_key] = (
        time.monotonic(),
        copied_results,
    )

    # Prevent unlimited memory growth.
    if len(_BUS_LOCATION_CACHE) > 250:
        oldest_key = min(
            _BUS_LOCATION_CACHE,
            key=lambda key: _BUS_LOCATION_CACHE[key][0],
        )
        _BUS_LOCATION_CACHE.pop(oldest_key, None)

    return _copy_results(copied_results)


class GeocodingServiceError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "GEOCODING_ERROR",
        status: int = 502,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _environment_timeout(
    name: str,
    default: float,
    *,
    maximum: float,
) -> float:
    raw_value = os.getenv(name, str(default))

    try:
        timeout = float(raw_value)
    except (TypeError, ValueError):
        return default

    return timeout if 1 <= timeout <= maximum else default


def _clean_text(value: Any, *, max_length: int = 200) -> str:
    return str(value or "").strip()[:max_length]


def _finite_coordinate(
    value: Any,
    *,
    minimum: float,
    maximum: float,
) -> float | None:
    if isinstance(value, bool):
        return None

    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(parsed) or not minimum <= parsed <= maximum:
        return None

    return parsed


def _display_address(properties: dict[str, Any]) -> str:
    values = [
        properties.get("street"),
        properties.get("district"),
        properties.get("city"),
        properties.get("county"),
        properties.get("state"),
        properties.get("postcode"),
        properties.get("country"),
    ]

    parts: list[str] = []

    for value in values:
        cleaned = _clean_text(value)

        if cleaned and cleaned.casefold() not in {
            item.casefold() for item in parts
        }:
            parts.append(cleaned)

    return ", ".join(parts)


def _normalize_photon_feature(
    feature: Any,
    *,
    index: int,
) -> dict[str, Any] | None:
    if not isinstance(feature, dict):
        return None

    geometry = feature.get("geometry")
    properties = feature.get("properties")

    if not isinstance(geometry, dict) or not isinstance(properties, dict):
        return None

    coordinates = geometry.get("coordinates")

    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return None

    longitude = _finite_coordinate(
        coordinates[0],
        minimum=-180,
        maximum=180,
    )
    latitude = _finite_coordinate(
        coordinates[1],
        minimum=-90,
        maximum=90,
    )

    if latitude is None or longitude is None:
        return None

    name = _clean_text(
        properties.get("name")
        or properties.get("city")
        or properties.get("district")
        or properties.get("county")
    )

    if not name:
        return None

    osm_type = _clean_text(properties.get("osm_type"), max_length=20)
    osm_id = _clean_text(properties.get("osm_id"), max_length=60)

    result_id = (
        f"{osm_type}:{osm_id}"
        if osm_type and osm_id
        else f"photon:{index}:{latitude:.6f}:{longitude:.6f}"
    )

    subtitle = _display_address(properties)

    return {
        "id": result_id,
        "provider": "photon",
        "name": name,
        "label": name if not subtitle else f"{name}, {subtitle}",
        "subtitle": subtitle,
        "latitude": latitude,
        "longitude": longitude,
        "country": _clean_text(properties.get("country")),
        "countryCode": _clean_text(
            properties.get("countrycode")
        ).upper(),
        "state": _clean_text(properties.get("state")),
        "county": _clean_text(properties.get("county")),
        "city": _clean_text(properties.get("city")),
        "district": _clean_text(properties.get("district")),
        "osmKey": _clean_text(properties.get("osm_key")),
        "osmValue": _clean_text(properties.get("osm_value")),
    }


def _photon_request(params: dict[str, Any]) -> dict[str, Any]:
    base_url = os.getenv(
        "PHOTON_BASE_URL",
        DEFAULT_PHOTON_BASE_URL,
    ).strip().rstrip("/")

    url = f"{base_url}/api?{urlencode(params, doseq=True)}"

    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Gamana-Smart-Bus-Tracker/0.1",
        },
        method="GET",
    )

    timeout = _environment_timeout(
        "PHOTON_TIMEOUT_SECONDS",
        DEFAULT_PHOTON_TIMEOUT_SECONDS,
        maximum=60,
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            raw_body = response.read().decode("utf-8")
    except HTTPError as error:
        raise GeocodingServiceError(
            f"Photon returned HTTP {error.code}",
            code="GEOCODING_PROVIDER_HTTP_ERROR",
            status=502,
        ) from error
    except URLError as error:
        raise GeocodingServiceError(
            f"Could not connect to Photon: {error.reason}",
            code="GEOCODING_PROVIDER_UNAVAILABLE",
            status=503,
        ) from error
    except TimeoutError as error:
        raise GeocodingServiceError(
            "Photon request timed out",
            code="GEOCODING_PROVIDER_TIMEOUT",
            status=504,
        ) from error

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise GeocodingServiceError(
            "Photon returned invalid JSON",
            code="INVALID_GEOCODING_RESPONSE",
            status=502,
        ) from error

    if not isinstance(payload, dict):
        raise GeocodingServiceError(
            "Photon returned an invalid response",
            code="INVALID_GEOCODING_RESPONSE",
            status=502,
        )

    return payload


def search_places(
    query: str,
    *,
    limit: int = 6,
) -> list[dict[str, Any]]:
    normalized_query = _clean_text(query, max_length=120)

    if len(normalized_query) < 2:
        raise GeocodingServiceError(
            "Search query must contain at least 2 characters",
            code="INVALID_GEOCODING_QUERY",
            status=400,
        )

    normalized_limit = max(1, min(int(limit), 8))

    payload = _photon_request({
        "q": normalized_query,
        "limit": normalized_limit,
        "lang": "en",
        "countrycode": "LK",
        "bbox": SRI_LANKA_BBOX,
        "lat": SRI_LANKA_CENTRE_LAT,
        "lon": SRI_LANKA_CENTRE_LON,
        "zoom": 7,
        "location_bias_scale": 0.3,
    })

    features = payload.get("features")

    if not isinstance(features, list):
        raise GeocodingServiceError(
            "Photon returned an invalid response",
            code="INVALID_GEOCODING_RESPONSE",
            status=502,
        )

    results: list[dict[str, Any]] = []
    seen: set[tuple[str, float, float]] = set()

    for index, feature in enumerate(features):
        result = _normalize_photon_feature(feature, index=index)

        if result is None:
            continue

        dedupe_key = (
            result["name"].casefold(),
            round(result["latitude"], 5),
            round(result["longitude"], 5),
        )

        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        results.append(result)

        if len(results) >= normalized_limit:
            break

    return results


def _anchor_query(query: str) -> str:
    cleaned = re.sub(
        r"\b(bus\s*stand|bus\s*station|bus\s*terminal|bus\s*stop|depot)\b",
        " ",
        query,
        flags=re.IGNORECASE,
    )

    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or query.strip()


def _select_anchor(
    query: str,
    results: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not results:
        return None

    target = query.casefold().strip()

    return min(
        results,
        key=lambda result: (
            0
            if result["name"].casefold() == target
            else 1
            if result["name"].casefold().startswith(target)
            else 2,
        ),
    )


def _distance_km(
    latitude_1: float,
    longitude_1: float,
    latitude_2: float,
    longitude_2: float,
) -> float:
    earth_radius_km = 6371.0088

    latitude_1_radians = math.radians(latitude_1)
    latitude_2_radians = math.radians(latitude_2)
    latitude_delta = math.radians(latitude_2 - latitude_1)
    longitude_delta = math.radians(longitude_2 - longitude_1)

    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(latitude_1_radians)
        * math.cos(latitude_2_radians)
        * math.sin(longitude_delta / 2) ** 2
    )

    return earth_radius_km * 2 * math.atan2(
        math.sqrt(value),
        math.sqrt(max(1 - value, 0)),
    )


def _bounding_box(
    latitude: float,
    longitude: float,
    radius_meters: int,
) -> tuple[float, float, float, float]:
    latitude_delta = radius_meters / 111_320

    longitude_divisor = (
        111_320 * max(math.cos(math.radians(latitude)), 0.01)
    )
    longitude_delta = radius_meters / longitude_divisor

    return (
        latitude - latitude_delta,
        longitude - longitude_delta,
        latitude + latitude_delta,
        longitude + longitude_delta,
    )


def _overpass_endpoints() -> list[str]:
    configured = os.getenv("OVERPASS_ENDPOINTS", "").strip()

    if configured:
        endpoints = [
            endpoint.strip().rstrip("/")
            for endpoint in configured.split(",")
            if endpoint.strip()
        ]

        if endpoints:
            return endpoints

    return list(DEFAULT_OVERPASS_ENDPOINTS)


def _overpass_request(
    query: str,
) -> dict[str, Any] | None:
    total_timeout = _environment_timeout(
        "OVERPASS_TIMEOUT_SECONDS",
        DEFAULT_OVERPASS_TIMEOUT_SECONDS,
        maximum=20,
    )

    request_body = urlencode({"data": query}).encode("utf-8")
    started_at = time.monotonic()

    for endpoint in _overpass_endpoints():
        elapsed = time.monotonic() - started_at
        remaining = total_timeout - elapsed

        if remaining <= 0:
            break

        request = Request(
            endpoint,
            data=request_body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Gamana-Smart-Bus-Tracker/0.1",
            },
            method="POST",
        )

        try:
            with urlopen(
                request,
                timeout=max(1.0, remaining),
            ) as response:
                payload = json.load(response)

            if isinstance(payload, dict):
                return payload
        except (
            HTTPError,
            URLError,
            TimeoutError,
            OSError,
            json.JSONDecodeError,
        ):
            continue

    return None


def search_bus_locations(
    query: str,
    *,
    limit: int = 8,
    radius_meters: int = 5000,
) -> list[dict[str, Any]]:
    normalized_query = _clean_text(query, max_length=120)

    if len(normalized_query) < 2:
        raise GeocodingServiceError(
            "Search query must contain at least 2 characters",
            code="INVALID_GEOCODING_QUERY",
            status=400,
        )

    normalized_limit = max(1, min(int(limit), 12))
    normalized_radius = max(1000, min(int(radius_meters), 15000))

    cache_key = (
        normalized_query.casefold(),
        normalized_limit,
        normalized_radius,
    )

    cached_results = _get_cached_bus_locations(cache_key)

    if cached_results is not None:
        return cached_results

    town_query = _anchor_query(normalized_query)
    anchor_results = search_places(town_query, limit=5)
    anchor = _select_anchor(town_query, anchor_results)

    if anchor is None:
        return _cache_bus_locations(
            cache_key,
            search_places(
                normalized_query,
                limit=normalized_limit,
            ),
        )

    south, west, north, east = _bounding_box(
        anchor["latitude"],
        anchor["longitude"],
        normalized_radius,
    )

    overpass_query = f"""
[out:json][timeout:20];
(
  nwr({south},{west},{north},{east})
    ["amenity"="bus_station"];

  nwr({south},{west},{north},{east})
    ["public_transport"="station"]
    ["bus"="yes"];

  node({south},{west},{north},{east})
    ["highway"="bus_stop"];
);
out center tags;
"""

    payload = _overpass_request(overpass_query)

    if payload is None:
        return _cache_bus_locations(
            cache_key,
            search_places(
                normalized_query,
                limit=normalized_limit,
            ),
        )

    elements = payload.get("elements")

    if not isinstance(elements, list):
        return _cache_bus_locations(
            cache_key,
            search_places(
                normalized_query,
                limit=normalized_limit,
            ),
        )

    results: list[dict[str, Any]] = []
    seen: set[tuple[float, float, str]] = set()

    for element in elements:
        if not isinstance(element, dict):
            continue

        tags = element.get("tags") or {}

        if not isinstance(tags, dict):
            tags = {}

        latitude = _finite_coordinate(
            element.get("lat"),
            minimum=-90,
            maximum=90,
        )
        longitude = _finite_coordinate(
            element.get("lon"),
            minimum=-180,
            maximum=180,
        )

        if latitude is None or longitude is None:
            center = element.get("center") or {}

            if isinstance(center, dict):
                latitude = _finite_coordinate(
                    center.get("lat"),
                    minimum=-90,
                    maximum=90,
                )
                longitude = _finite_coordinate(
                    center.get("lon"),
                    minimum=-180,
                    maximum=180,
                )

        if latitude is None or longitude is None:
            continue

        name = _clean_text(
            tags.get("name:en")
            or tags.get("name")
            or tags.get("operator")
            or "Unnamed bus stop"
        )

        amenity = _clean_text(tags.get("amenity"))
        highway = _clean_text(tags.get("highway"))
        public_transport = _clean_text(
            tags.get("public_transport")
        )

        if amenity == "bus_station":
            category = "bus_station"
            category_label = "Bus station"
            priority = 0
        elif public_transport == "station":
            category = "bus_station"
            category_label = "Bus station"
            priority = 1
        else:
            category = "bus_stop"
            category_label = "Bus stop"
            priority = 2

        distance = _distance_km(
            anchor["latitude"],
            anchor["longitude"],
            latitude,
            longitude,
        )

        dedupe_key = (
            round(latitude, 6),
            round(longitude, 6),
            name.casefold(),
        )

        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)

        subtitle = (
            f"{category_label} • "
            f"{distance:.2f} km from {anchor['name']}"
        )

        results.append({
            "id": (
                f'{element.get("type", "osm")}:'
                f'{element.get("id", "")}'
            ),
            "provider": "overpass",
            "name": name,
            "label": f"{name}, {subtitle}",
            "subtitle": subtitle,
            "latitude": latitude,
            "longitude": longitude,
            "distanceKm": round(distance, 3),
            "category": category,
            "amenity": amenity,
            "highway": highway,
            "publicTransport": public_transport,
            "_priority": priority,
        })

    results.sort(
        key=lambda result: (
            result["_priority"],
            result["name"] == "Unnamed bus stop",
            result["distanceKm"],
        )
    )

    for result in results:
        result.pop("_priority", None)

    final_results = (
        results[:normalized_limit]
        if results
        else search_places(
            normalized_query,
            limit=normalized_limit,
        )
    )

    return _cache_bus_locations(
        cache_key,
        final_results,
    )
