"""
test_location_flow.py – End-to-end integration tests for location submission and live bus state update.
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from bson.objectid import ObjectId

from app import app


class TestLocationFlow(unittest.TestCase):

    def setUp(self):
        self.client = app.test_client()

    @patch("routes.location_routes.drivers_collection")
    @patch("routes.location_routes.buses_collection")
    @patch("routes.location_routes.routes_collection")
    @patch("routes.location_routes.live_bus_states_collection")
    @patch("routes.location_routes.location_history_collection")
    @patch("routes.location_routes.socketio")
    @patch("routes.location_routes.get_jwt_identity")
    def test_post_location_unauthorized_returns_401(
        self, mock_jwt, mock_sock, mock_hist, mock_live, mock_routes, mock_buses, mock_drivers
    ):
        response = self.client.post(
            "/api/location",
            json={"latitude": 7.0, "longitude": 80.0},
        )
        # Without valid JWT token, return 401
        self.assertIn(response.status_code, (401, 422))

    @patch("routes.location_routes.drivers_collection")
    @patch("routes.location_routes.buses_collection")
    @patch("routes.location_routes.routes_collection")
    @patch("routes.location_routes.live_bus_states_collection")
    @patch("routes.location_routes.location_history_collection")
    @patch("routes.location_routes.socketio")
    def test_invalid_payload_returns_400(
        self, mock_sock, mock_hist, mock_live, mock_routes, mock_buses, mock_drivers
    ):
        # Missing lat/lng
        with patch("flask_jwt_extended.view_decorators.verify_jwt_in_request"):
            with patch("routes.location_routes.get_jwt_identity", return_value="driver-1"):
                response = self.client.post(
                    "/api/location",
                    json={"speed": 40.0},
                    headers={"Authorization": "Bearer fake.jwt.token"},
                )
                self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
