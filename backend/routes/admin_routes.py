import os
from datetime import datetime, timezone

import bcrypt
from bson.objectid import ObjectId
from flask import Blueprint, current_app, g, jsonify, request

from config import buses_collection, drivers_collection, trips_collection
from extensions import socketio
from services.driver_trip_service import (
    OPEN_TRIP_STATUSES,
    build_safe_bus_payload,
    driver_reference_query,
)
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
        "verificationStatus": driver.get(
            "verificationStatus",
            "pending",
        ),
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

    allowed_statuses = {
        "pending",
        "approved",
        "verified",
        "blocked",
        "rejected",
        "under_review",
        "unverified",
    }

    if verification_status:
        if verification_status not in allowed_statuses:
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
