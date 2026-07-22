import os
import re
from datetime import datetime, timezone

import bcrypt
from bson.objectid import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from flask import Blueprint, current_app, g, jsonify, request

from config import (
    buses_collection,
    drivers_collection,
    issue_reports_collection,
    trips_collection,
)
from extensions import socketio
from services.driver_trip_service import (
    OPEN_TRIP_STATUSES,
    build_safe_bus_payload,
    driver_reference_query,
    serialize_trip,
)
from services.notification_service import insert_driver_notification
from services.route_service import (
    ROUTE_DIRECTIONS,
    ROUTE_STATUSES,
    SERVICE_CATEGORIES,
    RouteValidationError,
    create_route_record,
    delete_route_record,
    get_route_admin_details,
    list_route_records,
    route_to_summary,
    update_route_record,
)
from services.schedule_service import (
    DAILY_SERVICE_STATUSES,
    SCHEDULE_STATUSES,
    SERVICE_TYPES,
    ScheduleValidationError,
    create_daily_service,
    create_schedule_template,
    delete_daily_service,
    delete_schedule_template,
    get_schedule_template,
    get_scheduling_references,
    list_daily_services,
    list_schedule_templates,
    update_daily_service,
    update_schedule_template,
)
from utils.auth_utils import (
    create_access_token,
    jwt_required,
    roles_required,
)



admin_bp = Blueprint("admin_bp", __name__)

# Operational master data lives in dedicated collections while live telemetry
# remains in buses_collection. Accessing them through the existing database
# avoids requiring a config.py change.
depots_collection = buses_collection.database["depots"]
daily_services_collection = buses_collection.database["daily_services"]

BUS_RECORD_STATUSES = {"active", "inactive", "maintenance"}

REQUIRED_DOCUMENT_TYPES = {
    "nicFront",
    "nicBack",
    "drivingLicenseFront",
    "drivingLicenseBack",
}

DRIVER_STATUSES = {
    "pending",
    "under_review",
    "correction_required",
    "approved",
    "verified",
    "rejected",
    "blocked",
    "unverified",
}

CORRECTABLE_DOCUMENT_FIELDS = {
    "nicFront",
    "nicBack",
    "drivingLicenseFront",
    "drivingLicenseBack",
}
TRIP_STATUSES = {"active", "paused", "completed"}
ISSUE_STATUSES = {"open", "in_review", "resolved", "dismissed"}


def _iso_value(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return str(value) if value else ""


def _non_negative_int(value):
    try:
        return max(int(value or 0), 0)
    except (TypeError, ValueError):
        return 0


def _clean_text(value, *, max_length=250):
    text = str(value or "").strip()
    return text[:max_length]


def _identity_key(value):
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())


def _object_id(value):
    raw_value = str(value or "").strip()
    if not ObjectId.is_valid(raw_value):
        return None
    return ObjectId(raw_value)


def _optional_positive_int(value, *, field_name, minimum, maximum):
    if value in (None, ""):
        return None, None

    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None, f"{field_name} must be an integer"

    if not minimum <= parsed <= maximum:
        return None, (
            f"{field_name} must be between {minimum} and {maximum}"
        )

    return parsed, None


def _duplicate_error_response(error):
    details = getattr(error, "details", {}) or {}
    pattern = details.get("keyPattern") or {}
    duplicate_field = next(iter(pattern), "")

    field_messages = {
        "vehicleRegistrationKey": (
            "A bus with this vehicle registration number already exists"
        ),
        "ntcPermitKey": "A bus with this NTC permit number already exists",
        "codeKey": "This code is already in use",
        "routeKey": (
            "A route with this number and direction already exists"
        ),
    }

    return jsonify({
        "error": field_messages.get(
            duplicate_field,
            "A record with the same unique details already exists",
        ),
        "code": "DUPLICATE_OPERATIONAL_RECORD",
        "field": duplicate_field,
    }), 409


def _resolve_depot(depot_id, require_active=False):
    """Look up a depot by ID, returning (depot, error_response)."""
    depot_object_id = _object_id(depot_id)
    if depot_object_id is None:
        return None, jsonify({"error": "A valid depot is required"}), 400

    depot = depots_collection.find_one({"_id": depot_object_id})
    if not depot:
        return None, jsonify({"error": "Depot not found"}), 404

    if require_active and not bool(depot.get("isActive", True)):
        return None, jsonify({
            "error": "An inactive depot cannot receive an active bus"
        }), 409

    return depot, None


def _bus_has_open_trip(bus):
    bus_values = {
        str(bus.get("bus_id") or "").strip(),
        str(bus.get("vehicleRegistrationNumber") or "").strip(),
    }
    bus_values.discard("")

    if not bus_values:
        return False

    return trips_collection.find_one(
        {
            "status": {"$in": list(OPEN_TRIP_STATUSES)},
            "$or": [
                {"busId": {"$in": list(bus_values)}},
                {"vehicleRegistrationNumber": {"$in": list(bus_values)}},
            ],
        },
        {"_id": 1},
    ) is not None


def _bus_has_trip_history(bus):
    bus_values = {
        str(bus.get("bus_id") or "").strip(),
        str(bus.get("vehicleRegistrationNumber") or "").strip(),
    }
    bus_values.discard("")

    if not bus_values:
        return False

    return trips_collection.find_one(
        {
            "$or": [
                {"busId": {"$in": list(bus_values)}},
                {"vehicleRegistrationNumber": {"$in": list(bus_values)}},
            ],
        },
        {"_id": 1},
    ) is not None


def serialize_admin_bus(bus, *, depot_name=""):
    operational_status = str(
        bus.get("operationalStatus")
        or ("active" if bus.get("isActive") else "offline")
    ).strip().lower()
    record_status = str(
        bus.get("recordStatus") or "active"
    ).strip().lower()

    if record_status not in BUS_RECORD_STATUSES:
        record_status = "active"

    return {
        "id": str(bus.get("_id", "")),
        "busId": str(
            bus.get("bus_id")
            or bus.get("vehicleRegistrationNumber")
            or bus.get("trackingKey")
            or ""
        ),
        "vehicleRegistrationNumber": str(
            bus.get("vehicleRegistrationNumber")
            or bus.get("bus_id")
            or ""
        ),
        "ntcPermitNumber": str(bus.get("ntcPermitNumber") or ""),
        "depotId": str(bus.get("depotId") or ""),
        "depotName": depot_name,
        "make": str(bus.get("make") or ""),
        "model": str(bus.get("model") or ""),
        "manufactureYear": bus.get("manufactureYear"),
        "seatingCapacity": bus.get("seatingCapacity"),
        "recordStatus": record_status,
        "notes": str(bus.get("notes") or ""),
        "routeNumber": str(bus.get("routeNumber") or ""),
        "driverId": str(bus.get("driver_id") or bus.get("driverId") or ""),
        "operationalStatus": operational_status,
        "isActive": operational_status == "active",
        "activeTripId": str(
            bus.get("activeTripId") or bus.get("tripId") or ""
        ),
        "lat": bus.get("lat"),
        "lng": bus.get("lng"),
        "speed": bus.get("speed"),
        "heading": bus.get("heading"),
        "statusUpdatedAt": _iso_value(bus.get("statusUpdatedAt")),
        "createdAt": _iso_value(bus.get("createdAt")),
        "updatedAt": _iso_value(
            bus.get("updatedAt") or bus.get("lastUpdated")
        ),
    }


def serialize_admin_depot(depot):
    return {
        "id": str(depot.get("_id", "")),
        "name": str(depot.get("name") or ""),
        "code": str(depot.get("code") or ""),
        "district": str(depot.get("district") or ""),
        "address": str(depot.get("address") or ""),
        "contactPhone": str(depot.get("contactPhone") or ""),
        "isActive": bool(depot.get("isActive", True)),
        "createdAt": _iso_value(depot.get("createdAt")),
        "updatedAt": _iso_value(depot.get("updatedAt")),
    }


def serialize_admin_issue(issue, driver_name=""):
    return {
        "id": str(issue.get("_id", "")),
        "driverId": str(issue.get("driverId") or issue.get("driver_id") or ""),
        "driverName": driver_name,
        "busId": str(
            issue.get("busId")
            or issue.get("vehicleRegistrationNumber")
            or ""
        ),
        "routeNumber": str(issue.get("routeNumber") or ""),
        "tripId": str(issue.get("tripId") or ""),
        "category": str(issue.get("category") or ""),
        "severity": str(issue.get("severity") or "medium"),
        "message": str(issue.get("message") or ""),
        "location": issue.get("location"),
        "status": str(issue.get("status") or "open"),
        "resolutionNote": str(issue.get("resolutionNote") or ""),
        "createdAt": _iso_value(issue.get("createdAt")),
        "updatedAt": _iso_value(issue.get("updatedAt")),
    }


def has_all_required_documents(driver):
    documents = driver.get("documents") or {}

    return all(
        isinstance(documents.get(document_type), dict)
        and documents[document_type].get("fileName")
        and documents[document_type].get("url")
        for document_type in REQUIRED_DOCUMENT_TYPES
    )


def normalize_driver_status(value, default="pending"):
    status = str(value or "").strip().lower()
    if status in DRIVER_STATUSES:
        return status
    return default


def resolve_unblock_target(driver):
    previous_status = normalize_driver_status(
        driver.get("statusBeforeBlock"),
        default="",
    )

    if previous_status and previous_status != "blocked":
        target_status = previous_status
    elif (
        str(driver.get("kycStatus") or "").strip().upper() == "APPROVED"
        or driver.get("approvedAt")
    ):
        target_status = "approved"
    elif has_all_required_documents(driver):
        target_status = "under_review"
    else:
        target_status = "pending"

    previous_kyc_status = str(
        driver.get("kycStatusBeforeBlock") or ""
    ).strip().upper()

    if previous_kyc_status:
        target_kyc_status = previous_kyc_status
    elif target_status in {"approved", "verified"}:
        target_kyc_status = "APPROVED"
    elif target_status == "under_review":
        target_kyc_status = "UNDER_REVIEW"
    elif target_status == "correction_required":
        target_kyc_status = "CORRECTION_REQUIRED"
    elif target_status == "rejected":
        target_kyc_status = "REJECTED"
    elif has_all_required_documents(driver):
        target_kyc_status = "SUBMITTED"
    else:
        target_kyc_status = "NOT_SUBMITTED"

    return target_status, target_kyc_status


def serialize_admin_driver(driver):
    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    if verification_status not in DRIVER_STATUSES:
        verification_status = "pending"

    driver_id = str(driver["_id"])

    return {
        "_id": driver_id,
        "driver_id": driver_id,
        "fullName": str(
            driver.get("fullName")
            or driver.get("name")
            or ""
        ),
        "nic": str(driver.get("nic") or ""),
        "mobile": str(driver.get("mobile") or ""),
        "email": str(driver.get("email") or ""),
        "driverNtcRegistrationNumber": str(
            driver.get("driverNtcRegistrationNumber") or ""
        ),
        "drivingLicenseNumber": str(
            driver.get("drivingLicenseNumber") or ""
        ),
        "drivingLicenseExpiry": str(
            driver.get("drivingLicenseExpiry") or ""
        ),
        "depotOperator": str(driver.get("depotOperator") or ""),
        "verificationStatus": verification_status,
        "kycStatus": str(
            driver.get("kycStatus") or "NOT_SUBMITTED"
        ),
        "kycRevision": _non_negative_int(
            driver.get("kycRevision")
        ),
        "documents": driver.get("documents") or {},
        "correctionFields": list(
            driver.get("correctionFields") or []
        ),
        "correctionMessage": str(
            driver.get("correctionMessage") or ""
        ),
        "rejectionReason": str(
            driver.get("rejectionReason") or ""
        ),
        "blockReason": str(driver.get("blockReason") or ""),
        "createdAt": _iso_value(driver.get("createdAt")),
        "updatedAt": _iso_value(driver.get("updatedAt")),
        "reviewedAt": _iso_value(driver.get("reviewedAt")),
        "reviewedBy": str(driver.get("reviewedBy") or ""),
        "approvedAt": _iso_value(driver.get("approvedAt")),
        "approvedBy": str(driver.get("approvedBy") or ""),
        "rejectedAt": _iso_value(driver.get("rejectedAt")),
        "rejectedBy": str(driver.get("rejectedBy") or ""),
        "blockedAt": _iso_value(driver.get("blockedAt")),
        "blockedBy": str(driver.get("blockedBy") or ""),
        "correctionRequestedAt": _iso_value(
            driver.get("correctionRequestedAt")
        ),
        "correctionRequestedBy": str(
            driver.get("correctionRequestedBy") or ""
        ),
    }


def create_driver_notification(
    driver_id,
    *,
    title,
    message,
    notification_type,
    created_at,
):
    try:
        insert_driver_notification(
            driver_id,
            title=title,
            message=message,
            notification_type=notification_type,
            created_at=created_at,
        )
        return True
    except Exception:
        current_app.logger.exception(
            "Could not create driver review notification"
        )
        return False


def driver_review_snapshot(driver):
    raw_revision = driver.get("kycRevision")
    revision_condition = (
        {"kycRevision": raw_revision}
        if "kycRevision" in driver
        else {"kycRevision": {"$exists": False}}
    )
    status_condition = (
        {"verificationStatus": driver.get("verificationStatus")}
        if "verificationStatus" in driver
        else {"verificationStatus": {"$exists": False}}
    )

    return revision_condition, status_condition


def get_driver_object_id(driver_id):
    if not ObjectId.is_valid(driver_id):
        return None

    return ObjectId(driver_id)


def suspend_driver_trip(driver_id, now):
    """Best-effort immediate passenger truth after an admin blocks/rejects."""

    trip = trips_collection.find_one(
        {
            **driver_reference_query(driver_id),
            "status": {"$in": list(OPEN_TRIP_STATUSES)},
        },
        sort=[("startedAt", -1), ("createdAt", -1)],
    )
    if not trip:
        return

    if trip.get("status") == "active":
        transition_result = trips_collection.update_one(
            {"_id": trip["_id"], "status": "active"},
            {
                "$set": {
                    "status": "paused",
                    "pausedAt": now,
                    "updatedAt": now,
                },
            },
        )
        if transition_result.modified_count != 1:
            return

    bus_id = str(
        trip.get("busId")
        or trip.get("vehicleRegistrationNumber")
        or ""
    ).strip()
    route_number = str(trip.get("routeNumber") or "").strip()
    if not bus_id:
        return

    bus_result = buses_collection.update_one(
        {
            "$and": [
                {
                    "$or": [
                        {"bus_id": bus_id},
                        {"vehicleRegistrationNumber": bus_id},
                    ],
                },
                {
                    "$or": [
                        {"statusUpdatedAt": {"$lte": now}},
                        {"statusUpdatedAt": {"$exists": False}},
                    ],
                },
            ],
        },
        {
            "$set": {
                "operationalStatus": "paused",
                "isActive": False,
                "statusUpdatedAt": now,
            },
        },
    )
    if bus_result.matched_count != 1:
        return

    socketio.emit(
        "bus_location_update",
        build_safe_bus_payload(
            bus_id=bus_id,
            route_number=route_number,
            operational_status="paused",
            trip_id=str(trip.get("_id") or "") or None,
            status_updated_at=now,
        ),
    )


def safely_suspend_driver_trip(driver_id, now):
    try:
        suspend_driver_trip(driver_id, now)
    except Exception:
        # Account authority is already revoked. GPS writes are rejected and
        # public GET state also expires stale locations; log live-sync failure.
        current_app.logger.exception(
            "Could not immediately suspend the driver's open trip"
        )


@admin_bp.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    configured_email = os.getenv(
        "ADMIN_EMAIL",
        "",
    ).strip().lower()

    configured_password_hash = os.getenv(
        "ADMIN_PASSWORD_HASH",
        "",
    ).strip()

    if not configured_email or not configured_password_hash:
        return jsonify({
            "error": "Admin authentication is not configured"
        }), 503

    email_matches = email == configured_email

    try:
        password_matches = bcrypt.checkpw(
            password.encode("utf-8"),
            configured_password_hash.encode("utf-8"),
        )
    except ValueError:
        return jsonify({
            "error": "Admin password configuration is invalid"
        }), 500

    if not email_matches or not password_matches:
        return jsonify({
            "error": "Invalid admin email or password"
        }), 401

    token = create_access_token(
        subject=configured_email,
        role="admin",
        expires_hours=8,
    )

    return jsonify({
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresInSeconds": 8 * 60 * 60,
        "admin": {
            "email": configured_email,
            "role": "admin",
        },
    })


@admin_bp.route("/api/admin/drivers", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_drivers():
    verification_status = request.args.get(
        "status",
        "",
    ).strip().lower()

    query = {}

    if verification_status:
        if verification_status not in DRIVER_STATUSES:
            return jsonify({
                "error": "Invalid verification status"
            }), 400

        if verification_status == "approved":
            query["verificationStatus"] = {
                "$in": ["approved", "verified"],
            }
        else:
            query["verificationStatus"] = verification_status

    drivers = drivers_collection.find(
        query,
        {"password": 0},
    ).sort("createdAt", -1)

    return jsonify([
        serialize_admin_driver(driver)
        for driver in drivers
    ])


@admin_bp.route(
    "/api/admin/drivers/<driver_id>",
    methods=["GET"],
)
@jwt_required
@roles_required("admin")
def get_admin_driver(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    driver = drivers_collection.find_one(
        {"_id": driver_object_id},
        {"password": 0},
    )

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    return jsonify({
        "status": "success",
        "driver": serialize_admin_driver(driver),
    })


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/review",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def start_driver_review(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    current_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    if current_status == "under_review":
        return jsonify({
            "status": "under_review",
            "driver": serialize_admin_driver(driver),
        })

    if current_status not in {"pending", "unverified"}:
        return jsonify({
            "error": (
                "Only pending or unverified applications can be moved "
                "to under review"
            ),
            "code": "DRIVER_REVIEW_NOT_ALLOWED",
            "verificationStatus": current_status,
        }), 409

    now = datetime.now(timezone.utc)
    revision_condition, status_condition = driver_review_snapshot(driver)

    result = drivers_collection.update_one(
        {
            "_id": driver_object_id,
            "$and": [
                revision_condition,
                status_condition,
            ],
        },
        {
            "$set": {
                "verificationStatus": "under_review",
                "kycStatus": "UNDER_REVIEW",
                "reviewedAt": now,
                "reviewedBy": g.auth.get("sub", ""),
                "updatedAt": now,
            },
        },
    )

    if result.matched_count != 1:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver verification data changed; reload the "
                    "application before reviewing"
                ),
                "code": "DRIVER_REVIEW_STALE",
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    updated_driver = drivers_collection.find_one(
        {"_id": driver_object_id},
        {"password": 0},
    )

    if not updated_driver:
        return jsonify({
            "error": "Driver was removed after the review started"
        }), 409

    return jsonify({
        "status": "under_review",
        "driver": serialize_admin_driver(updated_driver),
    })


@admin_bp.route("/api/admin/overview", methods=["GET"])
@jwt_required
@roles_required("admin")
def admin_overview():
    """Return one consistent snapshot for the admin dashboard cards."""
    return jsonify({
        "status": "success",
        "metrics": {
            "drivers": drivers_collection.count_documents({}),
            "pendingDrivers": drivers_collection.count_documents({
                "verificationStatus": {
                    "$in": ["pending", "under_review"],
                },
            }),
            "approvedDrivers": drivers_collection.count_documents({
                "verificationStatus": {"$in": ["approved", "verified"]},
            }),
            "buses": buses_collection.count_documents({}),
            "activeBuses": buses_collection.count_documents({
                "$or": [
                    {"operationalStatus": "active"},
                    {"isActive": True},
                ],
            }),
            "pausedBuses": buses_collection.count_documents({
                "operationalStatus": "paused",
            }),
            "activeTrips": trips_collection.count_documents({
                "status": "active",
            }),
            "openIssues": issue_reports_collection.count_documents({
                "status": {"$in": ["open", "in_review"]},
            }),
        },
    })


@admin_bp.route("/api/admin/depots", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_depots():
    active_value = request.args.get("active", "").strip().lower()
    query = {}

    if active_value:
        if active_value not in {"true", "false"}:
            return jsonify({"error": "active must be true or false"}), 400
        query["isActive"] = active_value == "true"

    depots = list(
        depots_collection.find(query).sort(
            [("isActive", -1), ("name", 1)]
        )
    )

    return jsonify({
        "status": "success",
        "depots": [
            serialize_admin_depot(depot)
            for depot in depots
        ],
    })


@admin_bp.route("/api/admin/depots", methods=["POST"])
@jwt_required
@roles_required("admin")
def create_admin_depot():
    data = request.get_json(silent=True) or {}

    name = _clean_text(data.get("name"), max_length=120)
    code = _clean_text(data.get("code"), max_length=40).upper()
    code_key = _identity_key(code)

    if not name:
        return jsonify({"error": "Depot name is required"}), 400
    if not code_key:
        return jsonify({"error": "Depot code is required"}), 400

    now = datetime.now(timezone.utc)
    depot = {
        "name": name,
        "nameKey": name.casefold(),
        "code": code,
        "codeKey": code_key,
        "district": _clean_text(data.get("district"), max_length=80),
        "address": _clean_text(data.get("address"), max_length=300),
        "contactPhone": _clean_text(
            data.get("contactPhone"),
            max_length=30,
        ),
        "isActive": bool(data.get("isActive", True)),
        "createdAt": now,
        "createdBy": g.auth.get("sub", ""),
        "updatedAt": now,
        "updatedBy": g.auth.get("sub", ""),
    }

    try:
        result = depots_collection.insert_one(depot)
    except DuplicateKeyError as duplicate_error:
        return _duplicate_error_response(duplicate_error)

    depot["_id"] = result.inserted_id

    return jsonify({
        "status": "created",
        "depot": serialize_admin_depot(depot),
    }), 201


@admin_bp.route(
    "/api/admin/depots/<depot_id>",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def update_admin_depot(depot_id):
    depot_object_id = _object_id(depot_id)
    if depot_object_id is None:
        return jsonify({"error": "Invalid depot id"}), 400

    depot = depots_collection.find_one({"_id": depot_object_id})
    if not depot:
        return jsonify({"error": "Depot not found"}), 404

    data = request.get_json(silent=True) or {}
    update_fields = {}

    if "name" in data:
        name = _clean_text(data.get("name"), max_length=120)
        if not name:
            return jsonify({"error": "Depot name is required"}), 400
        update_fields.update({
            "name": name,
            "nameKey": name.casefold(),
        })

    if "code" in data:
        code = _clean_text(data.get("code"), max_length=40).upper()
        code_key = _identity_key(code)
        if not code_key:
            return jsonify({"error": "Depot code is required"}), 400
        update_fields.update({
            "code": code,
            "codeKey": code_key,
        })

    for field, max_length in (
        ("district", 80),
        ("address", 300),
        ("contactPhone", 30),
    ):
        if field in data:
            update_fields[field] = _clean_text(
                data.get(field),
                max_length=max_length,
            )

    if "isActive" in data:
        target_is_active = bool(data.get("isActive"))
        if (
            not target_is_active
            and bool(depot.get("isActive", True))
        ):
            assigned_bus = buses_collection.find_one(
                {
                    "depotId": depot_object_id,
                    "recordStatus": "active",
                },
                {"_id": 1},
            )
            if assigned_bus:
                return jsonify({
                    "error": (
                        "Deactivate or reassign active buses before "
                        "deactivating this depot"
                    ),
                    "code": "DEPOT_HAS_ACTIVE_BUSES",
                }), 409

        update_fields["isActive"] = target_is_active

    if not update_fields:
        return jsonify({"error": "No supported fields were supplied"}), 400

    update_fields.update({
        "updatedAt": datetime.now(timezone.utc),
        "updatedBy": g.auth.get("sub", ""),
    })

    try:
        result = depots_collection.update_one(
            {"_id": depot_object_id},
            {"$set": update_fields},
        )
    except DuplicateKeyError as duplicate_error:
        return _duplicate_error_response(duplicate_error)

    if result.matched_count != 1:
        return jsonify({"error": "Depot not found"}), 404

    updated_depot = depots_collection.find_one({"_id": depot_object_id})

    return jsonify({
        "status": "updated",
        "depot": serialize_admin_depot(updated_depot),
    })


@admin_bp.route(
    "/api/admin/depots/<depot_id>",
    methods=["DELETE"],
)
@jwt_required
@roles_required("admin")
def delete_admin_depot(depot_id):
    depot_object_id = _object_id(depot_id)
    if depot_object_id is None:
        return jsonify({"error": "Invalid depot id"}), 400

    depot = depots_collection.find_one({"_id": depot_object_id})
    if not depot:
        return jsonify({"error": "Depot not found"}), 404

    depot_references = {"$in": [depot_object_id, str(depot_object_id)]}
    bus_count = buses_collection.count_documents({
        "depotId": depot_references,
    })
    if bus_count:
        return jsonify({
            "error": (
                "Delete or reassign all linked buses before deleting "
                "this depot"
            ),
            "code": "DEPOT_HAS_DEPENDENCIES",
            "linkedBuses": bus_count,
        }), 409

    result = depots_collection.delete_one({"_id": depot_object_id})
    if result.deleted_count != 1:
        return jsonify({"error": "Depot not found"}), 404

    return jsonify({
        "status": "deleted",
        "depotId": depot_id,
    })


@admin_bp.route("/api/admin/buses", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_buses():
    operational_status = request.args.get("status", "").strip().lower()
    record_status = request.args.get(
        "recordStatus",
        "",
    ).strip().lower()
    depot_id = request.args.get("depotId", "").strip()
    search_value = request.args.get("q", "").strip()

    query = {}

    if operational_status:
        if operational_status not in {"active", "paused", "offline"}:
            return jsonify({"error": "Invalid bus operational status"}), 400
        if operational_status == "active":
            query["$or"] = [
                {"operationalStatus": "active"},
                {"isActive": True},
            ]
        else:
            query["operationalStatus"] = operational_status

    if record_status:
        if record_status not in BUS_RECORD_STATUSES:
            return jsonify({"error": "Invalid bus record status"}), 400
        query["recordStatus"] = record_status

    if depot_id:
        depot_object_id = _object_id(depot_id)
        if depot_object_id is None:
            return jsonify({"error": "Invalid depot id"}), 400
        query["depotId"] = depot_object_id

    if search_value:
        escaped_search = re.escape(search_value)
        query["$and"] = query.get("$and", [])
        query["$and"].append({
            "$or": [
                {
                    "vehicleRegistrationNumber": {
                        "$regex": escaped_search,
                        "$options": "i",
                    },
                },
                {
                    "bus_id": {
                        "$regex": escaped_search,
                        "$options": "i",
                    },
                },
                {
                    "ntcPermitNumber": {
                        "$regex": escaped_search,
                        "$options": "i",
                    },
                },
                {
                    "make": {
                        "$regex": escaped_search,
                        "$options": "i",
                    },
                },
                {
                    "model": {
                        "$regex": escaped_search,
                        "$options": "i",
                    },
                },
            ],
        })

    buses = list(
        buses_collection.find(query).sort(
            [("updatedAt", -1), ("statusUpdatedAt", -1)]
        )
    )

    depot_ids = {
        bus.get("depotId")
        for bus in buses
        if bus.get("depotId")
    }

    depot_names = {
        str(depot["_id"]): str(depot.get("name") or "")
        for depot in depots_collection.find(
            {"_id": {"$in": list(depot_ids)}},
            {"name": 1},
        )
    } if depot_ids else {}

    return jsonify({
        "status": "success",
        "buses": [
            serialize_admin_bus(
                bus,
                depot_name=depot_names.get(
                    str(bus.get("depotId") or ""),
                    "",
                ),
            )
            for bus in buses
        ],
    })


@admin_bp.route("/api/admin/buses", methods=["POST"])
@jwt_required
@roles_required("admin")
def create_admin_bus():
    data = request.get_json(silent=True) or {}

    vehicle_registration_number = _clean_text(
        data.get("vehicleRegistrationNumber"),
        max_length=30,
    ).upper()
    vehicle_registration_key = _identity_key(
        vehicle_registration_number
    )

    if not vehicle_registration_key:
        return jsonify({
            "error": "Vehicle registration number is required"
        }), 400

    record_status = str(
        data.get("recordStatus") or "active"
    ).strip().lower()
    if record_status not in BUS_RECORD_STATUSES:
        return jsonify({
            "error": "Invalid bus record status",
            "allowedStatuses": sorted(BUS_RECORD_STATUSES),
        }), 400

    depot_id = data.get("depotId")
    depot, depot_error = _resolve_depot(
        depot_id,
        require_active=record_status == "active",
    )
    if depot_error:
        return depot_error

    manufacture_year, year_error = _optional_positive_int(
        data.get("manufactureYear"),
        field_name="manufactureYear",
        minimum=1950,
        maximum=datetime.now(timezone.utc).year + 1,
    )
    if year_error:
        return jsonify({"error": year_error}), 400

    seating_capacity, capacity_error = _optional_positive_int(
        data.get("seatingCapacity"),
        field_name="seatingCapacity",
        minimum=1,
        maximum=120,
    )
    if capacity_error:
        return jsonify({"error": capacity_error}), 400

    ntc_permit_number = _clean_text(
        data.get("ntcPermitNumber"),
        max_length=80,
    ).upper()

    now = datetime.now(timezone.utc)
    bus = {
        "bus_id": vehicle_registration_number,
        "vehicleRegistrationNumber": vehicle_registration_number,
        "vehicleRegistrationKey": vehicle_registration_key,
        "trackingKey": vehicle_registration_key,
        "ntcPermitNumber": ntc_permit_number,
        "depotId": depot["_id"],
        "make": _clean_text(data.get("make"), max_length=80),
        "model": _clean_text(data.get("model"), max_length=80),
        "manufactureYear": manufacture_year,
        "seatingCapacity": seating_capacity,
        "recordStatus": record_status,
        "notes": _clean_text(data.get("notes"), max_length=1000),
        "operationalStatus": "offline",
        "isActive": False,
        "statusUpdatedAt": now,
        "createdAt": now,
        "createdBy": g.auth.get("sub", ""),
        "updatedAt": now,
        "updatedBy": g.auth.get("sub", ""),
    }

    if ntc_permit_number:
        bus["ntcPermitKey"] = _identity_key(ntc_permit_number)

    try:
        result = buses_collection.insert_one(bus)
    except DuplicateKeyError as duplicate_error:
        return _duplicate_error_response(duplicate_error)

    bus["_id"] = result.inserted_id

    return jsonify({
        "status": "created",
        "bus": serialize_admin_bus(
            bus,
            depot_name=str(depot.get("name") or ""),
        ),
    }), 201


@admin_bp.route(
    "/api/admin/buses/<bus_id>",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def update_admin_bus(bus_id):
    bus_object_id = _object_id(bus_id)
    if bus_object_id is None:
        return jsonify({"error": "Invalid bus id"}), 400

    bus = buses_collection.find_one({"_id": bus_object_id})
    if not bus:
        return jsonify({"error": "Bus not found"}), 404

    data = request.get_json(silent=True) or {}
    update_fields = {}

    target_registration = str(
        data.get(
            "vehicleRegistrationNumber",
            bus.get("vehicleRegistrationNumber")
            or bus.get("bus_id")
            or "",
        )
        or ""
    ).strip().upper()
    target_registration_key = _identity_key(target_registration)

    if not target_registration_key:
        return jsonify({
            "error": "Vehicle registration number is required"
        }), 400

    target_record_status = str(
        data.get("recordStatus", bus.get("recordStatus") or "active")
    ).strip().lower()
    if target_record_status not in BUS_RECORD_STATUSES:
        return jsonify({
            "error": "Invalid bus record status",
            "allowedStatuses": sorted(BUS_RECORD_STATUSES),
        }), 400

    target_depot_id = data.get(
        "depotId",
        str(bus.get("depotId") or ""),
    )

    depot, depot_error = _resolve_depot(
        target_depot_id,
        require_active=target_record_status == "active",
    )
    if depot_error:
        return depot_error

    registration_changed = (
        target_registration_key
        != str(bus.get("vehicleRegistrationKey") or _identity_key(
            bus.get("vehicleRegistrationNumber") or bus.get("bus_id")
        ))
    )
    status_disables_bus = (
        target_record_status in {"inactive", "maintenance"}
        and str(bus.get("recordStatus") or "active") == "active"
    )

    if (registration_changed or status_disables_bus) and _bus_has_open_trip(bus):
        return jsonify({
            "error": (
                "Complete or end the open trip before changing the bus "
                "identity or disabling the record"
            ),
            "code": "BUS_HAS_OPEN_TRIP",
        }), 409

    manufacture_year, year_error = _optional_positive_int(
        data.get("manufactureYear", bus.get("manufactureYear")),
        field_name="manufactureYear",
        minimum=1950,
        maximum=datetime.now(timezone.utc).year + 1,
    )
    if year_error:
        return jsonify({"error": year_error}), 400

    seating_capacity, capacity_error = _optional_positive_int(
        data.get("seatingCapacity", bus.get("seatingCapacity")),
        field_name="seatingCapacity",
        minimum=1,
        maximum=120,
    )
    if capacity_error:
        return jsonify({"error": capacity_error}), 400

    ntc_permit_number = _clean_text(
        data.get("ntcPermitNumber", bus.get("ntcPermitNumber")),
        max_length=80,
    ).upper()

    update_fields.update({
        "bus_id": target_registration,
        "vehicleRegistrationNumber": target_registration,
        "vehicleRegistrationKey": target_registration_key,
        "trackingKey": target_registration_key,
        "ntcPermitNumber": ntc_permit_number,
        "depotId": depot["_id"],
        "make": _clean_text(
            data.get("make", bus.get("make")),
            max_length=80,
        ),
        "model": _clean_text(
            data.get("model", bus.get("model")),
            max_length=80,
        ),
        "manufactureYear": manufacture_year,
        "seatingCapacity": seating_capacity,
        "recordStatus": target_record_status,
        "notes": _clean_text(
            data.get("notes", bus.get("notes")),
            max_length=1000,
        ),
        "updatedAt": datetime.now(timezone.utc),
        "updatedBy": g.auth.get("sub", ""),
    })

    unset_fields = {}
    if ntc_permit_number:
        update_fields["ntcPermitKey"] = _identity_key(ntc_permit_number)
    else:
        unset_fields["ntcPermitKey"] = ""

    update_document = {"$set": update_fields}
    if unset_fields:
        update_document["$unset"] = unset_fields

    try:
        result = buses_collection.update_one(
            {"_id": bus_object_id},
            update_document,
        )
    except DuplicateKeyError as duplicate_error:
        return _duplicate_error_response(duplicate_error)

    if result.matched_count != 1:
        return jsonify({"error": "Bus not found"}), 404

    updated_bus = buses_collection.find_one({"_id": bus_object_id})

    return jsonify({
        "status": "updated",
        "bus": serialize_admin_bus(
            updated_bus,
            depot_name=str(depot.get("name") or ""),
        ),
    })


@admin_bp.route(
    "/api/admin/buses/<bus_id>",
    methods=["DELETE"],
)
@jwt_required
@roles_required("admin")
def delete_admin_bus(bus_id):
    bus_object_id = _object_id(bus_id)
    if bus_object_id is None:
        return jsonify({"error": "Invalid bus id"}), 400

    bus = buses_collection.find_one({"_id": bus_object_id})
    if not bus:
        return jsonify({"error": "Bus not found"}), 404

    operational_status = str(
        bus.get("operationalStatus") or "offline"
    ).strip().lower()

    if (
        bool(bus.get("isActive"))
        or operational_status in {"active", "paused"}
        or _bus_has_open_trip(bus)
    ):
        return jsonify({
            "error": (
                "Complete the active trip and wait for the bus to become "
                "offline before deleting it"
            ),
            "code": "BUS_DELETE_ACTIVE",
        }), 409

    if _bus_has_trip_history(bus):
        return jsonify({
            "error": (
                "This bus has trip history and cannot be permanently "
                "deleted. Set the master status to inactive instead."
            ),
            "code": "BUS_HAS_TRIP_HISTORY",
        }), 409

    result = buses_collection.delete_one({"_id": bus_object_id})
    if result.deleted_count != 1:
        return jsonify({"error": "Bus not found"}), 404

    return jsonify({
        "status": "deleted",
        "busId": bus_id,
    })


@admin_bp.route("/api/admin/trips", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_trips():
    trip_status = request.args.get("status", "").strip().lower()
    if trip_status and trip_status not in TRIP_STATUSES:
        return jsonify({"error": "Invalid trip status"}), 400

    try:
        limit = int(request.args.get("limit", "50"))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer"}), 400
    if not 1 <= limit <= 100:
        return jsonify({"error": "limit must be between 1 and 100"}), 400

    query = {"status": trip_status} if trip_status else {}
    trips = trips_collection.find(query).sort(
        [("startedAt", -1), ("createdAt", -1)]
    ).limit(limit)
    return jsonify({
        "status": "success",
        "trips": [serialize_trip(trip) for trip in trips],
    })


@admin_bp.route("/api/admin/issues", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_issues():
    issue_status = request.args.get("status", "").strip().lower()
    allowed_filters = ISSUE_STATUSES | {"unresolved"}
    if issue_status and issue_status not in allowed_filters:
        return jsonify({"error": "Invalid issue status"}), 400

    try:
        limit = int(request.args.get("limit", "50"))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer"}), 400
    if not 1 <= limit <= 100:
        return jsonify({"error": "limit must be between 1 and 100"}), 400

    if issue_status == "unresolved":
        query = {"status": {"$in": ["open", "in_review"]}}
    else:
        query = {"status": issue_status} if issue_status else {}
    issues = list(issue_reports_collection.find(query).sort(
        [("createdAt", -1), ("updatedAt", -1)]
    ).limit(limit))
    driver_ids = {
        str(issue.get("driverId") or issue.get("driver_id") or "")
        for issue in issues
    }
    drivers = drivers_collection.find(
        {"_id": {"$in": [ObjectId(value) for value in driver_ids if ObjectId.is_valid(value)]}},
        {"fullName": 1, "name": 1},
    )
    driver_names = {
        str(driver["_id"]): str(
            driver.get("fullName") or driver.get("name") or ""
        )
        for driver in drivers
    }
    return jsonify({
        "status": "success",
        "issues": [
            serialize_admin_issue(
                issue,
                driver_names.get(str(issue.get("driverId") or issue.get("driver_id") or ""), ""),
            )
            for issue in issues
        ],
    })


@admin_bp.route("/api/admin/issues/<issue_id>", methods=["PATCH"])
@jwt_required
@roles_required("admin")
def update_admin_issue(issue_id):
    if not ObjectId.is_valid(issue_id):
        return jsonify({"error": "Invalid issue id"}), 400

    data = request.get_json(silent=True) or {}
    status = str(data.get("status") or "").strip().lower()
    if status not in ISSUE_STATUSES:
        return jsonify({
            "error": "Invalid issue status",
            "allowedStatuses": sorted(ISSUE_STATUSES),
        }), 400
    resolution_note = str(data.get("resolutionNote") or "").strip()
    if len(resolution_note) > 1000:
        return jsonify({"error": "resolutionNote must be 1000 characters or fewer"}), 400
    if status == "resolved" and not resolution_note:
        return jsonify({
            "error": "A resolution note is required before resolving an issue"
        }), 400

    now = datetime.now(timezone.utc)
    previous_issue = issue_reports_collection.find_one_and_update(
        {"_id": ObjectId(issue_id)},
        {"$set": {
            "status": status,
            "resolutionNote": resolution_note,
            "updatedAt": now,
            "updatedBy": g.auth.get("sub", ""),
        }},
        return_document=ReturnDocument.BEFORE,
    )
    if previous_issue is None:
        return jsonify({"error": "Issue not found"}), 404

    issue = issue_reports_collection.find_one({"_id": ObjectId(issue_id)})
    notification_sent = False
    if (
        status == "resolved"
        and str(previous_issue.get("status") or "open") != "resolved"
    ):
        driver_id = str(
            previous_issue.get("driverId")
            or previous_issue.get("driver_id")
            or ""
        ).strip()
        if driver_id:
            notification_sent = create_driver_notification(
                driver_id,
                title="Issue resolved",
                message=resolution_note,
                notification_type="issue_resolved",
                created_at=now,
            )

    return jsonify({
        "status": "updated",
        "issue": serialize_admin_issue(issue),
        "notificationSent": notification_sent,
    })


def _route_validation_response(error):
    return jsonify({
        "error": error.message,
        "code": error.code,
        "field": error.field,
    }), 400


@admin_bp.route("/api/admin/routes", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_routes():
    search_value = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip().lower()
    direction = request.args.get("direction", "").strip().lower()

    if len(search_value) > 80:
        return jsonify({"error": "q must be 80 characters or fewer"}), 400
    if status and status not in ROUTE_STATUSES:
        return jsonify({
            "error": "Invalid route status",
            "allowedStatuses": sorted(ROUTE_STATUSES),
        }), 400
    if direction and direction not in ROUTE_DIRECTIONS:
        return jsonify({
            "error": "Invalid route direction",
            "allowedDirections": sorted(ROUTE_DIRECTIONS),
        }), 400

    try:
        routes = list_route_records(
            query=search_value,
            status=status,
            direction=direction,
        )
    except RouteValidationError as validation_error:
        return _route_validation_response(validation_error)

    return jsonify({
        "status": "success",
        "routes": [route_to_summary(route) for route in routes],
        "meta": {
            "count": len(routes),
            "directions": sorted(ROUTE_DIRECTIONS),
            "statuses": sorted(ROUTE_STATUSES),
            "serviceCategories": sorted(SERVICE_CATEGORIES),
        },
    })


@admin_bp.route("/api/admin/routes", methods=["POST"])
@jwt_required
@roles_required("admin")
def create_admin_route():
    data = request.get_json(silent=True) or {}

    try:
        route = create_route_record(
            data,
            actor=g.auth.get("sub", ""),
        )
    except RouteValidationError as validation_error:
        return _route_validation_response(validation_error)
    except DuplicateKeyError as duplicate_error:
        return _duplicate_error_response(duplicate_error)

    return jsonify({
        "status": "created",
        "route": route,
    }), 201


@admin_bp.route(
    "/api/admin/routes/<route_identifier>",
    methods=["GET"],
)
@jwt_required
@roles_required("admin")
def get_admin_route(route_identifier):
    direction = request.args.get("direction", "").strip().lower() or None

    if direction and direction not in ROUTE_DIRECTIONS:
        return jsonify({
            "error": "Invalid route direction",
            "allowedDirections": sorted(ROUTE_DIRECTIONS),
        }), 400

    route = get_route_admin_details(
        route_identifier,
        direction=direction,
    )
    if route is None:
        return jsonify({"error": "Route not found"}), 404

    return jsonify({
        "status": "success",
        "route": route,
    })


@admin_bp.route(
    "/api/admin/routes/<route_identifier>",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def update_admin_route(route_identifier):
    existing = get_route_admin_details(route_identifier)
    if existing is None:
        return jsonify({"error": "Route not found"}), 404

    data = request.get_json(silent=True) or {}
    target_route_number = str(
        data.get("routeNumber", existing["routeNumber"]) or ""
    ).strip().upper()
    target_direction = str(
        data.get("direction", existing["direction"]) or ""
    ).strip().lower()
    if target_direction == "inbound":
        target_direction = "return"

    identity_changed = (
        target_route_number != existing["routeNumber"]
        or target_direction != existing["direction"]
    )
    target_status = str(
        data.get("recordStatus", existing["recordStatus"]) or ""
    ).strip().lower()
    route_disables_service = (
        existing["recordStatus"] == "active"
        and target_status == "inactive"
    )

    if identity_changed:
        trip_history = trips_collection.find_one(
            {"routeNumber": existing["routeNumber"]},
            {"_id": 1},
        )
        if trip_history:
            return jsonify({
                "error": (
                    "This route has trip history. Keep its route number and "
                    "direction unchanged, or create a new route record."
                ),
                "code": "ROUTE_HAS_TRIP_HISTORY",
            }), 409

    if route_disables_service:
        open_trip = trips_collection.find_one(
            {
                "routeNumber": existing["routeNumber"],
                "status": {"$in": list(OPEN_TRIP_STATUSES)},
            },
            {"_id": 1},
        )
        if open_trip:
            return jsonify({
                "error": (
                    "Complete open trips before deactivating this route"
                ),
                "code": "ROUTE_HAS_OPEN_TRIP",
            }), 409

    try:
        route = update_route_record(
            route_identifier,
            data,
            actor=g.auth.get("sub", ""),
        )
    except RouteValidationError as validation_error:
        return _route_validation_response(validation_error)
    except DuplicateKeyError as duplicate_error:
        return _duplicate_error_response(duplicate_error)

    if route is None:
        return jsonify({"error": "Route not found"}), 404

    return jsonify({
        "status": "updated",
        "route": route,
    })


@admin_bp.route(
    "/api/admin/routes/<route_identifier>",
    methods=["DELETE"],
)
@jwt_required
@roles_required("admin")
def delete_admin_route(route_identifier):
    route = get_route_admin_details(route_identifier)
    if route is None:
        return jsonify({"error": "Route not found"}), 404

    trip_count = trips_collection.count_documents({
        "routeNumber": route["routeNumber"],
    })
    service_count = daily_services_collection.count_documents({
        "$or": [
            {"routeId": route["id"]},
            {"routeNumber": route["routeNumber"]},
        ],
    })

    if trip_count or service_count:
        return jsonify({
            "error": (
                "This route is already used by trips or daily services and "
                "cannot be permanently deleted. Set it to inactive instead."
            ),
            "code": "ROUTE_HAS_DEPENDENCIES",
            "linkedTrips": trip_count,
            "linkedServices": service_count,
        }), 409

    if not delete_route_record(route_identifier):
        return jsonify({"error": "Route not found"}), 404

    return jsonify({
        "status": "deleted",
        "routeId": route["id"],
    })




def _schedule_validation_response(error):
    return jsonify({
        "error": error.message,
        "code": error.code,
        "field": error.field,
    }), error.status


@admin_bp.route("/api/admin/scheduling/references", methods=["GET"])
@jwt_required
@roles_required("admin")
def get_admin_scheduling_references():
    return jsonify({
        "status": "success",
        **get_scheduling_references(),
    })


@admin_bp.route("/api/admin/schedule-templates", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_schedule_templates():
    search_value = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip().lower()
    service_type = request.args.get("serviceType", "").strip().lower()

    if len(search_value) > 80:
        return jsonify({"error": "q must be 80 characters or fewer"}), 400
    if status and status not in SCHEDULE_STATUSES:
        return jsonify({
            "error": "Invalid schedule status",
            "allowedStatuses": sorted(SCHEDULE_STATUSES),
        }), 400
    if service_type and service_type not in SERVICE_TYPES:
        return jsonify({
            "error": "Invalid service type",
            "allowedServiceTypes": sorted(SERVICE_TYPES),
        }), 400

    try:
        templates = list_schedule_templates(
            query=search_value,
            status=status,
            service_type=service_type,
        )
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    return jsonify({
        "status": "success",
        "templates": templates,
        "meta": {
            "count": len(templates),
            "statuses": sorted(SCHEDULE_STATUSES),
            "serviceTypes": sorted(SERVICE_TYPES),
        },
    })


@admin_bp.route("/api/admin/schedule-templates", methods=["POST"])
@jwt_required
@roles_required("admin")
def create_admin_schedule_template():
    try:
        template = create_schedule_template(
            request.get_json(silent=True) or {},
            actor=g.auth.get("sub", ""),
        )
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    return jsonify({
        "status": "created",
        "template": template,
    }), 201


@admin_bp.route(
    "/api/admin/schedule-templates/<template_id>",
    methods=["GET"],
)
@jwt_required
@roles_required("admin")
def get_admin_schedule_template(template_id):
    template = get_schedule_template(template_id)
    if template is None:
        return jsonify({"error": "Timetable slot not found"}), 404
    return jsonify({
        "status": "success",
        "template": template,
    })


@admin_bp.route(
    "/api/admin/schedule-templates/<template_id>",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def update_admin_schedule_template(template_id):
    try:
        template = update_schedule_template(
            template_id,
            request.get_json(silent=True) or {},
            actor=g.auth.get("sub", ""),
        )
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    if template is None:
        return jsonify({"error": "Timetable slot not found"}), 404
    return jsonify({
        "status": "updated",
        "template": template,
    })


@admin_bp.route(
    "/api/admin/schedule-templates/<template_id>",
    methods=["DELETE"],
)
@jwt_required
@roles_required("admin")
def delete_admin_schedule_template(template_id):
    try:
        deleted = delete_schedule_template(template_id)
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    if not deleted:
        return jsonify({"error": "Timetable slot not found"}), 404
    return jsonify({
        "status": "deleted",
        "templateId": template_id,
    })


@admin_bp.route("/api/admin/daily-services", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_daily_services():
    service_date = request.args.get("date", "").strip()
    status = request.args.get("status", "").strip().lower()
    search_value = request.args.get("q", "").strip()

    if len(search_value) > 80:
        return jsonify({"error": "q must be 80 characters or fewer"}), 400
    if status and status not in DAILY_SERVICE_STATUSES:
        return jsonify({
            "error": "Invalid daily service status",
            "allowedStatuses": sorted(DAILY_SERVICE_STATUSES),
        }), 400

    try:
        services = list_daily_services(
            service_date=service_date,
            status=status,
            query=search_value,
        )
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    return jsonify({
        "status": "success",
        "services": services,
        "meta": {
            "count": len(services),
            "statuses": sorted(DAILY_SERVICE_STATUSES),
        },
    })


@admin_bp.route("/api/admin/daily-services", methods=["POST"])
@jwt_required
@roles_required("admin")
def create_admin_daily_service():
    try:
        service = create_daily_service(
            request.get_json(silent=True) or {},
            actor=g.auth.get("sub", ""),
        )
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    return jsonify({
        "status": "created",
        "service": service,
    }), 201


@admin_bp.route(
    "/api/admin/daily-services/<service_id>",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def update_admin_daily_service(service_id):
    try:
        service = update_daily_service(
            service_id,
            request.get_json(silent=True) or {},
            actor=g.auth.get("sub", ""),
        )
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    if service is None:
        return jsonify({"error": "Daily service not found"}), 404
    return jsonify({
        "status": "updated",
        "service": service,
    })


@admin_bp.route(
    "/api/admin/daily-services/<service_id>",
    methods=["DELETE"],
)
@jwt_required
@roles_required("admin")
def delete_admin_daily_service(service_id):
    try:
        deleted = delete_daily_service(service_id)
    except ScheduleValidationError as validation_error:
        return _schedule_validation_response(validation_error)

    if not deleted:
        return jsonify({"error": "Daily service not found"}), 404
    return jsonify({
        "status": "deleted",
        "serviceId": service_id,
    })


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/approve",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def approve_driver(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    if verification_status in {"approved", "verified"}:
        return jsonify({
            "status": "approved",
            "driver_id": driver_id,
        })

    if verification_status != "under_review":
        return jsonify({
            "error": (
                "The application must be under review before approval"
            ),
            "code": "DRIVER_REVIEW_REQUIRED",
            "verificationStatus": verification_status,
        }), 409

    if not has_all_required_documents(driver):
        return jsonify({
            "error": (
                "All four required identity documents must be submitted "
                "before approval"
            ),
            "requiredDocuments": sorted(REQUIRED_DOCUMENT_TYPES),
            "kycStatus": driver.get("kycStatus", "NOT_SUBMITTED"),
        }), 409

    now = datetime.now(timezone.utc)
    documents = driver.get("documents") or {}
    revision_condition, status_condition = driver_review_snapshot(driver)
    reviewed_document_conditions = [
        {f"documents.{document_type}": documents[document_type]}
        for document_type in REQUIRED_DOCUMENT_TYPES
    ]

    result = drivers_collection.update_one(
        {
            "_id": driver_object_id,
            "$and": [
                revision_condition,
                status_condition,
                *reviewed_document_conditions,
            ],
        },
        {
            "$set": {
                "verificationStatus": "approved",
                "kycStatus": "APPROVED",
                "approvedAt": now,
                "approvedBy": g.auth.get("sub", ""),
                "updatedAt": now,
            },
            "$unset": {
                "correctionFields": "",
                "correctionMessage": "",
                "correctionRequestedAt": "",
                "correctionRequestedBy": "",
                "rejectionReason": "",
                "rejectedAt": "",
                "rejectedBy": "",
            },
        },
    )

    if result.matched_count == 0:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver documents or review status changed; reload "
                    "before approval"
                ),
                "code": "DRIVER_REVIEW_STALE",
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    create_driver_notification(
        driver_id,
        title="Driver account approved",
        message=(
            "Your driver verification is complete. You can now access "
            "approved driver features."
        ),
        notification_type="driver_approved",
        created_at=now,
    )

    return jsonify({
        "status": "approved",
        "driver_id": driver_id,
    })


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/request-correction",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def request_driver_correction(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    data = request.get_json(silent=True) or {}
    raw_fields = data.get("fields")
    message = str(data.get("message") or "").strip()

    if not isinstance(raw_fields, list):
        return jsonify({
            "error": "fields must be a list of document field names"
        }), 400

    correction_fields = sorted({
        str(field).strip()
        for field in raw_fields
        if str(field).strip()
    })

    if not correction_fields:
        return jsonify({
            "error": "Select at least one document that requires correction"
        }), 400

    invalid_fields = [
        field
        for field in correction_fields
        if field not in CORRECTABLE_DOCUMENT_FIELDS
    ]
    if invalid_fields:
        return jsonify({
            "error": "One or more correction fields are invalid",
            "invalidFields": invalid_fields,
            "allowedFields": sorted(CORRECTABLE_DOCUMENT_FIELDS),
        }), 400

    if not message:
        return jsonify({
            "error": "A correction message is required"
        }), 400

    if len(message) > 1000:
        return jsonify({
            "error": "Correction message must be 1000 characters or fewer"
        }), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    if verification_status != "under_review":
        return jsonify({
            "error": (
                "The application must be under review before requesting "
                "corrections"
            ),
            "code": "DRIVER_REVIEW_REQUIRED",
            "verificationStatus": verification_status,
        }), 409

    now = datetime.now(timezone.utc)
    revision_condition, status_condition = driver_review_snapshot(driver)

    result = drivers_collection.update_one(
        {
            "_id": driver_object_id,
            "$and": [
                revision_condition,
                status_condition,
            ],
        },
        {
            "$set": {
                "verificationStatus": "correction_required",
                "kycStatus": "CORRECTION_REQUIRED",
                "correctionFields": correction_fields,
                "correctionMessage": message,
                "correctionRequestedAt": now,
                "correctionRequestedBy": g.auth.get("sub", ""),
                "updatedAt": now,
            },
        },
    )

    if result.matched_count != 1:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver verification data changed; reload before "
                    "requesting corrections"
                ),
                "code": "DRIVER_REVIEW_STALE",
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    create_driver_notification(
        driver_id,
        title="Driver documents need correction",
        message=message,
        notification_type="driver_correction_required",
        created_at=now,
    )

    return jsonify({
        "status": "correction_required",
        "driver_id": driver_id,
        "fields": correction_fields,
        "message": message,
    })


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/block",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def block_driver(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()

    if not reason:
        return jsonify({"error": "Block reason is required"}), 400

    if len(reason) > 1000:
        return jsonify({
            "error": "Block reason must be 1000 characters or fewer"
        }), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    current_status = normalize_driver_status(
        driver.get("verificationStatus"),
    )

    if current_status == "blocked":
        return jsonify({
            "error": "Driver account is already blocked",
            "code": "DRIVER_ALREADY_BLOCKED",
        }), 409

    now = datetime.now(timezone.utc)
    stored_status = driver.get("verificationStatus")
    status_condition = (
        {"verificationStatus": stored_status}
        if "verificationStatus" in driver
        else {"verificationStatus": {"$exists": False}}
    )

    result = drivers_collection.update_one(
        {
            "_id": driver_object_id,
            "$and": [status_condition],
        },
        {
            "$set": {
                "verificationStatus": "blocked",
                "statusBeforeBlock": current_status,
                "kycStatusBeforeBlock": str(
                    driver.get("kycStatus") or "NOT_SUBMITTED"
                ),
                "blockedAt": now,
                "blockedBy": g.auth.get("sub", ""),
                "blockReason": reason,
                "updatedAt": now,
            },
        },
    )

    if result.matched_count != 1:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver status changed; reload before blocking the account"
                ),
                "code": "DRIVER_REVIEW_STALE",
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    safely_suspend_driver_trip(driver_id, now)

    create_driver_notification(
        driver_id,
        title="Driver account blocked",
        message=reason,
        notification_type="driver_blocked",
        created_at=now,
    )

    return jsonify({
        "status": "blocked",
        "driver_id": driver_id,
        "reason": reason,
    })


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/unblock",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def unblock_driver(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    current_status = normalize_driver_status(
        driver.get("verificationStatus"),
    )

    if current_status != "blocked":
        return jsonify({
            "error": "Only a blocked driver account can be unblocked",
            "code": "DRIVER_NOT_BLOCKED",
            "verificationStatus": current_status,
        }), 409

    target_status, target_kyc_status = resolve_unblock_target(driver)
    now = datetime.now(timezone.utc)

    set_fields = {
        "verificationStatus": target_status,
        "kycStatus": target_kyc_status,
        "unblockedAt": now,
        "unblockedBy": g.auth.get("sub", ""),
        "updatedAt": now,
    }

    if driver.get("blockReason"):
        set_fields["lastBlockReason"] = driver.get("blockReason")
    if driver.get("blockedAt"):
        set_fields["lastBlockedAt"] = driver.get("blockedAt")
    if driver.get("blockedBy"):
        set_fields["lastBlockedBy"] = driver.get("blockedBy")

    result = drivers_collection.update_one(
        {
            "_id": driver_object_id,
            "verificationStatus": driver.get("verificationStatus"),
        },
        {
            "$set": set_fields,
            "$unset": {
                "statusBeforeBlock": "",
                "kycStatusBeforeBlock": "",
                "blockReason": "",
                "blockedAt": "",
                "blockedBy": "",
            },
        },
    )

    if result.matched_count != 1:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver status changed; reload before unblocking the account"
                ),
                "code": "DRIVER_REVIEW_STALE",
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    create_driver_notification(
        driver_id,
        title="Driver account unblocked",
        message=(
            "Your driver account has been unblocked. Current verification "
            f"status: {target_status.replace('_', ' ')}."
        ),
        notification_type="driver_unblocked",
        created_at=now,
    )

    return jsonify({
        "status": "unblocked",
        "driver_id": driver_id,
        "verificationStatus": target_status,
        "kycStatus": target_kyc_status,
    })


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/reject",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def reject_driver(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()

    if not reason:
        return jsonify({"error": "Rejection reason is required"}), 400

    if len(reason) > 1000:
        return jsonify({
            "error": "Rejection reason must be 1000 characters or fewer"
        }), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    if verification_status != "under_review":
        return jsonify({
            "error": (
                "The application must be under review before rejection"
            ),
            "code": "DRIVER_REVIEW_REQUIRED",
            "verificationStatus": verification_status,
        }), 409

    now = datetime.now(timezone.utc)
    revision_condition, status_condition = driver_review_snapshot(driver)

    result = drivers_collection.update_one(
        {
            "_id": driver_object_id,
            "$and": [
                revision_condition,
                status_condition,
            ],
        },
        {
            "$set": {
                "verificationStatus": "rejected",
                "kycStatus": "REJECTED",
                "rejectedAt": now,
                "rejectedBy": g.auth.get("sub", ""),
                "rejectionReason": reason,
                "updatedAt": now,
            },
            "$unset": {
                "correctionFields": "",
                "correctionMessage": "",
                "correctionRequestedAt": "",
                "correctionRequestedBy": "",
            },
        },
    )

    if result.matched_count != 1:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver verification data changed; reload before rejection"
                ),
                "code": "DRIVER_REVIEW_STALE",
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    safely_suspend_driver_trip(driver_id, now)

    create_driver_notification(
        driver_id,
        title="Driver application rejected",
        message=reason,
        notification_type="driver_rejected",
        created_at=now,
    )

    return jsonify({
        "status": "rejected",
        "driver_id": driver_id,
        "reason": reason,
    })


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/unreject",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def unreject_driver(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({"error": "Invalid driver id"}), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})

    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    current_status = normalize_driver_status(
        driver.get("verificationStatus"),
    )

    if current_status != "rejected":
        return jsonify({
            "error": "Only a rejected driver application can be reopened",
            "code": "DRIVER_NOT_REJECTED",
            "verificationStatus": current_status,
        }), 409

    documents_complete = has_all_required_documents(driver)
    target_status = "under_review" if documents_complete else "pending"
    target_kyc_status = (
        "UNDER_REVIEW" if documents_complete else "NOT_SUBMITTED"
    )
    now = datetime.now(timezone.utc)

    set_fields = {
        "verificationStatus": target_status,
        "kycStatus": target_kyc_status,
        "reopenedAt": now,
        "reopenedBy": g.auth.get("sub", ""),
        "updatedAt": now,
    }

    if documents_complete:
        set_fields.update({
            "reviewedAt": now,
            "reviewedBy": g.auth.get("sub", ""),
        })

    if driver.get("rejectionReason"):
        set_fields["lastRejectionReason"] = driver.get("rejectionReason")
    if driver.get("rejectedAt"):
        set_fields["lastRejectedAt"] = driver.get("rejectedAt")
    if driver.get("rejectedBy"):
        set_fields["lastRejectedBy"] = driver.get("rejectedBy")

    unset_fields = {
        "rejectionReason": "",
        "rejectedAt": "",
        "rejectedBy": "",
    }
    if not documents_complete:
        unset_fields.update({
            "reviewedAt": "",
            "reviewedBy": "",
        })

    result = drivers_collection.update_one(
        {
            "_id": driver_object_id,
            "verificationStatus": driver.get("verificationStatus"),
        },
        {
            "$set": set_fields,
            "$unset": unset_fields,
        },
    )

    if result.matched_count != 1:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver status changed; reload before reopening the "
                    "application"
                ),
                "code": "DRIVER_REVIEW_STALE",
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    create_driver_notification(
        driver_id,
        title="Driver application reopened",
        message=(
            "Your driver application has been reopened for administrative "
            "review."
        ),
        notification_type="driver_application_reopened",
        created_at=now,
    )

    return jsonify({
        "status": "unrejected",
        "driver_id": driver_id,
        "verificationStatus": target_status,
        "kycStatus": target_kyc_status,
    })


@admin_bp.route(
    "/api/admin/drivers/pending-count",
    methods=["GET"],
)
@jwt_required
@roles_required("admin")
def pending_drivers_count():
    count = drivers_collection.count_documents({
        "verificationStatus": {
            "$in": ["pending", "under_review"],
        },
    })

    return jsonify({
        "pendingCount": count
    })
