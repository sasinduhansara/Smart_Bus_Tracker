"""
test_eta.py – Unit tests for deterministic ETA fallback, prediction persistence, and error handling.
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from services.eta_service import (
    _deterministic_eta_minutes,
    calculate_remaining_distance_km,
    estimate_traffic_level,
)
from services.eta_storage_service import record_actual_arrival, store_prediction


class TestEtaService(unittest.TestCase):

    def setUp(self):
        self.sample_route = {
            "id": "507f1f77bcf86cd799439011",
            "routeNumber": "100",
            "name": "Colombo - Panadura",
            "polyline": [
                {"latitude": 6.9271, "longitude": 79.8612},  # Colombo Fort
                {"latitude": 6.8722, "longitude": 79.8656},  # Wellawatte
                {"latitude": 6.7106, "longitude": 79.9074},  # Panadura
            ],
            "stops": [
                {
                    "id": "stop-colombo",
                    "name": "Colombo Fort",
                    "latitude": 6.9271,
                    "longitude": 79.8612,
                    "sequence": 1,
                },
                {
                    "id": "stop-wellawatte",
                    "name": "Wellawatte",
                    "latitude": 6.8722,
                    "longitude": 79.8656,
                    "sequence": 2,
                },
                {
                    "id": "stop-panadura",
                    "name": "Panadura",
                    "latitude": 6.7106,
                    "longitude": 79.9074,
                    "sequence": 3,
                },
            ],
        }

    def test_deterministic_eta_calculation(self):
        now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
        eta_mins = _deterministic_eta_minutes(
            remaining_distance_km=10.0,
            current_speed_kmh=30.0,
            now=now,
        )
        self.assertGreater(eta_mins, 0)
        self.assertIsInstance(eta_mins, float)

    def test_remaining_distance_km(self):
        dest_stop = self.sample_route["stops"][2]
        dist_km = calculate_remaining_distance_km(
            bus_latitude=6.9271,
            bus_longitude=79.8612,
            destination_stop=dest_stop,
            route=self.sample_route,
        )
        self.assertGreater(dist_km, 20.0)

    def test_traffic_level_peak_hours(self):
        # Weekday 8:30 AM Sri Lanka time (+5:30) => 3:00 AM UTC
        morning_peak_utc = datetime(2026, 7, 21, 3, 0, tzinfo=timezone.utc)
        traffic = estimate_traffic_level(morning_peak_utc)
        self.assertEqual(traffic, 0.8)

    @patch("services.eta_storage_service.eta_predictions_collection")
    def test_store_prediction_success(self, mock_coll):
        mock_result = MagicMock()
        mock_result.inserted_id = "507f1f77bcf86cd799439099"
        mock_coll.insert_one.return_value = mock_result

        pid = store_prediction(
            bus_id="bus-1",
            route_id="507f1f77bcf86cd799439011",
            route_number="100",
            trip_id="trip-10",
            destination_stop_id="stop-panadura",
            destination_stop_name="Panadura",
            remaining_distance_km=15.0,
            eta_minutes=25.0,
            estimated_arrival_at="2026-07-21T10:30:00+05:30",
            model_version="deterministic-v1",
            feature_snapshot={"distance_km": 15.0},
        )
        self.assertEqual(pid, "507f1f77bcf86cd799439099")
        mock_coll.insert_one.assert_called_once()


if __name__ == "__main__":
    unittest.main()
