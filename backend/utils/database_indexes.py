from pymongo import ASCENDING, DESCENDING, IndexModel

from config import (
    buses_collection,
    drivers_collection,
    issue_reports_collection,
    notifications_collection,
    otp_collection,
    routes_collection,
    trips_collection,
)


def ensure_safe_indexes() -> dict[str, list[str]]:
    """Create idempotent indexes that do not assume cleaned legacy data.

    ``activeKey``, ``busActiveKey``, ``trackingKey``, and
    ``vehicleAssignmentKey`` are new canonical keys, so their sparse unique
    indexes remain compatible with untouched legacy documents. Existing
    identity fields receive non-unique lookup indexes; promoting those legacy
    fields to unique indexes must happen only after a duplicate-data audit and
    normalization migration.
    """

    return {
        "drivers": drivers_collection.create_indexes([
            IndexModel([("mobile", ASCENDING)], name="driver_mobile_lookup"),
            IndexModel([("email", ASCENDING)], name="driver_email_lookup"),
            IndexModel([("nic", ASCENDING)], name="driver_nic_lookup"),
            IndexModel(
                [("vehicleRegistrationNumber", ASCENDING)],
                name="driver_vehicle_lookup",
            ),
            IndexModel(
                [("mobileKey", ASCENDING)],
                name="unique_new_mobile_identity",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("emailKey", ASCENDING)],
                name="unique_new_email_identity",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("nicKey", ASCENDING)],
                name="unique_new_nic_identity",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("vehicleAssignmentKey", ASCENDING)],
                name="unique_new_vehicle_assignment",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("verificationStatus", ASCENDING), ("createdAt", DESCENDING)],
                name="driver_approval_queue",
            ),
        ]),
        "trips": trips_collection.create_indexes([
            IndexModel(
                [("activeKey", ASCENDING)],
                name="one_open_trip_per_driver",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("busActiveKey", ASCENDING)],
                name="one_open_trip_per_bus",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("driverId", ASCENDING), ("startedAt", DESCENDING)],
                name="driver_trip_history",
            ),
            IndexModel(
                [("busId", ASCENDING), ("status", ASCENDING)],
                name="bus_trip_status",
            ),
        ]),
        "buses": buses_collection.create_indexes([
            IndexModel([("bus_id", ASCENDING)], name="bus_id_lookup"),
            IndexModel(
                [("trackingKey", ASCENDING)],
                name="unique_canonical_bus_tracking",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("operationalStatus", ASCENDING), ("updatedAt", DESCENDING)],
                name="bus_operational_recency",
            ),
        ]),
        "otp_requests": otp_collection.create_indexes([
            IndexModel(
                [("otpKey", ASCENDING)],
                name="one_canonical_otp_request",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("mobile", ASCENDING), ("purpose", ASCENDING)],
                name="legacy_otp_mobile_purpose_lookup",
            ),
            IndexModel(
                [("expires_at", ASCENDING)],
                name="otp_expiry_ttl",
                expireAfterSeconds=0,
            ),
        ]),
        "routes": routes_collection.create_indexes([
            IndexModel([("routeNumber", ASCENDING)], name="route_number_lookup"),
        ]),
        "issues": issue_reports_collection.create_indexes([
            IndexModel(
                [("driverId", ASCENDING), ("createdAt", DESCENDING)],
                name="driver_issue_history",
            ),
            IndexModel(
                [("status", ASCENDING), ("severity", ASCENDING), ("createdAt", DESCENDING)],
                name="issue_review_queue",
            ),
        ]),
        "notifications": notifications_collection.create_indexes([
            IndexModel(
                [("driverId", ASCENDING), ("read", ASCENDING)],
                name="driver_unread_notifications",
            ),
        ]),
    }
