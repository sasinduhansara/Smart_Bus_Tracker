"""
test_passenger_search.py – Unit tests for passenger directory search and route detail lookup.
"""

import unittest
from unittest.mock import patch

from app import app
from services.route_service import search_routes_and_stops


class TestPassengerSearch(unittest.TestCase):

    def setUp(self):
        self.client = app.test_client()

    @patch("services.route_service.get_all_routes")
    def test_search_routes_and_stops_matches_route_number(self, mock_get_routes):
        mock_get_routes.return_value = [
            {
                "routeNumber": "100",
                "name": "Colombo - Panadura",
                "direction": "outbound",
                "origin": "Colombo",
                "destination": "Panadura",
                "stops": [
                    {"id": "s1", "name": "Fort", "sequence": 1},
                    {"id": "s2", "name": "Wellawatte", "sequence": 2},
                ],
            }
        ]

        results = search_routes_and_stops("100", limit=10)

        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["type"], "route")
        self.assertEqual(results[0]["routeNumber"], "100")

    @patch("services.route_service.get_all_routes")
    def test_search_routes_and_stops_matches_stop_name(self, mock_get_routes):
        mock_get_routes.return_value = [
            {
                "routeNumber": "100",
                "name": "Colombo - Panadura",
                "direction": "outbound",
                "origin": "Colombo",
                "destination": "Panadura",
                "stops": [
                    {"id": "s1", "name": "Fort", "sequence": 1},
                    {"id": "s2", "name": "Wellawatte", "sequence": 2},
                ],
            }
        ]

        results = search_routes_and_stops("Wellawatte", limit=10)

        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["type"], "stop")
        self.assertEqual(results[0]["title"], "Wellawatte")
        self.assertEqual(results[0]["stopId"], "s2")

    def test_passenger_search_endpoint_empty_query(self):
        response = self.client.get("/api/passenger/stops/search?q=")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["stops"], [])


if __name__ == "__main__":
    unittest.main()
