import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from bson.objectid import ObjectId


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import driver_bus_request_service as service


class DriverBusOnboardingContractTests(unittest.TestCase):
    def test_approval_reassigns_a_driver_from_the_previous_verified_bus(self):
        request_id = ObjectId()
        driver_id = ObjectId()
        previous_bus_id = ObjectId()
        new_bus_id = ObjectId()
        route_id = ObjectId()
        document = {
            "_id": request_id,
            "driverId": driver_id,
            "status": "under_review",
            "requestRevision": 1,
            "existingBusId": new_bus_id,
            "operatorId": ObjectId(),
            "depotId": ObjectId(),
            "serviceType": "sltb",
            "routeId": route_id,
        }
        driver = {
            "_id": driver_id,
            "verificationStatus": "approved",
            "verifiedBusId": previous_bus_id,
        }
        new_bus = {
            "_id": new_bus_id,
            "vehicleRegistrationNumber": "NC-4567",
            "ntcPermitNumber": "NTC-2",
            "recordStatus": "active",
        }
        operator = {"_id": document["operatorId"]}
        depot = {"_id": document["depotId"], "name": "Homagama Depot"}
        route = {
            "id": str(route_id),
            "routeNumber": "122",
            "name": "Avissawella - Pettah",
        }
        approved_document = {
            **document,
            "status": "approved",
            "approvedBusId": new_bus_id,
        }

        with (
            patch.object(service, "_request_document", return_value=document),
            patch.object(service.drivers_collection, "find_one", return_value=driver),
            patch.object(
                service,
                "_operator_and_depot",
                return_value=(operator, depot),
            ),
            patch.object(
                service,
                "_route_assignment",
                return_value=("sltb", route),
            ),
            patch.object(service.buses_collection, "find_one", return_value=new_bus),
            patch.object(service.buses_collection, "update_one") as bus_update,
            patch.object(
                service.drivers_collection,
                "update_one",
                return_value=MagicMock(matched_count=1),
            ) as driver_update,
            patch.object(
                service.driver_bus_requests_collection,
                "update_one",
                return_value=MagicMock(matched_count=1),
            ),
            patch.object(
                service.driver_bus_requests_collection,
                "find_one",
                return_value=approved_document,
            ),
        ):
            result = service.approve_driver_bus_request(
                str(request_id),
                actor="admin@gamana.lk",
            )

        self.assertEqual(result["approvedBusId"], str(new_bus_id))
        self.assertEqual(
            driver_update.call_args.args[0]["verifiedBusId"],
            previous_bus_id,
        )
        self.assertTrue(
            any(
                call.args[0] == {"_id": previous_bus_id}
                and call.args[1].get("$pull")
                == {"verifiedDriverIds": driver_id}
                for call in bus_update.call_args_list
            )
        )

    def test_admin_can_update_an_open_bus_request(self):
        request_id = ObjectId()
        driver_id = ObjectId()
        depot_id = ObjectId()
        operator_id = ObjectId()
        route_id = ObjectId()
        document = {
            "_id": request_id,
            "driverId": driver_id,
            "status": "pending",
            "requestRevision": 1,
        }
        depot = {
            "_id": depot_id,
            "name": "Homagama Depot",
        }
        operator = {
            "_id": operator_id,
            "name": "SLTB",
        }
        route = {
            "id": str(route_id),
            "routeNumber": "122",
            "name": "Avissawella - Pettah",
        }
        updated = {
            **document,
            "vehicleRegistrationNumber": "NC-1234",
            "serviceType": "sltb",
            "routeId": route_id,
            "routeNumber": "122",
            "routeName": route["name"],
            "depotId": depot_id,
            "depotName": depot["name"],
            "status": "pending",
            "requestRevision": 2,
        }

        with (
            patch.object(service, "_request_document", return_value=document),
            patch.object(
                service,
                "_active_depot_with_operator",
                return_value=(operator, depot),
            ),
            patch.object(
                service,
                "_route_assignment",
                return_value=("sltb", route),
            ),
            patch.object(service, "_find_bus_by_registration", return_value=None),
            patch.object(
                service.driver_bus_requests_collection,
                "find_one",
                side_effect=[None, updated],
            ),
            patch.object(
                service.driver_bus_requests_collection,
                "update_one",
                return_value=MagicMock(matched_count=1),
            ),
            patch.object(service.drivers_collection, "update_one"),
        ):
            result = service.update_admin_driver_bus_request(
                str(request_id),
                {
                    "vehicleRegistrationNumber": "nc-1234",
                    "ntcPermitNumber": "ntc-1",
                    "depotId": str(depot_id),
                    "serviceType": "sltb",
                    "routeId": str(route_id),
                    "make": "Ashok Leyland",
                    "model": "Viking",
                    "manufactureYear": 2020,
                    "seatingCapacity": 54,
                    "notes": "Updated by operations",
                },
                actor="admin@gamana.lk",
            )

        self.assertEqual(result["vehicleRegistrationNumber"], "NC-1234")
        self.assertEqual(result["requestRevision"], 2)

    def test_admin_can_edit_and_delete_an_approved_request(self):
        document = {
            "_id": ObjectId(),
            "driverId": ObjectId(),
            "status": "approved",
            "requestRevision": 2,
        }

        self.assertIn("approved", service.ADMIN_EDITABLE_BUS_REQUEST_STATUSES)
        self.assertIn("approved", service.ADMIN_DELETABLE_BUS_REQUEST_STATUSES)

        with (
            patch.object(service, "_request_document", return_value=document),
            patch.object(
                service.driver_bus_requests_collection,
                "delete_one",
                return_value=MagicMock(deleted_count=1),
            ),
            patch.object(service.drivers_collection, "update_one") as driver_update,
        ):
            deleted_id = service.delete_admin_driver_bus_request(
                str(document["_id"]),
                actor="admin@gamana.lk",
            )

        self.assertEqual(deleted_id, str(document["_id"]))
        driver_update.assert_called_once()

    def test_route_assignment_requires_matching_service_type(self):
        route_id = ObjectId()
        depot = {
            "_id": ObjectId(),
            "name": "Homagama Depot",
        }
        route = {
            "id": str(route_id),
            "routeNumber": "122",
            "name": "Avissawella - Pettah",
            "depotName": "Homagama Depot",
            "recordStatus": "active",
            "serviceCategories": ["private", "intercity"],
        }

        with patch.object(
            service,
            "get_route_admin_details",
            return_value=route,
        ):
            service_type, selected_route = service._route_assignment(
                service_type="private",
                depot=depot,
                route_id=str(route_id),
            )

        self.assertEqual(service_type, "private")
        self.assertEqual(selected_route["routeNumber"], "122")

    def test_route_assignment_rejects_route_from_another_depot(self):
        route_id = ObjectId()
        route = {
            "id": str(route_id),
            "routeNumber": "138",
            "name": "Kottawa - Pettah",
            "depotName": "Maharagama Depot",
            "recordStatus": "active",
            "serviceCategories": ["sltb"],
        }

        with patch.object(
            service,
            "get_route_admin_details",
            return_value=route,
        ):
            with self.assertRaises(service.DriverBusRequestError) as context:
                service._route_assignment(
                    service_type="sltb",
                    depot={"name": "Homagama Depot"},
                    route_id=str(route_id),
                )

        self.assertEqual(context.exception.code, "ROUTE_DEPOT_MISMATCH")

    def test_pending_driver_stays_in_driver_verification(self):
        driver_id = str(ObjectId())
        driver = {
            "_id": ObjectId(driver_id),
            "verificationStatus": "pending",
            "kycStatus": "SUBMITTED",
        }

        with (
            patch.object(service, "_driver_document", return_value=driver),
            patch.object(service, "_latest_driver_request", return_value=None),
            patch.object(service, "_verified_driver_bus", return_value=None),
        ):
            result = service.get_driver_onboarding_status(driver_id)

        self.assertEqual(
            result["nextStep"],
            "DRIVER_VERIFICATION_PENDING",
        )

    def test_approved_driver_without_request_needs_bus_registration(self):
        driver_id = str(ObjectId())
        driver = {
            "_id": ObjectId(driver_id),
            "verificationStatus": "approved",
            "kycStatus": "APPROVED",
        }

        with (
            patch.object(service, "_driver_document", return_value=driver),
            patch.object(service, "_latest_driver_request", return_value=None),
            patch.object(service, "_verified_driver_bus", return_value=None),
        ):
            result = service.get_driver_onboarding_status(driver_id)

        self.assertEqual(
            result["nextStep"],
            "BUS_REGISTRATION_REQUIRED",
        )

    def test_pending_bus_request_blocks_home(self):
        driver_id = str(ObjectId())
        driver = {
            "_id": ObjectId(driver_id),
            "verificationStatus": "approved",
            "kycStatus": "APPROVED",
            "busVerificationStatus": "pending",
        }
        bus_request = {
            "_id": ObjectId(),
            "driverId": ObjectId(driver_id),
            "status": "pending",
            "requestType": "new_bus_registration",
            "vehicleRegistrationNumber": "NC-1234",
        }

        with (
            patch.object(service, "_driver_document", return_value=driver),
            patch.object(
                service,
                "_latest_driver_request",
                return_value=bus_request,
            ),
            patch.object(service, "_verified_driver_bus", return_value=None),
        ):
            result = service.get_driver_onboarding_status(driver_id)

        self.assertEqual(result["nextStep"], "BUS_REQUEST_PENDING")

    def test_verified_bus_allows_home(self):
        driver_id = str(ObjectId())
        bus_id = ObjectId()
        driver = {
            "_id": ObjectId(driver_id),
            "verificationStatus": "approved",
            "kycStatus": "APPROVED",
            "busVerificationStatus": "approved",
            "verifiedBusId": bus_id,
        }
        bus = {
            "_id": bus_id,
            "vehicleRegistrationNumber": "NC-1234",
            "recordStatus": "active",
            "operationalStatus": "offline",
        }

        with (
            patch.object(service, "_driver_document", return_value=driver),
            patch.object(service, "_latest_driver_request", return_value=None),
            patch.object(service, "_verified_driver_bus", return_value=bus),
        ):
            result = service.get_driver_onboarding_status(driver_id)

        self.assertEqual(result["nextStep"], "READY_FOR_HOME")
        self.assertEqual(
            result["verifiedBus"]["vehicleRegistrationNumber"],
            "NC-1234",
        )


if __name__ == "__main__":
    unittest.main()
