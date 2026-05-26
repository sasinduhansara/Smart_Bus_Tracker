from flask import request
from flask_socketio import emit, join_room, leave_room

active_buses = {}


def register_socket_events(socketio):
    @socketio.on("connect")
    def handle_connect():
        print(f"🔌 Client connected: {request.sid}")

    @socketio.on("disconnect")
    def handle_disconnect():
        bus_id = None
        for bid, data in active_buses.items():
            if data.get("sid") == request.sid:
                bus_id = bid
                break
        if bus_id:
            del active_buses[bus_id]
            emit("bus_offline", {"busId": bus_id}, broadcast=True)
        print(f"🔌 Client disconnected: {request.sid}")

    @socketio.on("bus_location")
    def handle_bus_location(data):
        bus_id = data.get("busId")
        active_buses[bus_id] = {
            "busId": bus_id,
            "lat": data.get("lat"),
            "lng": data.get("lng"),
            "route": data.get("route", ""),
            "status": data.get("status", "active"),
            "sid": request.sid,
            "updated_at": __import__("datetime").datetime.now().isoformat()
        }
        emit("bus_update", active_buses[bus_id], broadcast=True)

    @socketio.on("join_bus")
    def handle_join_bus(data):
        bus_id = data.get("busId")
        room = f"bus_{bus_id}"
        join_room(room)
        print(f"👤 Client joined room: {room}")

    @socketio.on("leave_bus")
    def handle_leave_bus(data):
        bus_id = data.get("busId")
        room = f"bus_{bus_id}"
        leave_room(room)
        print(f"👤 Client left room: {room}")
