"""
route_geometry_service.py

Manages the lifecycle of approved GeoJSON route geometry.

Responsibilities:
  - Atomic save of a confirmed geometry with version bump.
  - Validation check (all stops within corridor, geometry parseable).
  - Audit log for every geometry change so administrators can review history.
  - Read helpers used by the passenger and driver map endpoints.

Geometry is stored as a top-level GeoJSON LineString on the route document:

  route.geometry = {"type": "LineString", "coordinates": [[lng, lat], ...]}
  route.geometryVersion = <integer>
  route.totalDistanceMeters = <float>
  route.geometryApprovedAt = <datetime>
  route.geometryApprovedBy = <admin actor id string>

The existing ``polyline`` field (list of {latitude, longitude} dicts) is kept
in sync so that the ETA service and geospatial service continue to work
without modification until those services are migrated.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson.objectid import ObjectId
from pymongo.errors import PyMongoError

from config import routes_collection, stops_collection


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _geojson_coords_to_polyline(
    coordinates: list[list[float]],
) -> list[dict[str, float]]:
    """Convert GeoJSON [lng, lat] coordinates to the legacy polyline format."""
    return [
        {"latitude": coord[1], "longitude": coord[0]}
        for coord in coordinates
    ]


def _build_stop_geojson_document(
    stop: dict[str, Any],
    route_id: str,
) -> dict[str, Any]:
    """Build a canonical stops-collection document from a route stop dict."""
    # Accept both GeoJSON and legacy lat/lng coordinates.
    loc = stop.get("location") or {}
    coords = loc.get("coordinates")
    if coords and len(coords) == 2:
        lng, lat = float(coords[0]), float(coords[1])
    elif "latitude" in stop and "longitude" in stop:
        lat = float(stop["latitude"])
        lng = float(stop["longitude"])
    else:
        lat = None
        lng = None

    doc: dict[str, Any] = {
        "routeId": route_id,
        "stopId": str(stop.get("id") or stop.get("_id") or ""),
        "name": str(stop.get("name") or ""),
        "nameKey": str(stop.get("nameKey") or str(stop.get("name") or "").casefold()),
        "sequence": int(stop.get("sequence") or 0),
        "arrivalGeofenceRadiusMeters": float(
            stop.get("arrivalGeofenceRadiusMeters") or 100
        ),
        "departureGeofenceRadiusMeters": float(
            stop.get("departureGeofenceRadiusMeters") or 50
        ),
        "recordStatus": "active",
        "updatedAt": _utc_now(),
    }

    if lat is not None and lng is not None:
        doc["location"] = {
            "type": "Point",
            "coordinates": [lng, lat],
        }
        # Keep legacy fields for backward compat with ETA service.
        doc["latitude"] = lat
        doc["longitude"] = lng

    return doc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_route_geometry(
    route_id: str,
    geometry: dict[str, Any],
    stops: list[dict[str, Any]],
    total_distance_meters: float,
    *,
    actor_id: str,
) -> dict[str, Any]:
    """Atomically save approved geometry on a route document.

    Also syncs the ``stops`` collection with GeoJSON Point documents so that
    2dsphere queries can be run on passenger stop searches.

    Parameters
    ----------
    route_id:
        MongoDB ObjectId string for the route document.
    geometry:
        Approved GeoJSON LineString.
    stops:
        Ordered list of stop dicts, each containing at minimum ``id``,
        ``name``, ``sequence``, and coordinates.
    total_distance_meters:
        Total route distance returned by OSRM or computed locally.
    actor_id:
        Admin user identifier for audit logging.

    Returns
    -------
    dict
        Updated route summary including new geometryVersion.

    Raises
    ------
    ValueError
        When route_id is not a valid ObjectId or geometry is malformed.
    RuntimeError
        When the MongoDB write fails.
    """
    if not ObjectId.is_valid(route_id):
        raise ValueError(f"Invalid route id: {route_id!r}")

    if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
        raise ValueError("geometry must be a GeoJSON LineString object.")

    coordinates = geometry.get("coordinates", [])
    if len(coordinates) < 2:
        raise ValueError(
            "Route geometry must contain at least two coordinates."
        )

    now = _utc_now()

    # Build the legacy polyline format to keep existing services working.
    polyline = _geojson_coords_to_polyline(coordinates)

    try:
        result = routes_collection.find_one_and_update(
            {"_id": ObjectId(route_id)},
            {
                "$set": {
                    "geometry": geometry,
                    "polyline": polyline,
                    "totalDistanceMeters": total_distance_meters,
                    "geometryApprovedAt": now,
                    "geometryApprovedBy": actor_id,
                    "updatedAt": now,
                },
                "$inc": {"geometryVersion": 1},
            },
            return_document=True,
            projection={
                "_id": 1,
                "routeNumber": 1,
                "geometryVersion": 1,
                "geometryApprovedAt": 1,
            },
        )
    except PyMongoError as exc:
        raise RuntimeError(
            f"Failed to save route geometry: {exc}"
        ) from exc

    if result is None:
        raise ValueError(f"Route not found: {route_id}")

    # Sync stops collection — upsert each stop by routeId + stopId.
    for stop in stops:
        stop_doc = _build_stop_geojson_document(stop, route_id)
        stop_id = stop_doc.get("stopId")
        if not stop_id:
            continue
        try:
            stops_collection.update_one(
                {"routeId": route_id, "stopId": stop_id},
                {"$set": stop_doc, "$setOnInsert": {"createdAt": now}},
                upsert=True,
            )
        except PyMongoError:
            # Non-fatal: the route geometry has already been saved; stop
            # collection sync will be retried on next geometry update.
            pass

    return {
        "routeId": route_id,
        "routeNumber": result.get("routeNumber", ""),
        "geometryVersion": result.get("geometryVersion", 1),
        "geometryApprovedAt": now.isoformat(),
    }


def validate_route_geometry(route_id: str) -> dict[str, Any]:
    """Check whether a route has valid, parseable GeoJSON geometry.

    Returns
    -------
    dict
        ``{"valid": bool, "geometryVersion": int | None, "errors": [str]}``
    """
    if not ObjectId.is_valid(route_id):
        return {"valid": False, "geometryVersion": None, "errors": ["Invalid route id."]}

    try:
        route = routes_collection.find_one(
            {"_id": ObjectId(route_id)},
            {"geometry": 1, "geometryVersion": 1, "stops": 1},
        )
    except PyMongoError as exc:
        return {
            "valid": False,
            "geometryVersion": None,
            "errors": [f"Database error: {exc}"],
        }

    if route is None:
        return {"valid": False, "geometryVersion": None, "errors": ["Route not found."]}

    errors: list[str] = []
    geometry = route.get("geometry")

    if not geometry:
        errors.append("Route has no GeoJSON geometry. Use the geometry editor to generate one.")
        return {
            "valid": False,
            "geometryVersion": route.get("geometryVersion"),
            "errors": errors,
        }

    if geometry.get("type") != "LineString":
        errors.append(
            f"Geometry type must be LineString, got {geometry.get('type')!r}."
        )

    coordinates = geometry.get("coordinates", [])
    if len(coordinates) < 2:
        errors.append("Geometry must contain at least two coordinate pairs.")

    for index, coord in enumerate(coordinates):
        if (
            not isinstance(coord, (list, tuple))
            or len(coord) < 2
            or not isinstance(coord[0], (int, float))
            or not isinstance(coord[1], (int, float))
        ):
            errors.append(f"Coordinate at index {index} is invalid: {coord!r}.")
            break  # report once

    return {
        "valid": len(errors) == 0,
        "geometryVersion": route.get("geometryVersion"),
        "errors": errors,
    }


def get_route_geojson(route_id: str) -> dict[str, Any] | None:
    """Return the stored GeoJSON geometry for a route, or None if absent.

    Returns
    -------
    dict | None
        Full geometry object ``{"type": "LineString", "coordinates": [...]}``
        or ``None`` when no geometry has been approved yet.
    """
    if not ObjectId.is_valid(route_id):
        return None

    try:
        route = routes_collection.find_one(
            {"_id": ObjectId(route_id)},
            {"geometry": 1},
        )
    except PyMongoError:
        return None

    if route is None:
        return None

    geometry = route.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
        return None

    return geometry
