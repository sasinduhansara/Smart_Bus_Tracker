from pymongo import ASCENDING, DESCENDING, GEO2DSPHERE, IndexModel

from config import (
    buses_collection,
    driver_bus_requests_collection,
    drivers_collection,
    eta_predictions_collection,
    issue_reports_collection,
    live_bus_states_collection,
    location_history_collection,
    notifications_collection,
    otp_collection,
    routes_collection,
    stops_collection,
    trips_collection,
)


operators_collection = buses_collection.database["operators"]
depots_collection = buses_collection.database["depots"]
schedule_templates_collection = buses_collection.database["schedule_templates"]
daily_services_collection = buses_collection.database["daily_services"]


def ensure_safe_indexes() -> dict[str, list[str]]:
    """Create idempotent indexes for identity, review and operational data.

    Legacy lookup indexes remain non-unique. Canonical keys are populated only
    by normalized create/update flows, allowing sparse unique indexes to coexist
    with untouched historical documents.
    """

    return {
        "drivers": drivers_collection.create_indexes([
            IndexModel(
                [("mobile", ASCENDING)],
                name="driver_mobile_lookup",
            ),
            IndexModel(
                [("email", ASCENDING)],
                name="driver_email_lookup",
            ),
            IndexModel(
                [("nic", ASCENDING)],
                name="driver_nic_lookup",
            ),
            IndexModel(
                [("driverNtcRegistrationNumber", ASCENDING)],
                name="driver_ntc_lookup",
            ),
            IndexModel(
                [("drivingLicenseNumber", ASCENDING)],
                name="driver_license_lookup",
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
                [("driverNtcRegistrationNumberKey", ASCENDING)],
                name="unique_new_driver_ntc_identity",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("drivingLicenseNumberKey", ASCENDING)],
                name="unique_new_driving_license_identity",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("verificationStatus", ASCENDING),
                    ("createdAt", DESCENDING),
                ],
                name="driver_approval_queue",
            ),
            IndexModel(
                [("drivingLicenseExpiry", ASCENDING)],
                name="driver_license_expiry_lookup",
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
                [
                    ("driverId", ASCENDING),
                    ("startedAt", DESCENDING),
                ],
                name="driver_trip_history",
            ),
            IndexModel(
                [
                    ("busId", ASCENDING),
                    ("status", ASCENDING),
                ],
                name="bus_trip_status",
            ),
        ]),
        "buses": buses_collection.create_indexes([
            IndexModel(
                [("bus_id", ASCENDING)],
                name="bus_id_lookup",
            ),
            IndexModel(
                [("trackingKey", ASCENDING)],
                name="unique_canonical_bus_tracking",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("vehicleRegistrationKey", ASCENDING)],
                name="unique_vehicle_registration_identity",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("ntcPermitKey", ASCENDING)],
                name="unique_bus_ntc_permit_identity",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("operatorId", ASCENDING),
                    ("depotId", ASCENDING),
                    ("recordStatus", ASCENDING),
                ],
                name="bus_master_assignment_lookup",
            ),
            IndexModel(
                [
                    ("recordStatus", ASCENDING),
                    ("updatedAt", DESCENDING),
                ],
                name="bus_record_status_recency",
            ),
            IndexModel(
                [
                    ("operationalStatus", ASCENDING),
                    ("updatedAt", DESCENDING),
                ],
                name="bus_operational_recency",
            ),
        ]),
        "operators": operators_collection.create_indexes([
            IndexModel(
                [("codeKey", ASCENDING)],
                name="unique_operator_code",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("isActive", ASCENDING),
                    ("name", ASCENDING),
                ],
                name="operator_status_name",
            ),
        ]),
        "depots": depots_collection.create_indexes([
            IndexModel(
                [
                    ("operatorId", ASCENDING),
                    ("codeKey", ASCENDING),
                ],
                name="unique_depot_code_per_operator",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("operatorId", ASCENDING),
                    ("isActive", ASCENDING),
                    ("name", ASCENDING),
                ],
                name="depot_operator_status_name",
            ),
        ]),
        "schedule_templates": schedule_templates_collection.create_indexes([
            IndexModel(
                [("templateKey", ASCENDING)],
                name="unique_schedule_template_slot",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("routeId", ASCENDING),
                    ("recordStatus", ASCENDING),
                    ("departureTime", ASCENDING),
                ],
                name="schedule_route_status_time",
            ),
            IndexModel(
                [
                    ("serviceType", ASCENDING),
                    ("recordStatus", ASCENDING),
                    ("departureTime", ASCENDING),
                ],
                name="schedule_service_type_status_time",
            ),
        ]),
        "daily_services": daily_services_collection.create_indexes([
            IndexModel(
                [("dailyServiceKey", ASCENDING)],
                name="unique_daily_route_service_slot",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("busAssignmentKey", ASCENDING)],
                name="unique_daily_bus_assignment",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("driverAssignmentKey", ASCENDING)],
                name="unique_daily_driver_assignment",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("serviceDate", ASCENDING),
                    ("departureTime", ASCENDING),
                    ("status", ASCENDING),
                ],
                name="daily_service_date_time_status",
            ),
            IndexModel(
                [
                    ("driverId", ASCENDING),
                    ("serviceDate", ASCENDING),
                    ("departureTime", ASCENDING),
                ],
                name="driver_daily_duty_lookup",
            ),
            IndexModel(
                [
                    ("busId", ASCENDING),
                    ("serviceDate", ASCENDING),
                    ("departureTime", ASCENDING),
                ],
                name="bus_daily_duty_lookup",
            ),
            IndexModel(
                [("scheduleTemplateId", ASCENDING)],
                name="daily_service_template_lookup",
            ),
        ]),
        "driver_bus_requests": driver_bus_requests_collection.create_indexes([
            IndexModel(
                [("openDriverKey", ASCENDING)],
                name="unique_open_bus_request_per_driver",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [("openVehicleKey", ASCENDING)],
                name="unique_open_bus_request_per_vehicle",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("status", ASCENDING),
                    ("updatedAt", DESCENDING),
                ],
                name="driver_bus_request_review_queue",
            ),
            IndexModel(
                [
                    ("driverId", ASCENDING),
                    ("createdAt", DESCENDING),
                ],
                name="driver_bus_request_history",
            ),
            IndexModel(
                [
                    ("vehicleRegistrationKey", ASCENDING),
                    ("status", ASCENDING),
                ],
                name="driver_bus_request_vehicle_status",
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
                [
                    ("mobile", ASCENDING),
                    ("purpose", ASCENDING),
                ],
                name="legacy_otp_mobile_purpose_lookup",
            ),
            IndexModel(
                [("expires_at", ASCENDING)],
                name="otp_expiry_ttl",
                expireAfterSeconds=0,
            ),
        ]),
        "routes": routes_collection.create_indexes([
            IndexModel(
                [("routeNumber", ASCENDING)],
                name="route_number_lookup",
            ),
            IndexModel(
                [("routeKey", ASCENDING)],
                name="unique_route_number_direction",
                unique=True,
                sparse=True,
            ),
            IndexModel(
                [
                    ("recordStatus", ASCENDING),
                    ("routeNumberKey", ASCENDING),
                    ("direction", ASCENDING),
                ],
                name="route_status_number_direction",
            ),
            IndexModel(
                [("stops.nameKey", ASCENDING)],
                name="route_stop_name_lookup",
            ),
            IndexModel(
                [
                    ("originKey", ASCENDING),
                    ("destinationKey", ASCENDING),
                    ("recordStatus", ASCENDING),
                ],
                name="route_origin_destination_lookup",
            ),
        ]),
        "issues": issue_reports_collection.create_indexes([
            IndexModel(
                [
                    ("driverId", ASCENDING),
                    ("createdAt", DESCENDING),
                ],
                name="driver_issue_history",
            ),
            IndexModel(
                [
                    ("status", ASCENDING),
                    ("severity", ASCENDING),
                    ("createdAt", DESCENDING),
                ],
                name="issue_review_queue",
            ),
        ]),
        "notifications": notifications_collection.create_indexes([
            IndexModel(
                [
                    ("driverId", ASCENDING),
                    ("createdAt", DESCENDING),
                ],
                name="driver_notification_retention",
            ),
            IndexModel(
                [
                    ("driverId", ASCENDING),
                    ("read", ASCENDING),
                ],
                name="driver_unread_notifications",
            ),
        ]),

        # ── OSM tracking collections ─────────────────────────────────────────
        "stops": stops_collection.create_indexes([
            # 2dsphere for geospatial stop search (nearest stop queries).
            IndexModel(
                [("location", GEO2DSPHERE)],
                name="stop_location_2dsphere",
            ),
            IndexModel(
                [
                    ("routeId", ASCENDING),
                    ("sequence", ASCENDING),
                ],
                name="stop_route_sequence",
            ),
            IndexModel(
                [("nameKey", ASCENDING)],
                name="stop_name_text_lookup",
            ),
            IndexModel(
                [("recordStatus", ASCENDING)],
                name="stop_record_status",
            ),
        ]),

        "live_bus_states": live_bus_states_collection.create_indexes([
            # Unique identity per bus – one document per bus at any time.
            IndexModel(
                [("busId", ASCENDING)],
                name="live_bus_state_bus_id",
                unique=True,
            ),
            # 2dsphere for bounding-box bus queries on the passenger map.
            IndexModel(
                [("location", GEO2DSPHERE)],
                name="live_bus_location_2dsphere",
            ),
            IndexModel(
                [("routeId", ASCENDING)],
                name="live_bus_route_lookup",
            ),
            IndexModel(
                [("tripId", ASCENDING)],
                name="live_bus_trip_lookup",
            ),
            IndexModel(
                [
                    ("operationalStatus", ASCENDING),
                    ("recordedAt", DESCENDING),
                ],
                name="live_bus_status_recency",
            ),
        ]),

        "location_history": location_history_collection.create_indexes([
            # Primary compound queries used during trip replay and model training.
            IndexModel(
                [
                    ("tripId", ASCENDING),
                    ("recordedAt", ASCENDING),
                ],
                name="location_trip_timeline",
            ),
            IndexModel(
                [
                    ("busId", ASCENDING),
                    ("recordedAt", DESCENDING),
                ],
                name="location_bus_recency",
            ),
            IndexModel(
                [
                    ("routeId", ASCENDING),
                    ("recordedAt", DESCENDING),
                ],
                name="location_route_recency",
            ),
            IndexModel(
                [
                    ("dailyServiceId", ASCENDING),
                    ("recordedAt", ASCENDING),
                ],
                name="location_daily_service_timeline",
            ),
            IndexModel(
                [
                    ("driverId", ASCENDING),
                    ("recordedAt", DESCENDING),
                ],
                name="location_driver_recency",
            ),
            # TTL: purge high-frequency raw GPS records after the configured
            # retention window.  Set LOCATION_HISTORY_TTL_DAYS in .env.
            # A value of 0 means "expire immediately"; set to None/absent to
            # keep records indefinitely (managed retention).
            IndexModel(
                [("recordedAt", ASCENDING)],
                name="location_history_ttl",
                expireAfterSeconds=(
                    int(__import__("os").getenv(
                        "LOCATION_HISTORY_TTL_DAYS", "90",
                    )) * 86400
                ),
            ),
        ]),

        "eta_predictions": eta_predictions_collection.create_indexes([
            IndexModel(
                [
                    ("tripId", ASCENDING),
                    ("stopId", ASCENDING),
                    ("generatedAt", DESCENDING),
                ],
                name="eta_prediction_trip_stop",
            ),
            IndexModel(
                [
                    ("routeId", ASCENDING),
                    ("generatedAt", DESCENDING),
                ],
                name="eta_prediction_route_recency",
            ),
            IndexModel(
                [("busId", ASCENDING)],
                name="eta_prediction_bus_lookup",
            ),
        ]),
    }
