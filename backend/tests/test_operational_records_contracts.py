import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
ADMIN_ROUTES = BACKEND_ROOT / "routes" / "admin_routes.py"
DATABASE_INDEXES = BACKEND_ROOT / "utils" / "database_indexes.py"


class OperationalRecordsSourceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin_source = ADMIN_ROUTES.read_text(encoding="utf-8")
        cls.index_source = DATABASE_INDEXES.read_text(encoding="utf-8")

    def test_operator_and_depot_admin_endpoints_exist(self):
        for route in (
            "/api/admin/operators",
            "/api/admin/operators/<operator_id>",
            "/api/admin/depots",
            "/api/admin/depots/<depot_id>",
        ):
            self.assertIn(route, self.admin_source)

    def test_bus_create_and_update_endpoints_exist(self):
        self.assertIn(
            '@admin_bp.route("/api/admin/buses", methods=["POST"])',
            self.admin_source,
        )
        self.assertIn(
            '"/api/admin/buses/<bus_id>"',
            self.admin_source,
        )
        self.assertIn("BUS_RECORD_STATUSES", self.admin_source)
        self.assertIn("BUS_HAS_OPEN_TRIP", self.admin_source)

    def test_active_relationship_validation_is_present(self):
        self.assertIn("_operator_and_depot", self.admin_source)
        self.assertIn(
            "The selected depot does not belong to the operator",
            self.admin_source,
        )
        self.assertIn("OPERATOR_HAS_ACTIVE_BUSES", self.admin_source)
        self.assertIn("DEPOT_HAS_ACTIVE_BUSES", self.admin_source)

    def test_operational_unique_indexes_exist(self):
        for index_name in (
            "unique_vehicle_registration_identity",
            "unique_bus_ntc_permit_identity",
            "unique_operator_code",
            "unique_depot_code_per_operator",
            "bus_master_assignment_lookup",
        ):
            self.assertIn(index_name, self.index_source)

    def test_driver_vehicle_assignment_indexes_are_not_recreated(self):
        self.assertNotIn(
            'name="unique_new_vehicle_assignment"',
            self.index_source,
        )
        self.assertNotIn(
            'name="driver_vehicle_lookup"',
            self.index_source,
        )

    def test_safe_delete_endpoints_exist(self):
        for route, function_name in (
            ("/api/admin/operators/<operator_id>", "delete_admin_operator"),
            ("/api/admin/depots/<depot_id>", "delete_admin_depot"),
            ("/api/admin/buses/<bus_id>", "delete_admin_bus"),
        ):
            self.assertIn(route, self.admin_source)
            self.assertIn(function_name, self.admin_source)

        self.assertIn('methods=["DELETE"]', self.admin_source)

    def test_safe_delete_dependency_guards_exist(self):
        for code in (
            "OPERATOR_HAS_DEPENDENCIES",
            "DEPOT_HAS_DEPENDENCIES",
            "BUS_DELETE_ACTIVE",
            "BUS_HAS_TRIP_HISTORY",
        ):
            self.assertIn(code, self.admin_source)


if __name__ == "__main__":
    unittest.main()
