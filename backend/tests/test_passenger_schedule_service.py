import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import passenger_schedule_service as service


ROUTE = {
    "id": "route-138-outbound",
    "routeNumber": "138",
    "name": "Town A - Town D",
    "origin": "Town A",
    "destination": "Town D",
    "direction": "outbound",
    "recordStatus": "active",
    "isActive": True,
    "serviceCategories": ["sltb", "private", "ac"],
    "stops": [
        {
            "id": "stop-a",
            "name": "Town A",
            "sequence": 1,
            "arrivalOffsetMinutes": 0,
        },
        {
            "id": "stop-b",
            "name": "Town B",
            "sequence": 2,
            "arrivalOffsetMinutes": 20,
        },
        {
            "id": "stop-c",
            "name": "Town C",
            "sequence": 3,
            "arrivalOffsetMinutes": 50,
        },
        {
            "id": "stop-d",
            "name": "Town D",
            "sequence": 4,
            "arrivalOffsetMinutes": 80,
        },
    ],
}


def daily_service(
    *,
    identifier: str,
    service_type: str,
    departure_time: str,
    status: str = "scheduled",
    trip_status: str = "",
    trip_id: str = "",
):
    return {
        "id": identifier,
        "serviceDate": "2026-07-22",
        "routeId": ROUTE["id"],
        "routeNumber": ROUTE["routeNumber"],
        "serviceType": service_type,
        "departureTime": departure_time,
        "busId": f"bus-{identifier}",
        "busRegistration": f"NB-{identifier}",
        "driverName": "Test Driver",
        "operatorName": "Test Operator",
        "status": status,
        "tripStatus": trip_status,
        "tripId": trip_id,
    }


class PassengerScheduleServiceTests(unittest.TestCase):
    def test_ac_filter_is_an_alias_for_intercity(self):
        self.assertEqual(
            service._normalize_service_types("ac"),
            {"intercity"},
        )
        self.assertEqual(
            service._service_type({"serviceType": "ac"}),
            "intercity",
        )

    @patch.object(service, "list_daily_services")
    @patch.object(service, "get_all_routes")
    def test_route_search_matches_ac_alias_and_correct_stop_order(
        self,
        get_all_routes,
        list_daily_services,
    ):
        get_all_routes.return_value = [ROUTE]
        list_daily_services.return_value = [
            daily_service(
                identifier="1",
                service_type="intercity",
                departure_time="08:00",
            )
        ]

        result = service.search_public_routes(
            from_stop_id="stop-b",
            to_stop_id="stop-d",
            service_date="2026-07-22",
            service_types="ac",
        )

        self.assertEqual(result["serviceTypes"], ["intercity"])
        self.assertEqual(len(result["routes"]), 1)
        route = result["routes"][0]
        self.assertEqual(route["fromStop"]["routeStopId"], "stop-b")
        self.assertEqual(route["toStop"]["routeStopId"], "stop-d")
        self.assertEqual(route["scheduledServiceCount"], 1)
        self.assertEqual(route["availableServiceTypes"], ["intercity"])

    @patch.object(service, "list_daily_services")
    @patch.object(service, "get_all_routes")
    def test_timetable_calculates_departure_arrival_and_duration(
        self,
        get_all_routes,
        list_daily_services,
    ):
        get_all_routes.return_value = [ROUTE]
        list_daily_services.return_value = [
            daily_service(
                identifier="1",
                service_type="sltb",
                departure_time="08:00",
            )
        ]

        result = service.get_public_timetable(
            ROUTE["id"],
            service_date="2026-07-22",
            from_stop_id="stop-b",
            to_stop_id="stop-d",
            service_types="sltb",
        )

        self.assertEqual(
            result["selectedFromStop"]["routeStopId"],
            "stop-b",
        )
        self.assertEqual(
            result["selectedToStop"]["routeStopId"],
            "stop-d",
        )
        self.assertEqual(result["selectedStop"], result["selectedFromStop"])
        self.assertEqual(result["journeyDurationMinutes"], 60)

        timetable_service = result["services"][0]
        self.assertEqual(
            timetable_service["departureFromSelectedStop"],
            "08:20",
        )
        self.assertEqual(
            timetable_service["arrivalAtDestination"],
            "09:20",
        )
        self.assertEqual(
            timetable_service["journeyDurationMinutes"],
            60,
        )
        self.assertFalse(
            timetable_service["liveTrackingAvailable"],
        )

    @patch.object(service, "list_daily_services")
    @patch.object(service, "get_all_routes")
    def test_live_tracking_is_enabled_only_for_linked_running_trip(
        self,
        get_all_routes,
        list_daily_services,
    ):
        get_all_routes.return_value = [ROUTE]
        list_daily_services.return_value = [
            daily_service(
                identifier="1",
                service_type="private",
                departure_time="08:00",
                status="in_progress",
                trip_status="active",
                trip_id="trip-1",
            ),
            daily_service(
                identifier="2",
                service_type="private",
                departure_time="09:00",
                status="scheduled",
                trip_status="",
                trip_id="",
            ),
        ]

        result = service.get_public_timetable(
            ROUTE["routeNumber"],
            service_date="2026-07-22",
            from_stop_id="stop-a",
            to_stop_id="stop-d",
            service_types="private",
        )

        self.assertTrue(
            result["services"][0]["liveTrackingAvailable"],
        )
        self.assertEqual(
            result["services"][0]["trackingState"],
            "live",
        )
        self.assertFalse(
            result["services"][1]["liveTrackingAvailable"],
        )
        self.assertEqual(
            result["services"][1]["trackingState"],
            "scheduled",
        )
        self.assertEqual(result["meta"]["liveCount"], 1)

    @patch.object(service, "get_all_routes", return_value=[ROUTE])
    def test_destination_before_start_is_rejected(self, _get_all_routes):
        with self.assertRaises(service.PassengerScheduleError) as context:
            service.get_public_timetable(
                ROUTE["id"],
                service_date="2026-07-22",
                from_stop_id="stop-d",
                to_stop_id="stop-b",
            )

        self.assertEqual(
            context.exception.code,
            "INVALID_STOP_ORDER",
        )

    @patch.object(service, "get_all_routes", return_value=[ROUTE])
    def test_same_start_and_destination_is_rejected(self, _get_all_routes):
        with self.assertRaises(service.PassengerScheduleError) as context:
            service.get_public_timetable(
                ROUTE["id"],
                service_date="2026-07-22",
                from_stop_id="stop-b",
                to_stop_id="stop-b",
            )

        self.assertEqual(
            context.exception.code,
            "SAME_START_AND_END_STOP",
        )

    @patch.object(service, "get_all_routes", return_value=[ROUTE])
    def test_destination_outside_route_is_rejected(self, _get_all_routes):
        with self.assertRaises(service.PassengerScheduleError) as context:
            service.get_public_timetable(
                ROUTE["id"],
                service_date="2026-07-22",
                from_stop_id="stop-b",
                to_stop_id="unknown-stop",
            )

        self.assertEqual(
            context.exception.code,
            "DESTINATION_STOP_NOT_ON_ROUTE",
        )


class PassengerTimetableRouteContractTests(unittest.TestCase):
    def test_public_timetable_routes_forward_destination_stop(self):
        map_routes = (
            BACKEND_DIR
            / "routes"
            / "map_routes.py"
        ).read_text(encoding="utf-8")

        self.assertGreaterEqual(
            map_routes.count('request.args.get("toStopId")'),
            2,
        )


if __name__ == "__main__":
    unittest.main()
