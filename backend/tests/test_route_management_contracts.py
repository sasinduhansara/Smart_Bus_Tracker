import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from bson.objectid import ObjectId

from services import route_service


VALID_ROUTE = {
    "routeNumber": "123",
    "name": "Kuliyapitiya - Kurunegala",
    "direction": "outbound",
    "serviceCategories": ["sltb", "private"],
    "recordStatus": "active",
    "depotName": "Kuliyapitiya Depot",
    "terminalRadiusMeters": 500,
    "stops": [
        {
            "id": "kuliyapitiya",
            "name": "Kuliyapitiya Bus Stand",
            "latitude": 7.4688,
            "longitude": 80.0401,
        },
        {
            "id": "kurunegala",
            "name": "Kurunegala Bus Stand",
            "latitude": 7.4863,
            "longitude": 80.3647,
        },
    ],
}


class RouteManagementContractTests(unittest.TestCase):
    def test_payload_builds_canonical_identity_and_terminal_data(self):
        normalized = route_service.normalize_route_payload(VALID_ROUTE)

        self.assertEqual(normalized["routeNumberKey"], "123")
        self.assertEqual(normalized["routeKey"], "123:outbound")
        self.assertEqual(normalized["origin"], "Kuliyapitiya Bus Stand")
        self.assertEqual(normalized["destination"], "Kurunegala Bus Stand")
        self.assertEqual(
            [stop["sequence"] for stop in normalized["stops"]],
            [1, 2],
        )
        self.assertEqual(len(normalized["polyline"]), 2)
        self.assertEqual(len(normalized["terminals"]), 2)
        self.assertEqual(
            normalized["terminals"][0]["startRadiusMeters"],
            500,
        )


    def test_name_only_stops_are_valid_for_simplified_admin_form(self):
        normalized = route_service.normalize_route_payload({
            "routeNumber": "555",
            "name": "Town A - Town B",
            "depotName": "Town A Depot",
            "recordStatus": "active",
            "serviceCategories": ["sltb", "private", "intercity"],
            "stops": [
                {"name": "Town A Bus Stand"},
                {"name": "Middle Junction"},
                {"name": "Town B Bus Stand"},
            ],
        })

        self.assertEqual(normalized["origin"], "Town A Bus Stand")
        self.assertEqual(normalized["destination"], "Town B Bus Stand")
        self.assertEqual(normalized["depotName"], "Town A Depot")
        self.assertEqual(normalized["polyline"], [])
        self.assertEqual(normalized["terminals"], [])
        self.assertNotIn("latitude", normalized["stops"][0])

    def test_route_requires_at_least_two_valid_stops(self):
        invalid = {
            **VALID_ROUTE,
            "stops": VALID_ROUTE["stops"][:1],
        }

        with self.assertRaises(route_service.RouteValidationError) as context:
            route_service.normalize_route_payload(invalid)

        self.assertEqual(context.exception.field, "stops")

    def test_route_direction_is_part_of_unique_identity(self):
        outbound = route_service.normalize_route_payload(VALID_ROUTE)
        returning = route_service.normalize_route_payload({
            **VALID_ROUTE,
            "direction": "return",
            "stops": list(reversed(VALID_ROUTE["stops"])),
        })

        self.assertEqual(outbound["routeKey"], "123:outbound")
        self.assertEqual(returning["routeKey"], "123:return")
        self.assertNotEqual(outbound["routeKey"], returning["routeKey"])

    def test_development_routes_are_disabled_by_default(self):
        cursor = MagicMock()
        cursor.sort.return_value = []
        collection = MagicMock()
        collection.find.return_value = cursor

        with (
            patch.object(route_service, "routes_collection", collection),
            patch.object(route_service, "DEVELOPMENT_ROUTES", [VALID_ROUTE]),
            patch.dict(os.environ, {}, clear=False),
        ):
            os.environ.pop("ENABLE_DEVELOPMENT_ROUTE_FALLBACK", None)
            routes = route_service.get_all_routes()

        self.assertEqual(routes, [])

    def test_create_route_returns_serializable_details(self):
        inserted_id = ObjectId("64b000000000000000000099")
        collection = MagicMock()
        collection.insert_one.return_value = SimpleNamespace(
            inserted_id=inserted_id,
        )

        with patch.object(route_service, "routes_collection", collection):
            route = route_service.create_route_record(
                VALID_ROUTE,
                actor="admin@example.com",
            )

        self.assertEqual(route["id"], str(inserted_id))
        self.assertEqual(route["recordStatus"], "active")
        self.assertEqual(route["stopCount"] if "stopCount" in route else len(route["stops"]), 2)
        inserted = collection.insert_one.call_args.args[0]
        self.assertEqual(inserted["createdBy"], "admin@example.com")
        self.assertEqual(inserted["updatedBy"], "admin@example.com")


if __name__ == "__main__":
    unittest.main()
