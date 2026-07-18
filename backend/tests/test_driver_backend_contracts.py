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
        "busRouteNumber": "138",
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


def route_details():
    return {
        "routeNumber": "138",
        "name": "Homagama - Pettah",
        "direction": "outbound",
        "polyline": [
            {"latitude": 6.8, "longitude": 79.9},
            {"latitude": 6.9, "longitude": 79.8},
        ],
        "stops": [
            {"id": "a", "name": "Homagama", "latitude": 6.8, "longitude": 79.9, "sequence": 1},
            {"id": "b", "name": "Pettah", "latitude": 6.9, "longitude": 79.8, "sequence": 2},
        ],
    }


def canonical_trip(status="active"):
    trip = {
        "_id": TRIP_ID,
        "driverId": DRIVER_ID,
        "activeKey": DRIVER_ID,
        "busId": "NC-1234",
        "vehicleRegistrationNumber": "NC-1234",
        "routeNumber": "138",
        "routeName": "Homagama - Pettah",
        "origin": "Homagama",
        "destination": "Pettah",
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

        response = self.client.post("/api/driver/trips/start", headers=self.headers)

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload["status"], "started")
        self.assertEqual(payload["trip"]["status"], "active")
        self.assertEqual(payload["trip"]["busId"], "NC-1234")
        inserted_trip = test_config.trips_collection.insert_one.call_args.args[0]
        self.assertEqual(inserted_trip["activeKey"], DRIVER_ID)
        self.assertEqual(inserted_trip["busActiveKey"], "NC-1234")
        self.assertEqual(inserted_trip["routeNumber"], "138")
        self.assertEqual(inserted_trip["distanceKm"], 0)
        bus_update = test_config.buses_collection.update_one.call_args.args[1]["$set"]
        self.assertEqual(bus_update["operationalStatus"], "active")
        self.assertNotIn("nic", payload["bus"])
        emit.assert_called_once()

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

        response = self.client.post("/api/driver/trips/start", headers=self.headers)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["trip"]["status"], "paused")

    @patch.object(trip_routes, "get_route_details", return_value=route_details())
    def test_start_trip_prevents_two_drivers_using_the_same_bus(self, get_route):
        test_config.drivers_collection.find_one.return_value = approved_driver()
        other_trip = canonical_trip()
        other_trip["driverId"] = "64b000000000000000000009"
        test_config.trips_collection.find_one.side_effect = [None, other_trip]

        response = self.client.post("/api/driver/trips/start", headers=self.headers)

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

    @patch.object(bus_routes.socketio, "emit")
    def test_location_persists_trip_and_emits_public_safe_payload(self, emit):
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
        self.assertNotIn("driver_id", payload["bus"])
        self.assertNotIn("nic", payload["bus"])
        trip_update = test_config.trips_collection.update_one.call_args.args[1]
        self.assertEqual(trip_update["$inc"]["locationUpdateCount"], 1)
        self.assertEqual(trip_update["$inc"]["distanceKm"], 0)
        emit.assert_called_once_with("bus_location_update", payload["bus"])

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
            json={
                "fullName": "Test Driver",
                "nic": "200012345678",
                "mobile": "0712345678",
                "email": "driver@example.com",
                "password": "secure123",
                "conductorName": "Test Conductor",
                "driverNtcRegistrationNumber": "D-123",
                "busNtcPermitNumber": "B-123",
                "drivingLicenseNumber": "L-123",
                "drivingLicenseExpiry": "2099-01-01",
                "busRouteNumber": "138",
                "vehicleRegistrationNumber": "NC-1234",
                "depotOperator": "Test Depot",
                "documents": {},
            },
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
            json={
                "fullName": "Test Driver",
                "nic": "200012345678",
                "mobile": "0712345678",
                "email": "driver@example.com",
                "password": "secure123",
                "conductorName": "Test Conductor",
                "driverNtcRegistrationNumber": "D-123",
                "busNtcPermitNumber": "B-123",
                "drivingLicenseNumber": "L-123",
                "drivingLicenseExpiry": "2099-01-01",
                "busRouteNumber": "138",
                "vehicleRegistrationNumber": "NC-1234",
                "depotOperator": "Test Depot",
                "documents": {
                    "nicFront": {
                        "fileName": "another-driver/forged.jpg",
                        "url": "https://example.com/forged.jpg",
                        "mimeType": "image/jpeg",
                    },
                },
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("storage path", response.get_json()["error"])
        send_sms.assert_not_called()
        test_config.otp_collection.update_one.assert_not_called()

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
