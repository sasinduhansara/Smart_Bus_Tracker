from flask import Blueprint, jsonify

from services.route_service import (
    get_all_routes,
    get_route_details,
    get_route_stops,
    route_to_summary,
)


route_bp = Blueprint("route_bp", __name__)


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
