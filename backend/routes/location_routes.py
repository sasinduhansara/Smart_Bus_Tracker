"""
location_routes.py

Primary ingestion endpoint for driver GPS data.
"""

from datetime import datetime, timezone
from typing import Any

from flask import Blueprint, jsonify, request
from bson.objectid import ObjectId
from pymongo.errors import PyMongoError

from config import (
    live_bus_states_collection,
    location_history_collection,
    trips_collection,
    routes_collection,
)
from utils.auth_utils import jwt_required, roles_required, get_jwt_identity
from services.geospatial_service import match_location_to_route, find_next_stop
from extensions import socketio

location_bp = Blueprint("location_bp", __name__)

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

@location_bp.route("/api/location", methods=["POST"])
@jwt_required
@roles_required("driver")
def update_location():
    """Receive GPS from driver, snap to route, and update state/history."""
    driver_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or "lat" not in data or "lng" not in data:
        return jsonify({"error": "Missing coordinates"}), 400
        
    lat = float(data["lat"])
    lng = float(data["lng"])
    speed = float(data.get("speed", 0))
    heading = float(data.get("heading", 0))
    
    now = _utc_now()
    recorded_at = data.get("timestamp")
    if recorded_at:
        try:
            # Parse ISO string
            recorded_at = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            recorded_at = now
    else:
        recorded_at = now

    try:
        # Find the active trip for this driver
        active_trip = trips_collection.find_one({
            "driverId": driver_id,
            "status": "active"
        })
        
        bus_id = None
        route_id = None
        route = None
        match = None
        next_stop = None
        
        if active_trip:
            bus_id = active_trip.get("busId")
            route_id = active_trip.get("routeId")
            
            if route_id:
                route = routes_collection.find_one({"_id": ObjectId(route_id)})
                if route:
                    # Perform map matching
                    match = match_location_to_route(
                        lat, 
                        lng, 
                        route.get("polyline", []),
                        route.get("geometry")
                    )
                    
                    # Update trip's current stop sequence logic
                    current_sequence = active_trip.get("currentStopSequence", 1)
                    next_stop = find_next_stop(
                        match["displayLatitude"],
                        match["displayLongitude"],
                        route.get("stops", []),
                        current_sequence
                    )
                    
                    if next_stop and next_stop.get("sequence", current_sequence) > current_sequence:
                        # Bus has advanced
                        trips_collection.update_one(
                            {"_id": active_trip["_id"]},
                            {"$set": {"currentStopSequence": next_stop["sequence"]}}
                        )
        
        # Determine actual stored coords based on match
        stored_lat = match["displayLatitude"] if match else lat
        stored_lng = match["displayLongitude"] if match else lng
        
        # 1. Update live_bus_states
        if bus_id:
            live_bus_states_collection.update_one(
                {"busId": bus_id},
                {
                    "$set": {
                        "busId": bus_id,
                        "driverId": driver_id,
                        "tripId": str(active_trip["_id"]) if active_trip else None,
                        "routeId": route_id,
                        "routeNumber": active_trip.get("routeNumber") if active_trip else None,
                        "location": {
                            "type": "Point",
                            "coordinates": [stored_lng, stored_lat]
                        },
                        "speed": speed,
                        "heading": heading,
                        "operationalStatus": "active" if active_trip else "offline",
                        "recordedAt": recorded_at,
                        "updatedAt": now,
                        "nextStopId": next_stop.get("id") if next_stop else None,
                        "distanceFromRouteMeters": match["distanceFromRouteMeters"] if match else 0,
                    }
                },
                upsert=True
            )
            
        # 2. Insert into location_history
        location_history_collection.insert_one({
            "driverId": driver_id,
            "busId": bus_id,
            "tripId": str(active_trip["_id"]) if active_trip else None,
            "routeId": route_id,
            "location": {
                "type": "Point",
                "coordinates": [stored_lng, stored_lat]
            },
            "rawLocation": {
                "type": "Point",
                "coordinates": [lng, lat]
            },
            "speed": speed,
            "heading": heading,
            "recordedAt": recorded_at,
            "distanceFromRouteMeters": match["distanceFromRouteMeters"] if match else 0,
        })
        
        # 3. Emit room-scoped Socket.IO events (Phase 3)
        socket_payload = {
            "busId": bus_id,
            "routeNumber": active_trip.get("routeNumber") if active_trip else None,
            "tripId": str(active_trip["_id"]) if active_trip else None,
            "lat": stored_lat,
            "lng": stored_lng,
            "speed": speed,
            "heading": heading,
            "distanceFromRouteMeters": match["distanceFromRouteMeters"] if match else 0,
            "isDeviating": match["isRouteDeviationCandidate"] if match else False,
            "updatedAt": now.isoformat(),
        }
        if next_stop:
            socket_payload["nextStop"] = {
                "id": next_stop.get("id"),
                "name": next_stop.get("name"),
                "sequence": next_stop.get("sequence"),
            }
        
        try:
            route_number = active_trip.get("routeNumber") if active_trip else None
            if route_number:
                socketio.emit(
                    "bus_location_update",
                    socket_payload,
                    room=f"route:{route_number}",
                )
            if bus_id:
                socketio.emit(
                    "bus_location_update",
                    socket_payload,
                    room=f"bus:{bus_id}",
                )
                # Also broadcast globally for backward compat with existing clients
                socketio.emit("bus_location_update", socket_payload)
        except Exception:
            pass  # Non-fatal – DB write already succeeded
        
        # Construct response
        response_data = {
            "status": "success",
            "bus": {
                "lat": stored_lat,
                "lng": stored_lng,
                "distanceFromRouteMeters": match["distanceFromRouteMeters"] if match else 0,
                "isDeviating": match["isRouteDeviationCandidate"] if match else False,
            }
        }
        
        return jsonify(response_data)
        
    except PyMongoError:
        return jsonify({"error": "Database error while processing location"}), 500
