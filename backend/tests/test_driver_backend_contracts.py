import io
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch

from bson.objectid import ObjectId
from flask import Flask


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

test_config = ModuleType("config")
for collection_name in (
    "buses_collection",
    "driver_shifts_collection",
    "drivers_collection",
    "issue_reports_collection",
    "notifications_collection",
    "otp_collection",
    "trips_collection",
    "routes_collection",
):
    setattr(test_config, collection_name, MagicMock())
test_config.TEXTLK_API_TOKEN = "test-token"
test_config.TEXTLK_SENDER_ID = "test-sender"
test_config.SUPABASE_URL = "https://test-project.supabase.co"
test_config.SUPABASE_SERVICE_KEY = "test-service-key"
test_config.SUPABASE_BUCKET = "driver-documents"

original_config = sys.modules.get("config")
sys.modules["config"] = test_config
try:
    import routes.admin_routes as admin_routes
    import routes.auth_routes as auth_routes
    import routes.bus_routes as bus_routes
    import routes.document_routes as document_routes
    import routes.trip_routes as trip_routes
    from routes.admin_routes import admin_bp
    from routes.auth_routes import auth_bp
    from routes.bus_routes import bus_bp
    from routes.document_routes import document_bp
    from routes.trip_routes import trip_bp
    from utils.auth_utils import create_access_token
finally:
    if original_config is None:
        sys.modules.pop("config", None)
    else:
        sys.modules["config"] = original_config


DRIVER_ID = "64b000000000000000000001"
TRIP_ID = ObjectId("64b000000000000000000002")
NOW = datetime.now(timezone.utc)


def approved_driver():
    return {
        "_id": ObjectId(DRIVER_ID),
        "fullName": "Test Driver",
        "verificationStatus": "approved",
        "vehicleRegistrationNumber": "NC-1234",
        "busRouteNumber": "123",
    }


def required_documents():
    return {
        document_type: {
            "fileName": f"94712345678/{document_type}.jpg",
            "url": f"https://storage.example/{document_type}.jpg",
            "mimeType": "image/jpeg",
        }
        for document_type in (
            "nicFront",
            "nicBack",
            "drivingLicenseFront",
            "drivingLicenseBack",
        )
    }



def registration_payload(**overrides):
    payload = {
        "fullName": "Test Driver",
        "nic": "200012345678",
        "mobile": "0712345678",
        "email": "driver@example.com",
        "password": "secure123",
        "driverNtcRegistrationNumber": "D-123",
        "drivingLicenseNumber": "L-123",
        "drivingLicenseExpiry": "2099-01-01",
        "depotOperator": "Test Depot",
        "documents": {},
    }
    payload.update(overrides)
    return payload

def route_details():
    return {
        "routeNumber": "123",
        "name": "Kuliyapitiya - Kurunegala",
        "direction": "outbound",
        "polyline": [
            {"latitude": 6.8, "longitude": 79.9},
            {"latitude": 6.9, "longitude": 79.8},
        ],
        "stops": [
            {"id": "a", "name": "Kuliyapitiya Bus Stand", "latitude": 7.4688, "longitude": 80.0401, "sequence": 1},
            {"id": "b", "name": "Kurunegala Bus Stand", "latitude": 7.4863, "longitude": 80.3647, "sequence": 2},
        ],
        "terminals": [
            {
                "id": "kuliyapitiya",
                "name": "Kuliyapitiya Bus Stand",
                "latitude": 7.4688,
                "longitude": 80.0401,
                "startRadiusMeters": 500,
            },
            {
                "id": "kurunegala",
                "name": "Kurunegala Bus Stand",
                "latitude": 7.4863,
                "longitude": 80.3647,
                "startRadiusMeters": 500,
            },
        ],
    }


def fresh_start_location(latitude=7.4688, longitude=80.0401, accuracy=8):
    return {
        "location": {
            "lat": latitude,
            "lng": longitude,
            "speed": 0,
            "heading": 0,
            "accuracy": accuracy,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


def canonical_trip(status="active"):
    trip = {
        "_id": TRIP_ID,
        "driverId": DRIVER_ID,
        "activeKey": DRIVER_ID,
        "busId": "NC-1234",
        "vehicleRegistrationNumber": "NC-1234",
        "routeNumber": "123",
        "routeName": "Kuliyapitiya - Kurunegala",
        "origin": "Kuliyapitiya Bus Stand",
        "destination": "Kurunegala Bus Stand",
        "status": status,
        "startedAt": NOW,
        "createdAt": NOW,
        "updatedAt": NOW,
        "durationSeconds": 0,
        "activeDurationSeconds": 0,
        "totalPausedSeconds": 0,
    }
    if status == "paused":
        trip["pausedAt"] = NOW
    return trip


class DriverBackendContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.environment = patch.dict(
            os.environ,
            {"JWT_SECRET": "test-secret-that-is-at-least-32-bytes-long"},
        )
        cls.environment.start()
        cls.token = create_access_token(DRIVER_ID, "driver")
        cls.admin_token = create_access_token("admin@example.com", "admin")

    @classmethod
    def tearDownClass(cls):
        cls.environment.stop()

    def setUp(self):
        for collection_name in (
            "buses_collection",
            "driver_shifts_collection",
            "drivers_collection",
            "issue_reports_collection",
            "notifications_collection",
            "otp_collection",
            "trips_collection",
        ):
            getattr(test_config, collection_name).reset_mock(
                return_value=True,
                side_effect=True,
            )

        app = Flask(__name__)
        app.testing = True
        app.register_blueprint(admin_bp)
        app.register_blueprint(auth_bp)
        app.register_blueprint(bus_bp)
        app.register_blueprint(document_bp)
        app.register_blueprint(trip_bp)
        self.client = app.test_client()
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.admin_headers = {
            "Authorization": f"Bearer {self.admin_token}",
        }

    @patch.object(trip_routes.socketio, "emit")
    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_persists_canonical_contract(self, get_route, emit):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = None
        test_config.trips_collection.insert_one.return_value = SimpleNamespace(
            inserted_id=TRIP_ID
        )

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload["status"], "started")
        self.assertEqual(payload["trip"]["status"], "active")
        self.assertEqual(payload["trip"]["busId"], "NC-1234")
        inserted_trip = test_config.trips_collection.insert_one.call_args.args[0]
        self.assertEqual(inserted_trip["activeKey"], DRIVER_ID)
        self.assertEqual(inserted_trip["busActiveKey"], "NC-1234")
        self.assertEqual(inserted_trip["routeNumber"], "123")
        self.assertEqual(inserted_trip["distanceKm"], 0)
        self.assertEqual(inserted_trip["startTerminalId"], "kuliyapitiya")
        self.assertEqual(inserted_trip["destinationTerminalId"], "kurunegala")
        self.assertEqual(
            inserted_trip["direction"],
            "kuliyapitiya_to_kurunegala",
        )
        self.assertEqual(inserted_trip["lastLocation"]["lat"], 7.4688)
        self.assertEqual(inserted_trip["lastLocation"]["accuracy"], 8)
        self.assertEqual(inserted_trip["locationUpdateCount"], 1)
        bus_update = test_config.buses_collection.update_one.call_args.args[1]["$set"]
        self.assertEqual(bus_update["operationalStatus"], "active")
        self.assertEqual(bus_update["lat"], 7.4688)
        self.assertEqual(bus_update["lng"], 80.0401)
        self.assertEqual(bus_update["rawLatitude"], 7.4688)
        self.assertEqual(bus_update["rawLongitude"], 80.0401)
        self.assertEqual(bus_update["accuracy"], 8)
        self.assertNotIn("nic", payload["bus"])
        self.assertNotIn("driver_id", payload["bus"])
        emit.assert_called_once_with("bus_location_update", payload["bus"])

    @patch.object(trip_routes.socketio, "emit")
    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_inside_kurunegala_derives_reverse_direction(
        self,
        get_route,
        emit,
    ):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = None
        test_config.trips_collection.insert_one.return_value = SimpleNamespace(
            inserted_id=TRIP_ID,
        )

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(7.4863, 80.3647),
        )

        self.assertEqual(response.status_code, 201)
        trip = response.get_json()["trip"]
        self.assertEqual(trip["origin"], "Kurunegala Bus Stand")
        self.assertEqual(trip["destination"], "Kuliyapitiya Bus Stand")
        self.assertEqual(trip["startTerminalId"], "kurunegala")
        self.assertEqual(trip["direction"], "kurunegala_to_kuliyapitiya")
        emit.assert_called_once()

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_outside_both_terminal_geofences_is_denied(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(7.30, 80.20),
        )

        self.assertEqual(response.status_code, 403)
        payload = response.get_json()
        self.assertEqual(payload["code"], "OUTSIDE_START_GEOFENCE")
        self.assertIn(payload["nearestTerminal"]["name"], {
            "Kuliyapitiya Bus Stand",
            "Kurunegala Bus Stand",
        })
        self.assertGreater(payload["nearestTerminal"]["distanceMeters"], 500)
        self.assertEqual(payload["nearestTerminal"]["allowedRadiusMeters"], 500)
        test_config.trips_collection.insert_one.assert_not_called()

    @patch.object(trip_routes.socketio, "emit")
    @patch.object(trip_routes, "distance_km", side_effect=[0.5, 1.0, 1.0])
    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_allows_exact_terminal_radius_boundary(
        self,
        get_route,
        distance,
        emit,
    ):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = None
        test_config.trips_collection.insert_one.return_value = SimpleNamespace(
            inserted_id=TRIP_ID,
        )

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["trip"]["startTerminalId"], "kuliyapitiya")
        emit.assert_called_once()

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_requires_location_payload(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json={},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["code"], "LOCATION_REQUIRED")
        test_config.trips_collection.insert_one.assert_not_called()

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_rejects_invalid_coordinates(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        payload = fresh_start_location()
        payload["location"]["lat"] = "not-a-coordinate"

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=payload,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["code"], "LOCATION_INVALID")

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_rejects_stale_location(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        payload = fresh_start_location()
        payload["location"]["timestamp"] = (
            datetime.now(timezone.utc) - timedelta(minutes=2)
        ).isoformat()

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=payload,
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "LOCATION_STALE")

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_rejects_low_accuracy_location(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(accuracy=101),
        )

        self.assertEqual(response.status_code, 422)
        payload = response.get_json()
        self.assertEqual(payload["code"], "LOCATION_ACCURACY_TOO_LOW")
        self.assertEqual(payload["maximumAccuracyMeters"], 100)

    @patch.object(
        trip_routes,
        "get_route_details",
        return_value={**route_details(), "terminals": []},
    )
    def test_start_trip_fails_safe_without_configured_terminals(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json()["code"],
            "ROUTE_TERMINALS_NOT_CONFIGURED",
        )
        test_config.trips_collection.insert_one.assert_not_called()

    def test_start_trip_rejects_missing_bus_assignment(self):
        driver = approved_driver()
        driver["vehicleRegistrationNumber"] = ""
        test_config.drivers_collection.find_one.return_value = driver

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "BUS_NOT_ASSIGNED")
        test_config.trips_collection.insert_one.assert_not_called()

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_readiness_inside_terminal_allows_start_and_returns_direction(
        self,
        get_route,
    ):
        test_config.drivers_collection.find_one.return_value = approved_driver()

        response = self.client.post(
            "/api/driver/trips/readiness",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["canStart"])
        self.assertEqual(payload["code"], "READY_TO_START")
        self.assertEqual(payload["nearestTerminal"]["id"], "kuliyapitiya")
        self.assertEqual(payload["nearestTerminal"]["remainingDistanceMeters"], 0)
        self.assertEqual(
            payload["direction"]["destination"],
            "Kurunegala Bus Stand",
        )
        test_config.trips_collection.insert_one.assert_not_called()
        test_config.buses_collection.update_one.assert_not_called()

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_readiness_outside_returns_nearest_terminal_and_remaining_distance(
        self,
        get_route,
    ):
        test_config.drivers_collection.find_one.return_value = approved_driver()

        response = self.client.post(
            "/api/driver/trips/readiness",
            headers=self.headers,
            json=fresh_start_location(7.46, 80.02),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertFalse(payload["canStart"])
        self.assertEqual(payload["code"], "OUTSIDE_START_GEOFENCE")
        self.assertEqual(payload["nearestTerminal"]["id"], "kuliyapitiya")
        self.assertGreater(
            payload["nearestTerminal"]["remainingDistanceMeters"],
            0,
        )
        self.assertIsNone(payload["direction"])

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_readiness_rejects_reversed_sri_lanka_coordinates(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()

        response = self.client.post(
            "/api/driver/trips/readiness",
            headers=self.headers,
            json=fresh_start_location(80.0401, 7.4688),
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["code"], "OUTSIDE_SERVICE_AREA")

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_readiness_rejects_stale_and_poor_accuracy_locations(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        stale = fresh_start_location()
        stale["location"]["timestamp"] = (
            datetime.now(timezone.utc) - timedelta(minutes=2)
        ).isoformat()

        stale_response = self.client.post(
            "/api/driver/trips/readiness",
            headers=self.headers,
            json=stale,
        )
        accuracy_response = self.client.post(
            "/api/driver/trips/readiness",
            headers=self.headers,
            json=fresh_start_location(accuracy=101),
        )

        self.assertEqual(stale_response.status_code, 409)
        self.assertEqual(stale_response.get_json()["code"], "LOCATION_STALE")
        self.assertEqual(accuracy_response.status_code, 422)
        self.assertEqual(
            accuracy_response.get_json()["code"],
            "LOCATION_ACCURACY_TOO_LOW",
        )

    def test_start_trip_rejects_unapproved_driver(self):
        driver = approved_driver()
        driver["verificationStatus"] = "pending"
        test_config.drivers_collection.find_one.return_value = driver

        response = self.client.post("/api/driver/trips/start", headers=self.headers)

        self.assertEqual(response.status_code, 403)
        test_config.trips_collection.insert_one.assert_not_called()

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_prevents_duplicate_open_trip(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip("paused")

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["trip"]["status"], "paused")

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_prevents_two_drivers_using_the_same_bus(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        other_trip = canonical_trip()
        other_trip["driverId"] = "64b000000000000000000009"
        test_config.trips_collection.find_one.side_effect = [None, other_trip]

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "BUS_TRIP_CONFLICT")
        test_config.trips_collection.insert_one.assert_not_called()

    @patch.object(trip_routes.socketio, "emit")
    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_aborts_when_driver_is_blocked_after_insert(
        self,
        get_route,
        emit,
    ):
        blocked_driver = approved_driver()
        blocked_driver["verificationStatus"] = "blocked"
        test_config.drivers_collection.find_one.side_effect = [
            approved_driver(),
            blocked_driver,
        ]
        test_config.trips_collection.find_one.side_effect = [None, None]
        test_config.trips_collection.insert_one.return_value = SimpleNamespace(
            inserted_id=TRIP_ID,
        )

        response = self.client.post(
            "/api/driver/trips/start",
            headers=self.headers,
            json=fresh_start_location(),
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["code"], "DRIVER_AUTHORITY_CHANGED")
        deletion_query = test_config.trips_collection.delete_one.call_args.args[0]
        self.assertEqual(deletion_query["_id"], TRIP_ID)
        self.assertEqual(deletion_query["status"], "active")
        test_config.buses_collection.update_one.assert_not_called()
        emit.assert_not_called()

    def test_active_trip_restore_uses_expected_shape(self):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip()

        response = self.client.get("/api/driver/trips/active", headers=self.headers)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["trip"]["id"], str(TRIP_ID))

    @patch.object(trip_routes.socketio, "emit")
    def test_pause_trip_enforces_transition_and_updates_bus(self, emit):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        trip = canonical_trip()
        trip["startedAt"] = datetime.now(timezone.utc) - timedelta(seconds=90)
        test_config.trips_collection.find_one.return_value = trip
        test_config.trips_collection.update_one.return_value = SimpleNamespace(
            modified_count=1
        )

        response = self.client.post(
            f"/api/driver/trips/{TRIP_ID}/pause",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "paused")
        self.assertGreaterEqual(payload["trip"]["activeDurationSeconds"], 89)
        self.assertEqual(payload["bus"]["operationalStatus"], "paused")
        self.assertFalse(payload["bus"]["isActive"])
        emit.assert_called_once()

    @patch.object(trip_routes.socketio, "emit")
    def test_newer_bus_status_rejects_stale_trip_transition(self, emit):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip()
        test_config.trips_collection.update_one.return_value = SimpleNamespace(
            modified_count=1
        )
        test_config.buses_collection.find_one.return_value = {
            "_id": ObjectId("64b000000000000000000006"),
        }
        test_config.buses_collection.update_one.return_value = SimpleNamespace(
            matched_count=0,
            upserted_id=None,
        )

        response = self.client.post(
            f"/api/driver/trips/{TRIP_ID}/pause",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 409)
        compensation_filter = (
            test_config.trips_collection.replace_one.call_args.args[0]
        )
        self.assertEqual(compensation_filter["status"], "paused")
        self.assertIn("updatedAt", compensation_filter)
        emit.assert_not_called()

    def test_resume_rejects_active_trip(self):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip("active")

        response = self.client.post(
            f"/api/driver/trips/{TRIP_ID}/resume",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 409)
        test_config.trips_collection.update_one.assert_not_called()

    def test_resume_rejects_driver_who_is_no_longer_approved(self):
        driver = approved_driver()
        driver["verificationStatus"] = "blocked"
        test_config.drivers_collection.find_one.return_value = driver
        test_config.trips_collection.find_one.return_value = canonical_trip("paused")

        response = self.client.post(
            f"/api/driver/trips/{TRIP_ID}/resume",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 403)
        test_config.trips_collection.update_one.assert_not_called()
        test_config.buses_collection.update_one.assert_not_called()

    def test_resume_compensates_when_driver_is_blocked_during_transition(self):
        blocked_driver = approved_driver()
        blocked_driver["verificationStatus"] = "blocked"
        test_config.drivers_collection.find_one.side_effect = [
            approved_driver(),
            blocked_driver,
        ]
        test_config.trips_collection.find_one.return_value = canonical_trip("paused")
        test_config.trips_collection.update_one.side_effect = [
            SimpleNamespace(modified_count=1),
            SimpleNamespace(modified_count=1),
        ]

        response = self.client.post(
            f"/api/driver/trips/{TRIP_ID}/resume",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["code"], "DRIVER_AUTHORITY_CHANGED")
        compensation = test_config.trips_collection.update_one.call_args_list[1]
        self.assertEqual(compensation.args[1]["$set"]["status"], "paused")
        test_config.buses_collection.update_one.assert_not_called()

    def test_trip_transition_query_is_scoped_to_authenticated_driver(self):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = None

        response = self.client.post(
            f"/api/driver/trips/{TRIP_ID}/complete",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 404)
        ownership_query = test_config.trips_collection.find_one.call_args.args[0]
        self.assertEqual(ownership_query["_id"], TRIP_ID)
        self.assertTrue(any(
            condition.get("driverId") == DRIVER_ID
            or condition.get("driver_id") == DRIVER_ID
            for condition in ownership_query["$or"]
        ))
        test_config.trips_collection.update_one.assert_not_called()

    @patch.object(trip_routes.socketio, "emit")
    def test_complete_trip_clears_active_key_and_marks_bus_offline(self, emit):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip()
        test_config.trips_collection.update_one.return_value = SimpleNamespace(
            modified_count=1
        )

        response = self.client.post(
            f"/api/driver/trips/{TRIP_ID}/complete",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["bus"]["operationalStatus"], "offline")
        update = test_config.trips_collection.update_one.call_args.args[1]
        self.assertIn("activeKey", update["$unset"])
        self.assertIn("busActiveKey", update["$unset"])
        emit.assert_called_once()

    def test_location_requires_active_trip(self):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.side_effect = [None, None]

        response = self.client.post(
            "/api/location",
            headers=self.headers,
            json={
                "lat": 6.9,
                "lng": 79.8,
                "accuracy": 10,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "NO_ACTIVE_TRIP")
        test_config.buses_collection.update_one.assert_not_called()

    def test_location_rejects_non_finite_coordinates_and_bad_timestamp(self):
        response = self.client.post(
            "/api/location",
            headers=self.headers,
            json={"lat": "nan", "lng": 79.8, "accuracy": 10, "timestamp": "bad"},
        )

        self.assertEqual(response.status_code, 400)

    def test_location_rejects_reversed_sri_lanka_coordinates(self):
        response = self.client.post(
            "/api/location",
            headers=self.headers,
            json={
                "lat": 79.8,
                "lng": 6.9,
                "accuracy": 10,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["code"], "OUTSIDE_SERVICE_AREA")

    @patch.object(bus_routes.socketio, "emit")
    @patch.object(bus_routes, "get_route_details", return_value=route_details())
    def test_location_persists_trip_and_emits_public_safe_payload(
        self,
        get_route,
        emit,
    ):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip()
        test_config.trips_collection.update_one.return_value = SimpleNamespace(
            modified_count=1
        )
        test_config.buses_collection.find_one.return_value = {
            "_id": ObjectId("64b000000000000000000006"),
            "statusUpdatedAt": NOW,
        }
        test_config.buses_collection.update_one.return_value = SimpleNamespace(
            matched_count=1,
            upserted_id=None,
        )

        response = self.client.post(
            "/api/location",
            headers=self.headers,
            json={
                "lat": 6.9,
                "lng": 79.8,
                "speed": 32.5,
                "heading": 180,
                "accuracy": 8,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["tripId"], str(TRIP_ID))
        self.assertEqual(payload["bus"]["operationalStatus"], "active")
        self.assertEqual(payload["bus"]["rawLatitude"], 6.9)
        self.assertEqual(payload["bus"]["rawLongitude"], 79.8)
        self.assertEqual(payload["bus"]["displayLatitude"], 6.9)
        self.assertEqual(payload["bus"]["displayLongitude"], 79.8)
        self.assertNotIn("isRouteDeviationCandidate", payload["bus"])
        self.assertNotIn("driver_id", payload["bus"])
        self.assertNotIn("nic", payload["bus"])
        trip_update = test_config.trips_collection.update_one.call_args.args[1]
        self.assertEqual(trip_update["$inc"]["locationUpdateCount"], 1)
        self.assertEqual(trip_update["$inc"]["distanceKm"], 0)
        emit.assert_called_once_with("bus_location_update", payload["bus"])

    @patch.object(bus_routes.socketio, "emit")
    @patch.object(bus_routes, "get_route_details", return_value=route_details())
    def test_route_deviation_requires_three_consecutive_accurate_fixes(
        self,
        get_route,
        emit,
    ):
        trip = canonical_trip()
        trip["routeDeviationConsecutiveCount"] = 2
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = trip
        test_config.trips_collection.update_one.return_value = SimpleNamespace(
            modified_count=1,
        )
        test_config.buses_collection.find_one.return_value = {
            "_id": ObjectId("64b000000000000000000006"),
            "statusUpdatedAt": NOW,
        }
        test_config.buses_collection.update_one.return_value = SimpleNamespace(
            matched_count=1,
            upserted_id=None,
        )

        response = self.client.post(
            "/api/location",
            headers=self.headers,
            json={
                "lat": 7.0,
                "lng": 79.8,
                "speed": 20,
                "heading": 180,
                "accuracy": 8,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()["bus"]
        self.assertTrue(payload["isRouteDeviation"])
        self.assertEqual(payload["displayLatitude"], payload["rawLatitude"])
        trip_update = test_config.trips_collection.update_one.call_args.args[1]
        self.assertEqual(
            trip_update["$set"]["routeDeviationConsecutiveCount"],
            3,
        )
        emit.assert_called_once_with("bus_location_update", payload)

    def test_location_rejects_physically_impossible_movement(self):
        previous_timestamp = datetime.now(timezone.utc) - timedelta(seconds=2)
        trip = canonical_trip()
        trip["lastLocation"] = {
            "lat": 6.9,
            "lng": 79.8,
            "accuracy": 8,
            "timestamp": previous_timestamp,
        }
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = trip
        test_config.buses_collection.find_one.return_value = {
            "_id": ObjectId("64b000000000000000000006"),
            "statusUpdatedAt": NOW,
        }

        response = self.client.post(
            "/api/location",
            headers=self.headers,
            json={
                "lat": 7.9,
                "lng": 79.8,
                "speed": 30,
                "heading": 180,
                "accuracy": 8,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "IMPLAUSIBLE_MOVEMENT")
        test_config.trips_collection.update_one.assert_not_called()
        test_config.buses_collection.update_one.assert_not_called()

    @patch.object(bus_routes.socketio, "emit")
    def test_newer_pause_or_end_status_wins_over_inflight_location(self, emit):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip()
        test_config.trips_collection.update_one.side_effect = [
            SimpleNamespace(modified_count=1),
            SimpleNamespace(modified_count=1),
        ]
        test_config.buses_collection.find_one.return_value = {
            "_id": ObjectId("64b000000000000000000006"),
            "statusUpdatedAt": NOW,
        }
        test_config.buses_collection.update_one.return_value = SimpleNamespace(
            matched_count=0,
            upserted_id=None,
        )

        response = self.client.post(
            "/api/location",
            headers=self.headers,
            json={
                "lat": 6.9,
                "lng": 79.8,
                "speed": 30,
                "heading": 180,
                "accuracy": 8,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn("newer bus status", response.get_json()["error"])
        bus_filter = test_config.buses_collection.update_one.call_args.args[0]
        self.assertIn("$and", bus_filter)
        rollback_filter = test_config.trips_collection.update_one.call_args_list[
            1
        ].args[0]
        self.assertEqual(rollback_filter["status"], "active")
        emit.assert_not_called()

    def test_public_buses_projection_and_response_are_private_safe(self):
        test_config.buses_collection.find.return_value = [{
            "bus_id": "NC-1234",
            "vehicleRegistrationNumber": "NC-1234",
            "routeNumber": "138",
            "lat": 6.9,
            "lng": 79.8,
            "operationalStatus": "active",
            "isActive": True,
            "updatedAt": NOW,
        }]

        response = self.client.get("/api/buses")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()[0]
        self.assertNotIn("driver_id", payload)
        projection = test_config.buses_collection.find.call_args.args[1]
        self.assertNotIn("driver_id", projection)
        self.assertEqual(payload["operationalStatus"], "active")

    def test_public_buses_marks_stale_active_tracking_offline(self):
        test_config.buses_collection.find.return_value = [{
            "bus_id": "NC-1234",
            "lat": 6.9,
            "lng": 79.8,
            "operationalStatus": "active",
            "isActive": True,
            "updatedAt": datetime.now(timezone.utc) - timedelta(minutes=3),
        }]

        response = self.client.get("/api/buses")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()[0]
        self.assertEqual(payload["operationalStatus"], "offline")
        self.assertFalse(payload["isActive"])

    def test_driver_home_tracking_does_not_call_stale_or_paused_bus_live(self):
        test_config.buses_collection.find_one.return_value = {
            "bus_id": "NC-1234",
            "lat": 6.9,
            "lng": 79.8,
            "updatedAt": datetime.now(timezone.utc) - timedelta(minutes=3),
            "operationalStatus": "active",
            "isActive": True,
        }

        stale = auth_routes.build_tracking_payload(approved_driver())
        self.assertEqual(stale["status"], "offline")

        test_config.buses_collection.find_one.return_value.update({
            "updatedAt": datetime.now(timezone.utc),
            "operationalStatus": "paused",
            "isActive": False,
        })
        paused = auth_routes.build_tracking_payload(approved_driver())
        self.assertEqual(paused["status"], "paused")

    def test_issue_report_returns_only_safe_summary(self):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        test_config.trips_collection.find_one.return_value = canonical_trip()
        test_config.issue_reports_collection.insert_one.return_value = SimpleNamespace(
            inserted_id=ObjectId("64b000000000000000000003")
        )

        response = self.client.post(
            "/api/driver/issues",
            headers=self.headers,
            json={
                "category": "vehicle_breakdown",
                "severity": "high",
                "message": "Engine warning light",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload["status"], "reported")
        self.assertNotIn("driverId", payload["issue"])
        stored = test_config.issue_reports_collection.insert_one.call_args.args[0]
        self.assertEqual(stored["driverId"], DRIVER_ID)
        self.assertEqual(stored["status"], "open")

    def test_admin_approval_uses_reviewed_kyc_revision_and_documents(self):
        documents = required_documents()
        driver = approved_driver()
        driver.update({
            "documents": documents,
            "kycRevision": 3,
            "kycStatus": "SUBMITTED",
            "verificationStatus": "under_review",
        })
        test_config.drivers_collection.find_one.return_value = driver
        test_config.drivers_collection.update_one.return_value = SimpleNamespace(
            matched_count=1,
        )

        response = self.client.patch(
            f"/api/admin/drivers/{DRIVER_ID}/approve",
            headers=self.admin_headers,
        )

        self.assertEqual(response.status_code, 200)
        approval_query = test_config.drivers_collection.update_one.call_args.args[0]
        self.assertIn({"kycRevision": 3}, approval_query["$and"])
        self.assertIn(
            {"verificationStatus": "under_review"},
            approval_query["$and"],
        )
        for document_type, document in documents.items():
            self.assertIn(
                {f"documents.{document_type}": document},
                approval_query["$and"],
            )

    def test_stale_admin_review_cannot_overwrite_a_block(self):
        documents = required_documents()
        reviewed_driver = approved_driver()
        reviewed_driver.update({
            "documents": documents,
            "kycRevision": 5,
            "verificationStatus": "under_review",
        })
        test_config.drivers_collection.find_one.side_effect = [
            reviewed_driver,
            {"_id": ObjectId(DRIVER_ID), "verificationStatus": "blocked"},
        ]
        test_config.drivers_collection.update_one.return_value = SimpleNamespace(
            matched_count=0,
        )

        response = self.client.patch(
            f"/api/admin/drivers/{DRIVER_ID}/approve",
            headers=self.admin_headers,
        )

        self.assertEqual(response.status_code, 409)
        approval_query = test_config.drivers_collection.update_one.call_args.args[0]
        self.assertIn(
            {"verificationStatus": "under_review"},
            approval_query["$and"],
        )

    @patch.object(admin_routes.socketio, "emit")
    def test_admin_block_immediately_pauses_active_passenger_bus(self, emit):
        test_config.drivers_collection.update_one.return_value = SimpleNamespace(
            matched_count=1,
        )
        test_config.trips_collection.find_one.return_value = canonical_trip("active")
        test_config.trips_collection.update_one.return_value = SimpleNamespace(
            modified_count=1,
        )
        test_config.buses_collection.update_one.return_value = SimpleNamespace(
            matched_count=1,
        )

        response = self.client.patch(
            f"/api/admin/drivers/{DRIVER_ID}/block",
            headers=self.admin_headers,
            json={"reason": "Safety review"},
        )

        self.assertEqual(response.status_code, 200)
        trip_update = test_config.trips_collection.update_one.call_args.args[1]
        self.assertEqual(trip_update["$set"]["status"], "paused")
        bus_update = test_config.buses_collection.update_one.call_args.args[1]
        self.assertEqual(bus_update["$set"]["operationalStatus"], "paused")
        self.assertFalse(bus_update["$set"]["isActive"])
        emitted_payload = emit.call_args.args[1]
        self.assertEqual(emitted_payload["operationalStatus"], "paused")
        self.assertFalse(emitted_payload["isActive"])

    @patch.object(document_routes, "delete_document")
    @patch.object(document_routes, "upload_document")
    def test_document_replacement_loses_race_safely(
        self,
        upload_document,
        delete_document,
    ):
        documents = required_documents()
        driver = approved_driver()
        driver.update({
            "mobile": "94712345678",
            "documents": documents,
            "kycRevision": 4,
            "kycStatus": "APPROVED",
        })
        new_document = {
            "fileName": "94712345678/new-nic-front.jpg",
            "url": "https://storage.example/new-nic-front.jpg",
            "mimeType": "image/jpeg",
        }
        upload_document.return_value = new_document
        test_config.drivers_collection.find_one.side_effect = [
            driver,
            {"_id": ObjectId(DRIVER_ID)},
        ]
        test_config.drivers_collection.update_one.return_value = SimpleNamespace(
            matched_count=0,
        )

        response = self.client.post(
            f"/api/driver/{DRIVER_ID}/documents/upload",
            headers=self.headers,
            data={
                "docType": "nicFront",
                "file": (
                    io.BytesIO(b"\xff\xd8\xff\xe0valid-test-image"),
                    "nic-front.jpg",
                ),
            },
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 409)
        replacement_query = (
            test_config.drivers_collection.update_one.call_args.args[0]
        )
        self.assertIn({"kycRevision": 4}, replacement_query["$and"])
        self.assertIn(
            {"documents.nicFront": documents["nicFront"]},
            replacement_query["$and"],
        )
        self.assertIn(
            {"verificationStatus": "approved"},
            replacement_query["$and"],
        )
        delete_document.assert_called_once_with(new_document["fileName"])

    @patch.object(document_routes, "delete_document")
    def test_document_delete_commits_cas_before_storage_cleanup(
        self,
        delete_document,
    ):
        events = []
        documents = required_documents()
        driver = approved_driver()
        driver.update({
            "verificationStatus": "under_review",
            "documents": documents,
            "kycRevision": 2,
        })
        test_config.drivers_collection.find_one.return_value = driver

        def update_driver(*_args, **_kwargs):
            events.append("database")
            return SimpleNamespace(matched_count=1)

        def delete_storage(*_args, **_kwargs):
            events.append("storage")

        test_config.drivers_collection.update_one.side_effect = update_driver
        delete_document.side_effect = delete_storage

        response = self.client.delete(
            f"/api/driver/{DRIVER_ID}/documents/nicFront",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(events, ["database", "storage"])
        delete_query = test_config.drivers_collection.update_one.call_args.args[0]
        self.assertIn({"kycRevision": 2}, delete_query["$and"])
        self.assertIn(
            {"documents.nicFront": documents["nicFront"]},
            delete_query["$and"],
        )

    @patch.object(auth_routes, "send_sms", return_value={"ok": True})
    @patch.object(auth_routes, "generate_otp", return_value="123456")
    def test_login_otp_is_hashed_and_provider_response_is_private(
        self,
        generate_otp,
        send_sms,
    ):
        driver = approved_driver()
        driver["mobile"] = "94712345678"
        test_config.drivers_collection.find_one.return_value = driver
        test_config.otp_collection.find_one.return_value = None
        reservation_id = ObjectId("64b000000000000000000008")
        test_config.otp_collection.find_one_and_update.return_value = {
            "_id": reservation_id,
            "otpKey": "login:94712345678",
            "otpHash": auth_routes.otp_hash(
                "94712345678",
                "login",
                "123456",
            ),
        }

        response = self.client.post(
            "/api/driver/login/request-otp",
            json={"mobile": "0712345678"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("sms_result", response.get_json())
        update = test_config.otp_collection.find_one_and_update.call_args.args[1]
        self.assertNotIn("otp", update["$set"])
        self.assertEqual(
            update["$set"]["otpHash"],
            auth_routes.otp_hash("94712345678", "login", "123456"),
        )
        self.assertEqual(update["$set"]["attempts"], 0)
        self.assertIn("otp", update["$unset"])
        generate_otp.assert_called_once()
        send_sms.assert_called_once()

    @patch.object(auth_routes, "send_sms")
    def test_login_otp_resend_cooldown_skips_sms(self, send_sms):
        driver = approved_driver()
        driver["mobile"] = "94712345678"
        test_config.drivers_collection.find_one.return_value = driver
        test_config.otp_collection.find_one.return_value = {
            "_id": ObjectId("64b000000000000000000004"),
            "mobile": "94712345678",
            "purpose": "login",
            "sent_at": datetime.now(),
        }

        response = self.client.post(
            "/api/driver/login/request-otp",
            json={"mobile": "94712345678"},
        )

        self.assertEqual(response.status_code, 429)
        self.assertGreater(response.get_json()["retryAfterSeconds"], 0)
        self.assertIn("Retry-After", response.headers)
        send_sms.assert_not_called()

    def test_login_otp_fifth_invalid_attempt_invalidates_code(self):
        record_id = ObjectId("64b000000000000000000005")
        test_config.otp_collection.find_one.return_value = {
            "_id": record_id,
            "mobile": "94712345678",
            "purpose": "login",
            "otpHash": auth_routes.otp_hash(
                "94712345678",
                "login",
                "123456",
            ),
            "expires_at": datetime.now() + timedelta(minutes=5),
            "attempts": 4,
        }
        test_config.otp_collection.find_one_and_update.return_value = {
            "_id": record_id,
            "mobile": "94712345678",
            "purpose": "login",
            "otpHash": auth_routes.otp_hash(
                "94712345678",
                "login",
                "123456",
            ),
            "expires_at": datetime.now() + timedelta(minutes=5),
            "attempts": 5,
        }

        response = self.client.post(
            "/api/driver/login/verify-otp",
            json={"mobile": "94712345678", "otp": "999999"},
        )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.get_json()["attemptsRemaining"], 0)
        lock_query, lock_update = (
            test_config.otp_collection.update_one.call_args.args
        )
        self.assertEqual(lock_query["_id"], record_id)
        self.assertEqual(lock_query["attempts"]["$gte"], 5)
        self.assertEqual(lock_update["$set"]["attempts"], 5)
        self.assertIn("otpHash", lock_update["$unset"])
        self.assertIn("registration_data", lock_update["$unset"])
        self.assertNotIn("nextAllowedAt", lock_update["$unset"])
        test_config.otp_collection.delete_one.assert_not_called()
        test_config.drivers_collection.find_one.assert_not_called()

    def test_expired_otp_cleanup_matches_the_stale_snapshot(self):
        record_id = ObjectId("64b000000000000000000011")
        expires_at = datetime.now() - timedelta(minutes=1)
        old_hash = auth_routes.otp_hash(
            "94712345678",
            "login",
            "111111",
        )
        test_config.otp_collection.find_one.return_value = {
            "_id": record_id,
            "otpHash": old_hash,
            "expires_at": expires_at,
            "attempts": 0,
        }

        with self.client.application.app_context():
            claimed, otp_error = auth_routes.consume_otp_record(
                "94712345678",
                "login",
                "111111",
            )

        self.assertIsNone(claimed)
        self.assertEqual(otp_error[1], 400)
        deletion_query = test_config.otp_collection.delete_one.call_args.args[0]
        self.assertEqual(deletion_query["_id"], record_id)
        self.assertEqual(deletion_query["otpHash"], old_hash)
        self.assertEqual(deletion_query["expires_at"], expires_at)

    def test_successful_otp_is_atomically_consumed_only_once(self):
        record = {
            "_id": ObjectId("64b000000000000000000009"),
            "mobile": "94712345678",
            "purpose": "login",
            "otpHash": auth_routes.otp_hash(
                "94712345678",
                "login",
                "123456",
            ),
            "expires_at": datetime.now() + timedelta(minutes=5),
            "attempts": 0,
        }
        test_config.otp_collection.find_one.return_value = record
        test_config.otp_collection.find_one_and_delete.side_effect = [
            record,
            None,
        ]

        with self.client.application.app_context():
            claimed, first_error = auth_routes.consume_otp_record(
                "94712345678",
                "login",
                "123456",
            )
            duplicate_claim, second_error = auth_routes.consume_otp_record(
                "94712345678",
                "login",
                "123456",
            )

        self.assertEqual(claimed, record)
        self.assertIsNone(first_error)
        self.assertIsNone(duplicate_claim)
        self.assertEqual(second_error[1], 409)

    @patch.object(auth_routes, "send_sms", return_value={"ok": False})
    @patch.object(auth_routes, "generate_otp", return_value="123456")
    def test_failed_registration_sms_conditionally_deletes_pii_record(
        self,
        generate_otp,
        send_sms,
    ):
        test_config.drivers_collection.find_one.return_value = None
        test_config.otp_collection.find_one.return_value = None
        reservation_id = ObjectId("64b000000000000000000010")
        request_hash = auth_routes.otp_hash(
            "94712345678",
            "register",
            "123456",
        )
        test_config.otp_collection.find_one_and_update.return_value = {
            "_id": reservation_id,
            "otpHash": request_hash,
        }

        response = self.client.post(
            "/api/driver/register/request-otp",
            json=registration_payload(),
        )

        self.assertEqual(response.status_code, 502)
        test_config.otp_collection.delete_one.assert_called_once_with({
            "_id": reservation_id,
            "otpHash": request_hash,
        })
        generate_otp.assert_called_once()
        send_sms.assert_called_once()

    @patch.object(auth_routes, "send_sms")
    def test_registration_rejects_forged_document_references(self, send_sms):
        response = self.client.post(
            "/api/driver/register/request-otp",
            json=registration_payload(
                documents={
                    "nicFront": {
                        "fileName": "another-driver/forged.jpg",
                        "url": "https://example.com/forged.jpg",
                        "mimeType": "image/jpeg",
                    },
                },
            ),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("storage path", response.get_json()["error"])
        send_sms.assert_not_called()
        test_config.otp_collection.update_one.assert_not_called()

    @patch.object(auth_routes, "get_storage_url", side_effect=RuntimeError)
    def test_registration_treats_null_only_documents_as_optional(
        self,
        get_storage_url,
    ):
        documents, error = auth_routes.sanitize_registration_documents(
            {
                "nicFront": None,
                "nicBack": None,
                "drivingLicenseFront": None,
                "drivingLicenseBack": None,
            },
            "94712345678",
        )

        self.assertEqual(documents, {})
        self.assertIsNone(error)
        get_storage_url.assert_not_called()

    def test_registration_rejects_legacy_operational_fields(self):
        response = self.client.post(
            "/api/driver/register/request-otp",
            json=registration_payload(
                busRouteNumber="123",
                vehicleRegistrationNumber="NC-1234",
                busNtcPermitNumber="P-123",
                conductorName="Legacy Conductor",
            ),
        )

        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(
            payload["code"],
            "UNSUPPORTED_REGISTRATION_FIELDS",
        )
        self.assertEqual(
            set(payload["fields"]),
            {
                "busNtcPermitNumber",
                "busRouteNumber",
                "conductorName",
                "vehicleRegistrationNumber",
            },
        )
        test_config.otp_collection.find_one_and_update.assert_not_called()

    @patch.object(auth_routes, "consume_otp_record")
    def test_registration_verify_creates_clean_driver_record(
        self,
        consume_otp_record,
    ):
        consume_otp_record.return_value = (
            {
                "_id": ObjectId("64b000000000000000000012"),
                "registration_data": {
                    "fullName": "Test Driver",
                    "nic": "200012345678",
                    "email": "driver@example.com",
                    "password": "hashed-password",
                    "driverNtcRegistrationNumber": "D-123",
                    "drivingLicenseNumber": "L-123",
                    "drivingLicenseExpiry": "2099-01-01",
                    "depotOperator": "Test Depot",
                    "documents": {},
                },
            },
            None,
        )
        test_config.drivers_collection.find_one.return_value = None
        test_config.drivers_collection.insert_one.return_value = SimpleNamespace(
            inserted_id=ObjectId(DRIVER_ID),
        )

        response = self.client.post(
            "/api/driver/register/verify-otp",
            json={
                "mobile": "0712345678",
                "otp": "123456",
            },
        )

        self.assertEqual(response.status_code, 200)
        stored_driver = (
            test_config.drivers_collection.insert_one.call_args.args[0]
        )
        self.assertEqual(
            stored_driver["driverNtcRegistrationNumberKey"],
            "D-123",
        )
        self.assertEqual(
            stored_driver["drivingLicenseNumberKey"],
            "L-123",
        )
        self.assertEqual(stored_driver["verificationStatus"], "pending")
        self.assertEqual(stored_driver["kycStatus"], "NOT_SUBMITTED")
        self.assertIn("createdAt", stored_driver)
        self.assertIn("updatedAt", stored_driver)

        for removed_field in (
            "conductorName",
            "busNtcPermitNumber",
            "busRouteNumber",
            "vehicleRegistrationNumber",
            "vehicleAssignmentKey",
        ):
            self.assertNotIn(removed_field, stored_driver)

    def test_registration_availability_checks_driver_credentials(self):
        test_config.drivers_collection.find_one.side_effect = [
            None,
            None,
            None,
            {"_id": ObjectId(DRIVER_ID)},
            None,
        ]

        response = self.client.post(
            "/api/driver/register/check-availability",
            json={
                "mobile": "0712345678",
                "email": "driver@example.com",
                "nic": "200012345678",
                "driverNtcRegistrationNumber": "D-123",
                "drivingLicenseNumber": "L-123",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertFalse(payload["available"])
        self.assertEqual(
            payload["conflicts"]["driverNtcRegistrationNumber"],
            "This driver NTC registration number is already registered",
        )

    def test_notifications_are_private_and_scoped_to_token_subject(self):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        cursor = MagicMock()
        test_config.notifications_collection.find.return_value = cursor
        cursor.sort.return_value.limit.return_value = [{
            "_id": ObjectId("64b000000000000000000007"),
            "driverId": DRIVER_ID,
            "title": "Route update",
            "message": "Operations updated your assigned stop sequence.",
            "type": "route",
            "read": False,
            "createdAt": NOW,
            "privateAdminNote": "not public",
        }]

        response = self.client.get(
            "/api/driver/notifications?limit=20",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        notification = response.get_json()["notifications"][0]
        self.assertEqual(notification["title"], "Route update")
        self.assertNotIn("driverId", notification)
        self.assertNotIn("privateAdminNote", notification)
        query = test_config.notifications_collection.find.call_args.args[0]
        self.assertTrue(any(
            condition.get("driverId") == DRIVER_ID
            or condition.get("driver_id") == DRIVER_ID
            for condition in query["$or"]
        ))


if __name__ == "__main__":
    unittest.main()
