# Gamana.lk – OpenStreetMap Bus Tracking API Reference

All map, location, and ETA endpoints provided by the backend API.

---

## 1. Map & Geometry Endpoints

### `GET /api/routes/<route_id>/geometry`
Returns the approved GeoJSON `LineString` for a route.

**Response** `200 OK`
```json
{
  "status": "success",
  "routeId": "65ab1234ef56789012345678",
  "geometryVersion": 3,
  "totalDistanceMeters": 27450.0,
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [79.8612, 6.9271],
      [79.8656, 6.8722],
      [79.9074, 6.7106]
    ]
  }
}
```

### `PUT /api/admin/routes/<route_id>/geometry` *(Admin JWT required)*
Atomically updates and approves GeoJSON geometry for a route.

**Request Body**
```json
{
  "geometry": {
    "type": "LineString",
    "coordinates": [[79.8612, 6.9271], [79.9074, 6.7106]]
  },
  "stops": [
    {
      "id": "stop-colombo",
      "name": "Colombo Fort",
      "sequence": 1,
      "location": { "type": "Point", "coordinates": [79.8612, 6.9271] }
    }
  ],
  "totalDistanceMeters": 27450.0
}
```

---

## 2. Driver Location & Map State

### `POST /api/location` *(Driver JWT required)*
Receives raw GPS coordinates from active driver, performs map-matching, updates MongoDB live state, and broadcasts Socket.IO room updates.

**Request Body**
```json
{
  "latitude": 6.9271,
  "longitude": 79.8612,
  "speed": 34.5,
  "heading": 180.0,
  "accuracy": 5.0
}
```

**Response** `200 OK`
```json
{
  "status": "success",
  "snappedLocation": {
    "lat": 6.9271,
    "lng": 79.8612,
    "snapped": true,
    "distanceFromRouteMeters": 3.2,
    "isRouteDeviation": false
  }
}
```

---

## 3. Real-Time ETA & Search

### `POST /api/eta/predict`
Calculates real-time ETA to a destination stop using the Random Forest regressor (or physics fallback).

**Request Body**
```json
{
  "busId": "65ab1234ef56789012345678",
  "routeNumber": "100",
  "destinationStopId": "stop-wellawatte"
}
```

**Response** `200 OK`
```json
{
  "status": "success",
  "busId": "65ab1234ef56789012345678",
  "routeNumber": "100",
  "destinationStop": { "id": "stop-wellawatte", "name": "Wellawatte" },
  "nextStop": { "id": "stop-bambalapitiya", "name": "Bambalapitiya" },
  "etaMinutes": 8.5,
  "estimatedArrivalAt": "2026-07-21T15:45:00+05:30",
  "remainingDistanceKm": 3.2,
  "modelVersion": "random-forest-regressor-v1"
}
```

### `GET /api/search?q=<query>&limit=10`
Public passenger directory search matching route numbers, town names, and stop names.

---

## 4. Socket.IO Events

| Event | Direction | Data Payload |
|---|---|---|
| `subscribe_route` | Client → Server | `{"routeNumber": "100"}` |
| `unsubscribe_route` | Client → Server | `{"routeNumber": "100"}` |
| `subscribe_bus` | Client → Server | `{"busId": "<id>"}` |
| `bus_location_update` | Server → Client | `BusLocationUpdate` object |
