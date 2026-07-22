import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from bson.objectid import ObjectId


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import schedule_service


class ScheduleServiceContractTests(unittest.TestCase):
    def test_supported_service_types_exclude_ac(self):
        self.assertEqual(
            schedule_service.SERVICE_TYPES,
            {"sltb", "private", "intercity"},
        )

    def test_departure_time_requires_twenty_four_hour_format(self):
        self.assertEqual(schedule_service._normalize_time("06:30"), "06:30")
        with self.assertRaises(schedule_service.ScheduleValidationError):
            schedule_service._normalize_time("6.30 AM")

    def test_operating_days_are_deduplicated_and_ordered(self):
        days = schedule_service._normalize_operating_days([
            "friday",
            "monday",
            "friday",
        ])
        self.assertEqual(days, ["monday", "friday"])

    def test_schedule_template_uses_route_details(self):
        route = {
            "id": str(ObjectId()),
            "routeNumber": "123",
            "name": "Town A - Town B",
            "origin": "Town A",
            "destination": "Town B",
            "depotName": "Main Depot",
            "recordStatus": "active",
            "serviceCategories": ["sltb"],
        }
        insert_result = MagicMock(inserted_id=ObjectId())

        with (
            patch.object(
                schedule_service,
                "get_route_admin_details",
                return_value=route,
            ),
            patch.object(
                schedule_service.schedule_templates_collection,
                "insert_one",
                return_value=insert_result,
            ),
        ):
            created = schedule_service.create_schedule_template(
                {
                    "routeId": route["id"],
                    "serviceType": "sltb",
                    "departureTime": "06:30",
                    "operatingDays": ["monday", "tuesday"],
                    "recordStatus": "active",
                },
                actor="admin@example.com",
            )

        self.assertEqual(created["routeNumber"], "123")
        self.assertEqual(created["departureTime"], "06:30")

    def test_schedule_allows_supported_service_type_for_any_active_route(self):
        route = {
            "id": str(ObjectId()),
            "routeNumber": "123",
            "name": "Town A - Town B",
            "origin": "Town A",
            "destination": "Town B",
            "depotName": "Main Depot",
            "recordStatus": "active",
            "serviceCategories": ["private"],
        }
        insert_result = MagicMock(inserted_id=ObjectId())

        with (
            patch.object(
                schedule_service,
                "get_route_admin_details",
                return_value=route,
            ),
            patch.object(
                schedule_service.schedule_templates_collection,
                "insert_one",
                return_value=insert_result,
            ),
        ):
            created = schedule_service.create_schedule_template(
                {
                    "routeId": route["id"],
                    "serviceType": "intercity",
                    "departureTime": "06:30",
                    "operatingDays": ["monday"],
                    "recordStatus": "active",
                },
                actor="admin@example.com",
            )

        self.assertEqual(created["serviceType"], "intercity")
        self.assertEqual(created["routeNumber"], "123")

    def test_daily_service_keys_separate_route_bus_and_driver_conflicts(self):
        self.assertEqual(
            schedule_service._daily_service_key(
                "2026-07-22", "route-1", "private", "06:30"
            ),
            "2026-07-22:route-1:private:06:30",
        )
        self.assertEqual(
            schedule_service._assignment_key(
                "2026-07-22", "06:30", "bus-1"
            ),
            "2026-07-22:06:30:bus-1",
        )

    def test_admin_routes_expose_schedule_and_roster_endpoints(self):
        source_path = (
            Path(__file__).resolve().parents[1]
            / "routes"
            / "admin_routes.py"
        )
        source = source_path.read_text(encoding="utf-8")

        for endpoint in (
            "/api/admin/scheduling/references",
            "/api/admin/schedule-templates",
            "/api/admin/daily-services",
        ):
            self.assertIn(endpoint, source)


if __name__ == "__main__":
    unittest.main()
