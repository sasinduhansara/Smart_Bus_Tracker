import sys
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch

from flask import Flask


BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

test_config = ModuleType("config")
test_config.routes_collection = MagicMock()
original_config = sys.modules.get("config")
sys.modules["config"] = test_config

try:
    import routes.route_routes as route_routes
    import services.route_service as route_service
    from routes.route_routes import route_bp
    from services.route_service import search_routes_and_stops
finally:
    if original_config is None:
        sys.modules.pop("config", None)
    else:
        sys.modules["config"] = original_config


def make_route(stops=None):
    return {
        "routeNumber": "138",
        "name": "Straße - Pettah",
        "direction": "outbound",
        "polyline": [
            {"latitude": 6.8, "longitude": 79.9},
            {"latitude": 6.9, "longitude": 79.8},
        ],
        "stops": stops or [{
            "id": "stop-1",
            "name": "Straße Junction",
            "latitude": 6.85,
            "longitude": 79.85,
            "sequence": 1,
        }],
    }


class RouteSearchServiceTests(unittest.TestCase):
    def test_route_terminals_are_normalized_with_a_configurable_default_radius(self):
        route = make_route()
        route["terminals"] = [
            {
                "id": "origin",
                "name": "Origin Terminal",
                "latitude": 7.4688,
                "longitude": 80.0401,
            },
            {
                "id": "destination",
                "name": "Destination Terminal",
                "latitude": 7.4863,
                "longitude": 80.3647,
                "startRadiusMeters": 750,
            },
        ]

        normalized = route_service.normalize_route(route)

        self.assertIsNotNone(normalized)
        self.assertEqual(normalized["terminals"][0]["startRadiusMeters"], 500)
        self.assertEqual(normalized["terminals"][1]["startRadiusMeters"], 750)

    @patch.object(route_service, "get_all_routes")
    def test_casefolds_and_returns_only_public_result_fields(self, get_routes):
        get_routes.return_value = [make_route()]

        results = search_routes_and_stops("  STRASSE  ", 25)

        self.assertEqual(results, [
            {
                "id": "route:138",
                "type": "route",
                "title": "Route 138",
                "subtitle": "Straße - Pettah",
                "routeNumber": "138",
            },
            {
                "id": "stop:138:stop-1",
                "type": "stop",
                "title": "Straße Junction",
                "subtitle": "Route 138 · Straße - Pettah",
                "routeNumber": "138",
                "stopId": "stop-1",
            },
        ])

    @patch.object(route_service, "get_all_routes")
    def test_never_returns_more_than_twenty_five_results(self, get_routes):
        stops = [
            {
                "id": f"stop-{index}",
                "name": f"Central Stop {index}",
                "latitude": 6.8,
                "longitude": 79.9,
                "sequence": index,
            }
            for index in range(30)
        ]
        get_routes.return_value = [make_route(stops)]

        results = search_routes_and_stops("central", 100)

        self.assertEqual(len(results), 25)


class RouteSearchEndpointTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(route_bp)
        app.testing = True
        self.client = app.test_client()

    @patch.object(route_routes, "search_routes_and_stops")
    def test_trims_query_and_uses_default_limit(self, search):
        search.return_value = []

        response = self.client.get(
            "/api/search",
            query_string={"q": "  Pettah  "},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {
            "status": "success",
            "query": "Pettah",
            "results": [],
        })
        search.assert_called_once_with("Pettah", 8)

    @patch.object(route_routes, "search_routes_and_stops")
    def test_rejects_invalid_queries_before_searching(self, search):
        invalid_queries = (None, "   ", "x" * 81)

        for query in invalid_queries:
            with self.subTest(query=query):
                query_string = {} if query is None else {"q": query}
                response = self.client.get(
                    "/api/search",
                    query_string=query_string,
                )

                self.assertEqual(response.status_code, 400)
                payload = response.get_json()
                self.assertEqual(payload["status"], "error")
                self.assertEqual(payload["results"], [])

        search.assert_not_called()

    @patch.object(route_routes, "search_routes_and_stops")
    def test_rejects_invalid_limits_before_searching(self, search):
        for limit in ("", "0", "26", "1.5", "many"):
            with self.subTest(limit=limit):
                response = self.client.get(
                    "/api/search",
                    query_string={"q": "Pettah", "limit": limit},
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["results"], [])

        search.assert_not_called()


if __name__ == "__main__":
    unittest.main()
