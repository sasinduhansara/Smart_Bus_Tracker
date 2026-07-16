from typing import Any, Literal, TypedDict

from pymongo.errors import PyMongoError

from config import routes_collection
from data.route_data import DEVELOPMENT_ROUTES


class RoutePoint(TypedDict):
    latitude: float
    longitude: float


class BusStop(RoutePoint):
    id: str
    name: str
    sequence: int


class RouteDetails(TypedDict):
    routeNumber: str
    name: str
    direction: str
    polyline: list[RoutePoint]
    stops: list[BusStop]


class RouteSummary(TypedDict):
    routeNumber: str
    name: str
    direction: str
    stopCount: int


class PassengerSearchResultBase(TypedDict):
    id: str
    type: Literal["route", "stop"]
    title: str
    subtitle: str
    routeNumber: str


class PassengerSearchResult(PassengerSearchResultBase, total=False):
    stopId: str


DEFAULT_SEARCH_LIMIT = 8
MAX_SEARCH_LIMIT = 25
MAX_SEARCH_QUERY_LENGTH = 80


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


def _normalize_point(value: Any) -> RoutePoint | None:
    if not isinstance(value, dict):
        return None

    latitude = _parse_float(value.get("latitude"), -90, 90)
    longitude = _parse_float(value.get("longitude"), -180, 180)

    if latitude is None or longitude is None:
        return None

    return {
        "latitude": latitude,
        "longitude": longitude,
    }


def _normalize_stop(value: Any) -> BusStop | None:
    point = _normalize_point(value)

    if point is None or not isinstance(value, dict):
        return None

    stop_id = str(value.get("id") or value.get("_id") or "").strip()
    name = str(value.get("name") or "").strip()

    if not stop_id or not name:
        return None

    try:
        sequence = int(value.get("sequence"))
    except (TypeError, ValueError):
        return None

    return {
        "id": stop_id,
        "name": name,
        "latitude": point["latitude"],
        "longitude": point["longitude"],
        "sequence": sequence,
    }


def normalize_route(value: Any) -> RouteDetails | None:
    if not isinstance(value, dict):
        return None

    route_number = str(value.get("routeNumber") or "").strip()
    name = str(value.get("name") or route_number).strip()
    direction = str(value.get("direction") or "outbound").strip()

    if not route_number:
        return None

    polyline = [
        point
        for point in (
            _normalize_point(point)
            for point in value.get("polyline", [])
        )
        if point is not None
    ]

    stops = [
        stop
        for stop in (
            _normalize_stop(stop)
            for stop in value.get("stops", [])
        )
        if stop is not None
    ]

    stops.sort(key=lambda stop: stop["sequence"])

    if len(polyline) < 2 or not stops:
        return None

    return {
        "routeNumber": route_number,
        "name": name,
        "direction": direction,
        "polyline": polyline,
        "stops": stops,
    }


def _load_routes_from_database() -> list[RouteDetails]:
    try:
        records = routes_collection.find(
            {},
            {
                "_id": 0,
                "routeNumber": 1,
                "name": 1,
                "direction": 1,
                "polyline": 1,
                "stops": 1,
            },
        )
    except PyMongoError:
        return []

    try:
        routes = [
            route
            for route in (
                normalize_route(record)
                for record in records
            )
            if route is not None
        ]
    except PyMongoError:
        return []

    return routes


def get_all_routes() -> list[RouteDetails]:
    database_routes = _load_routes_from_database()

    if database_routes:
        return database_routes

    return [
        route
        for route in (
            normalize_route(route)
            for route in DEVELOPMENT_ROUTES
        )
        if route is not None
    ]


def get_route_details(route_number: str) -> RouteDetails | None:
    normalized_route_number = str(route_number or "").strip()

    for route in get_all_routes():
        if route["routeNumber"] == normalized_route_number:
            return route

    return None


def get_route_stops(route_number: str) -> list[BusStop] | None:
    route = get_route_details(route_number)

    if route is None:
        return None

    return route["stops"]


def route_to_summary(route: RouteDetails) -> RouteSummary:
    return {
        "routeNumber": route["routeNumber"],
        "name": route["name"],
        "direction": route["direction"],
        "stopCount": len(route["stops"]),
    }


def search_routes_and_stops(
    query: str,
    limit: int = DEFAULT_SEARCH_LIMIT,
) -> list[PassengerSearchResult]:
    normalized_query = query.strip().casefold()

    if not normalized_query or limit <= 0:
        return []

    result_limit = min(limit, MAX_SEARCH_LIMIT)
    routes = get_all_routes()
    results: list[PassengerSearchResult] = []
    result_ids: set[str] = set()

    for route in routes:
        searchable_route = " ".join((
            route["routeNumber"],
            route["name"],
            route["direction"],
        )).casefold()

        if normalized_query not in searchable_route:
            continue

        result_id = f'route:{route["routeNumber"]}'

        if result_id in result_ids:
            continue

        results.append({
            "id": result_id,
            "type": "route",
            "title": f'Route {route["routeNumber"]}',
            "subtitle": route["name"],
            "routeNumber": route["routeNumber"],
        })
        result_ids.add(result_id)

        if len(results) == result_limit:
            return results

    for route in routes:
        for stop in route["stops"]:
            if normalized_query not in stop["name"].casefold():
                continue

            result_id = (
                f'stop:{route["routeNumber"]}:{stop["id"]}'
            )

            if result_id in result_ids:
                continue

            results.append({
                "id": result_id,
                "type": "stop",
                "title": stop["name"],
                "subtitle": (
                    f'Route {route["routeNumber"]} · {route["name"]}'
                ),
                "routeNumber": route["routeNumber"],
                "stopId": stop["id"],
            })
            result_ids.add(result_id)

            if len(results) == result_limit:
                return results

    return results
