import os
from datetime import datetime, timezone

import bcrypt
from bson.objectid import ObjectId
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
from services.route_service import get_all_routes, route_to_summary
from utils.auth_utils import (
    create_access_token,
    jwt_required,
    roles_required,
)


admin_bp = Blueprint("admin_bp", __name__)

REQUIRED_DOCUMENT_TYPES = {
    "nicFront",
    "nicBack",
    "drivingLicenseFront",
    "drivingLicenseBack",
}

DRIVER_STATUSES = {
    "pending",
    "approved",
    "verified",
    "blocked",
    "rejected",
    "under_review",
    "unverified",
}
TRIP_STATUSES = {"active", "paused", "completed"}
ISSUE_STATUSES = {"open", "in_review", "resolved", "dismissed"}


def _iso_value(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return str(value) if value else ""


def serialize_admin_bus(bus):
    status = str(
        bus.get("operationalStatus")
        or ("active" if bus.get("isActive") else "offline")
    ).strip().lower()
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
        "routeNumber": str(bus.get("routeNumber") or ""),
        "driverId": str(bus.get("driver_id") or bus.get("driverId") or ""),
        "operationalStatus": status,
        "isActive": status == "active",
        "activeTripId": str(
            bus.get("activeTripId") or bus.get("tripId") or ""
        ),
        "lat": bus.get("lat"),
        "lng": bus.get("lng"),
        "speed": bus.get("speed"),
        "heading": bus.get("heading"),
        "statusUpdatedAt": _iso_value(bus.get("statusUpdatedAt")),
        "updatedAt": _iso_value(
            bus.get("updatedAt") or bus.get("lastUpdated")
        ),
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


def serialize_admin_driver(driver):
    created_at = driver.get("createdAt")
    updated_at = driver.get("updatedAt")

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()
    if verification_status not in DRIVER_STATUSES:
        verification_status = "pending"

    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()

    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()

    return {
        "_id": str(driver["_id"]),
        "driver_id": str(driver["_id"]),
        "fullName": driver.get(
            "fullName",
            driver.get("name", ""),
        ),
        "nic": driver.get("nic", ""),
        "mobile": driver.get("mobile", ""),
        "email": driver.get("email", ""),
        "conductorName": driver.get("conductorName", ""),
        "driverNtcRegistrationNumber": driver.get(
            "driverNtcRegistrationNumber",
            "",
        ),
        "busNtcPermitNumber": driver.get(
            "busNtcPermitNumber",
            "",
        ),
        "drivingLicenseNumber": driver.get(
            "drivingLicenseNumber",
            "",
        ),
        "drivingLicenseExpiry": driver.get(
            "drivingLicenseExpiry",
            "",
        ),
        "busRouteNumber": driver.get(
            "busRouteNumber",
            "",
        ),
        "vehicleRegistrationNumber": driver.get(
            "vehicleRegistrationNumber",
            "",
        ),
        "depotOperator": driver.get(
            "depotOperator",
            "",
        ),
        "verificationStatus": verification_status,
        "kycStatus": driver.get(
            "kycStatus",
            "NOT_SUBMITTED",
        ),
        "kycRevision": driver.get("kycRevision", 0),
        "documents": driver.get("documents", {}),
        "createdAt": created_at or "",
        "updatedAt": updated_at or "",
    }


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

        query["verificationStatus"] = verification_status

    drivers = drivers_collection.find(
        query,
        {
            "password": 0,
        },
    ).sort("createdAt", -1)

    return jsonify([
        serialize_admin_driver(driver)
        for driver in drivers
    ])


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
                "verificationStatus": "pending",
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


@admin_bp.route("/api/admin/buses", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_buses():
    status = request.args.get("status", "").strip().lower()
    query = {}
    if status:
        if status not in {"active", "paused", "offline"}:
            return jsonify({"error": "Invalid bus status"}), 400
        if status == "active":
            query["$or"] = [
                {"operationalStatus": "active"},
                {"isActive": True},
            ]
        else:
            query["operationalStatus"] = status

    buses = buses_collection.find(query).sort("statusUpdatedAt", -1)
    return jsonify({
        "status": "success",
        "buses": [serialize_admin_bus(bus) for bus in buses],
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
    if issue_status and issue_status not in ISSUE_STATUSES:
        return jsonify({"error": "Invalid issue status"}), 400

    try:
        limit = int(request.args.get("limit", "50"))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer"}), 400
    if not 1 <= limit <= 100:
        return jsonify({"error": "limit must be between 1 and 100"}), 400

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

    now = datetime.now(timezone.utc)
    result = issue_reports_collection.update_one(
        {"_id": ObjectId(issue_id)},
        {"$set": {
            "status": status,
            "resolutionNote": resolution_note,
            "updatedAt": now,
            "updatedBy": g.auth.get("sub", ""),
        }},
    )
    if result.matched_count == 0:
        return jsonify({"error": "Issue not found"}), 404
    issue = issue_reports_collection.find_one({"_id": ObjectId(issue_id)})
    return jsonify({"status": "updated", "issue": serialize_admin_issue(issue)})


@admin_bp.route("/api/admin/routes", methods=["GET"])
@jwt_required
@roles_required("admin")
def list_admin_routes():
    routes = get_all_routes()
    return jsonify({
        "status": "success",
        "routes": [route_to_summary(route) for route in routes],
    })


@admin_bp.route("/api/admin/routes/<route_number>", methods=["GET"])
@jwt_required
@roles_required("admin")
def get_admin_route(route_number):
    routes = get_all_routes()
    route = next(
        (item for item in routes if item["routeNumber"] == str(route_number).strip()),
        None,
    )
    if route is None:
        return jsonify({"error": "Route not found"}), 404
    return jsonify({"status": "success", "route": route})


@admin_bp.route(
    "/api/admin/drivers/<driver_id>/approve",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def approve_driver(driver_id):
    driver_object_id = get_driver_object_id(driver_id)

    if driver_object_id is None:
        return jsonify({
            "error": "Invalid driver id"
        }), 400

    driver = drivers_collection.find_one({"_id": driver_object_id})
    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    if not has_all_required_documents(driver):
        return jsonify({
            "error": "All four required identity documents must be submitted before approval",
            "requiredDocuments": sorted(REQUIRED_DOCUMENT_TYPES),
            "kycStatus": driver.get("kycStatus", "NOT_SUBMITTED"),
        }), 409

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()
    if verification_status == "blocked":
        return jsonify({
            "error": "A blocked driver must be explicitly unblocked before approval",
        }), 409

    now = datetime.now(timezone.utc)
    documents = driver.get("documents") or {}
    raw_kyc_revision = driver.get("kycRevision")
    revision_condition = (
        {"kycRevision": raw_kyc_revision}
        if "kycRevision" in driver
        else {"kycRevision": {"$exists": False}}
    )
    status_condition = (
        {"verificationStatus": driver.get("verificationStatus")}
        if "verificationStatus" in driver
        else {"verificationStatus": {"$exists": False}}
    )
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
            }
        },
    )

    if result.matched_count == 0:
        if drivers_collection.find_one(
            {"_id": driver_object_id},
            {"_id": 1},
        ):
            return jsonify({
                "error": (
                    "Driver documents changed during review; reload them before approval"
                ),
            }), 409
        return jsonify({"error": "Driver not found"}), 404

    return jsonify({
        "status": "approved",
        "driver_id": driver_id,
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
        return jsonify({
            "error": "Invalid driver id"
        }), 400

    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()
    now = datetime.now(timezone.utc)

    result = drivers_collection.update_one(
        {"_id": driver_object_id},
        {
            "$set": {
                "verificationStatus": "blocked",
                "blockedAt": now,
                "blockedBy": g.auth.get("sub", ""),
                "blockReason": reason,
                "updatedAt": now,
            },
            "$inc": {"kycRevision": 1},
        },
    )

    if result.matched_count == 0:
        return jsonify({
            "error": "Driver not found"
        }), 404

    safely_suspend_driver_trip(driver_id, now)

    return jsonify({
        "status": "blocked",
        "driver_id": driver_id,
        "reason": reason,
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
        return jsonify({
            "error": "Invalid driver id"
        }), 400

    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()

    if not reason:
        return jsonify({
            "error": "Rejection reason is required"
        }), 400

    now = datetime.now(timezone.utc)

    result = drivers_collection.update_one(
        {"_id": driver_object_id},
        {
            "$set": {
                "verificationStatus": "rejected",
                "kycStatus": "REJECTED",
                "rejectedAt": now,
                "rejectedBy": g.auth.get("sub", ""),
                "rejectionReason": reason,
                "updatedAt": now,
            },
            "$inc": {"kycRevision": 1},
        },
    )

    if result.matched_count == 0:
        return jsonify({
            "error": "Driver not found"
        }), 404

    safely_suspend_driver_trip(driver_id, now)

    return jsonify({
        "status": "rejected",
        "driver_id": driver_id,
        "reason": reason,
    })


@admin_bp.route(
    "/api/admin/drivers/pending-count",
    methods=["GET"],
)
@jwt_required
@roles_required("admin")
def pending_drivers_count():
    count = drivers_collection.count_documents({
        "verificationStatus": "pending"
    })

    return jsonify({
        "pendingCount": count
    })
