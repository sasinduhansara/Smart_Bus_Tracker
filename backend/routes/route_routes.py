from flask import Blueprint, jsonify, request

from services.route_service import (
    DEFAULT_SEARCH_LIMIT,
    MAX_SEARCH_LIMIT,
    MAX_SEARCH_QUERY_LENGTH,
    get_all_routes,
    get_route_details,
    get_route_stops,
    route_to_summary,
    search_routes_and_stops,
)


route_bp = Blueprint("route_bp", __name__)


def _search_validation_error(message, query):
    return jsonify({
        "status": "error",
        "query": query,
        "results": [],
        "error": message,
    }), 400


@route_bp.route("/api/search", methods=["GET"])
def search_routes():
    query = (request.args.get("q") or "").strip()

    if not query:
        return _search_validation_error(
            "q must be a non-empty search query.",
            query,
        )

    if len(query) > MAX_SEARCH_QUERY_LENGTH:
        return _search_validation_error(
            f"q must be {MAX_SEARCH_QUERY_LENGTH} characters or fewer.",
            query,
        )

    raw_limit = request.args.get("limit")

    if raw_limit is None:
        limit = DEFAULT_SEARCH_LIMIT
    else:
        try:
            limit = int(raw_limit)
        except (TypeError, ValueError):
            return _search_validation_error(
                "limit must be an integer between 1 and 25.",
                query,
            )

        if limit < 1 or limit > MAX_SEARCH_LIMIT:
            return _search_validation_error(
                "limit must be an integer between 1 and 25.",
                query,
            )

    return jsonify({
        "status": "success",
        "query": query,
        "results": search_routes_and_stops(query, limit),
    })


@route_bp.route("/api/routes", methods=["GET"])
def list_routes():
    routes = [
        route_to_summary(route)
        for route in get_all_routes()
    ]

    return jsonify({
        "status": "success",
        "routes": routes,
    })


@route_bp.route("/api/routes/<route_number>", methods=["GET"])
def get_route(route_number):
    route = get_route_details(route_number)

    if route is None:
        return jsonify({
            "error": "Route was not found.",
        }), 404

    return jsonify({
        "status": "success",
        "route": route,
    })


@route_bp.route("/api/routes/<route_number>/stops", methods=["GET"])
def list_route_stops(route_number):
    stops = get_route_stops(route_number)

    if stops is None:
        return jsonify({
            "error": "Route was not found.",
        }), 404

    return jsonify({
        "status": "success",
        "routeNumber": route_number,
        "stops": stops,
    })
