from flask import Flask, jsonify
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
import os

# .env file load කරන්න
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'smartbustracker_secret'

# SocketIO setup
socketio = SocketIO(app, cors_allowed_origins="*")

# MongoDB connect
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
db = client['bus_tracker']

# Active buses memory එකේ store කරනවා
active_buses = {}

# ─── REST API Routes ───────────────────────────────────

@app.route('/')
def index():
    return jsonify({'message': 'Smart Bus Tracker API Running! 🚌'})

@app.route('/api/active-buses')
def get_active_buses():
    return jsonify(list(active_buses.values()))

@app.route('/api/routes')
def get_routes():
    routes = list(db.routes.find({}, {'_id': 0}))
    return jsonify(routes)

# ─── Socket.IO Events ──────────────────────────────────

# Driver GPS data receive කරනවා
@socketio.on('driver_location')
def handle_driver_location(data):
    bus_id = data['busNumber']
    
    # ETA calculate කරනවා
    data['eta'] = calculate_eta(data)
    data['timestamp'] = datetime.now().isoformat()
    
    # Memory update
    active_buses[bus_id] = data
    
    # DB save
    db.gps_logs.insert_one({**data})
    
    # සියලුම passengers වලට broadcast
    emit('bus_location_update', data, broadcast=True)
    print(f"🚌 Bus {bus_id} → Lat: {data['latitude']}, Lng: {data['longitude']}, ETA: {data['eta']} min")

# Trip end
@socketio.on('trip_ended')
def handle_trip_ended(data):
    bus_id = data['busNumber']
    active_buses.pop(bus_id, None)
    emit('bus_removed', {'busNumber': bus_id}, broadcast=True)
    print(f"🔴 Bus {bus_id} trip ended")

# Client connect/disconnect
@socketio.on('connect')
def handle_connect():
    print(f'✅ Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'❌ Client disconnected')

# ─── ETA Calculation ───────────────────────────────────

def calculate_eta(data):
    speed = data.get('speed', 10) or 10  # m/s
    distance = 2000  # meters (placeholder)
    if speed > 0:
        eta_seconds = distance / speed
        return round(eta_seconds / 60)
    return 15

# ─── Run Server ────────────────────────────────────────

if __name__ == '__main__':
    print("🚀 Smart Bus Tracker Server Starting...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)