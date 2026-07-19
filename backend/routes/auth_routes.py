from flask import Blueprint, g, jsonify, request
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import math
import re
from urllib.parse import unquote, urlparse
import bcrypt
from bson.objectid import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from config import (
    buses_collection,
    driver_shifts_collection,
    drivers_collection,
    notifications_collection,
    otp_collection,
    trips_collection,
)
from utils.mobile_utils import normalize_mobile
from utils.sms_service import send_sms, generate_otp
from utils.storage_service import (
    STORAGE_BUCKET,
    build_safe_folder,
    get_storage_url,
)
from utils.auth_utils import (
    create_access_token,
    get_jwt_secret,
    jwt_required,
    roles_required,
    subject_matches_route_param,
)

auth_bp = Blueprint("auth_bp", __name__)

DRIVER_ACCESS_TOKEN_HOURS = 24 * 30
DRIVER_ACCESS_TOKEN_SECONDS = DRIVER_ACCESS_TOKEN_HOURS * 60 * 60
OTP_VALIDITY_MINUTES = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_VERIFY_ATTEMPTS = 5
TRACKING_STALE_SECONDS = 120
TRACKING_FUTURE_TOLERANCE_SECONDS = 30
REQUIRED_DOCUMENT_TYPES = {
    "nicFront",
    "nicBack",
    "drivingLicenseFront",
    "drivingLicenseBack",
}

LEGACY_OPERATIONAL_REGISTRATION_FIELDS = {
    "conductorName",
    "busNtcPermitNumber",
    "busRouteNumber",
    "vehicleRegistrationNumber",
}


def otp_hash(mobile, purpose, otp):
    message = f"{mobile}:{purpose}:{otp}".encode("utf-8")
    return hmac.new(
        get_jwt_secret().encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def otp_key(mobile, purpose):
    return f"{purpose}:{mobile}"


def otp_matches(record, mobile, purpose, candidate):
    stored_hash = str(record.get("otpHash") or "")
    if stored_hash:
        return hmac.compare_digest(
            stored_hash,
            otp_hash(mobile, purpose, candidate),
        )

    # Temporary compatibility for OTP records created before hashed storage.
    return hmac.compare_digest(
        str(record.get("otp") or ""),
        candidate,
    )


def find_otp_record(mobile, purpose):
    record = otp_collection.find_one({
        "otpKey": otp_key(mobile, purpose),
    })
    if record:
        return record

    # Temporary compatibility for unexpired records created before otpKey.
    return otp_collection.find_one({
        "mobile": mobile,
        "purpose": purpose,
    })


def otp_request_cooldown(mobile, purpose):
    record = find_otp_record(mobile, purpose)
    next_allowed_at = (
        record.get("nextAllowedAt")
        if isinstance(record, dict)
        else None
    )
    sent_at = record.get("sent_at") if isinstance(record, dict) else None

    if isinstance(next_allowed_at, datetime):
        now = (
            datetime.now(tz=next_allowed_at.tzinfo)
            if next_allowed_at.tzinfo
            else datetime.now()
        )
        retry_after = math.ceil((next_allowed_at - now).total_seconds())
    elif isinstance(sent_at, datetime):
        now = datetime.now(tz=sent_at.tzinfo) if sent_at.tzinfo else datetime.now()
        elapsed_seconds = (now - sent_at).total_seconds()
        retry_after = math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed_seconds)
    else:
        return None

    if retry_after <= 0:
        return None

    response = jsonify({
        "error": "Please wait before requesting another OTP",
        "retryAfterSeconds": retry_after,
    })
    response.headers["Retry-After"] = str(retry_after)
    return response, 429


def reserve_otp_record(mobile, purpose, candidate, registration_data=None):
    sent_at = datetime.now()
    expires_at = sent_at + timedelta(minutes=OTP_VALIDITY_MINUTES)
    next_allowed_at = sent_at + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)
    request_hash = otp_hash(mobile, purpose, candidate)
    canonical_key = otp_key(mobile, purpose)
    update_fields = {
        "otpKey": canonical_key,
        "mobile": mobile,
        "purpose": purpose,
        "otpHash": request_hash,
        "expires_at": expires_at,
        "sent_at": sent_at,
        "nextAllowedAt": next_allowed_at,
        "attempts": 0,
    }
    if registration_data is not None:
        update_fields["registration_data"] = registration_data

    update_document = {
        "$set": update_fields,
        "$unset": {"otp": "", "lockedAt": ""},
    }
    if registration_data is None:
        update_document["$unset"]["registration_data"] = ""

    try:
        record = otp_collection.find_one_and_update(
            {
                "otpKey": canonical_key,
                "$or": [
                    {"nextAllowedAt": {"$lte": sent_at}},
                    {"nextAllowedAt": {"$exists": False}},
                ],
            },
            update_document,
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        cooldown_response = otp_request_cooldown(mobile, purpose)
        if cooldown_response:
            return None, cooldown_response
        return None, (
            jsonify({"error": "An OTP request is already being processed"}),
            429,
        )

    if not isinstance(record, dict):
        return None, (
            jsonify({"error": "The OTP request could not be reserved"}),
            503,
        )

    return record, None


def consume_otp_record(mobile, purpose, candidate):
    record = find_otp_record(mobile, purpose)
    if not isinstance(record, dict):
        return None, (
            jsonify({"error": "No OTP request found for this number"}),
            400,
        )

    stored_hash = str(record.get("otpHash") or "")
    if stored_hash:
        otp_identity = {"otpHash": stored_hash}
    elif "otp" in record:
        otp_identity = {"otp": record.get("otp")}
    else:
        otp_identity = {
            "otpHash": {"$exists": False},
            "otp": {"$exists": False},
        }

    expires_at = record.get("expires_at")
    expiry_snapshot = (
        {"expires_at": expires_at}
        if "expires_at" in record
        else {"expires_at": {"$exists": False}}
    )
    if not isinstance(expires_at, datetime):
        otp_collection.delete_one({
            "_id": record.get("_id"),
            **otp_identity,
            **expiry_snapshot,
        })
        return None, (
            jsonify({
                "error": "OTP request is invalid, please request a new one",
            }),
            400,
        )

    now = (
        datetime.now(tz=expires_at.tzinfo)
        if expires_at.tzinfo
        else datetime.now()
    )
    if now > expires_at:
        otp_collection.delete_one({
            "_id": record.get("_id"),
            **otp_identity,
            **expiry_snapshot,
        })
        return None, (
            jsonify({"error": "OTP has expired, please request a new one"}),
            400,
        )

    try:
        attempts = max(int(record.get("attempts", 0) or 0), 0)
    except (TypeError, ValueError):
        attempts = 0

    if attempts >= OTP_MAX_VERIFY_ATTEMPTS:
        otp_collection.update_one(
            {
                "_id": record.get("_id"),
                **otp_identity,
                **expiry_snapshot,
                "attempts": record.get("attempts"),
            },
            {
                "$set": {
                    "attempts": OTP_MAX_VERIFY_ATTEMPTS,
                    "lockedAt": datetime.now(),
                },
                "$unset": {
                    "otpHash": "",
                    "otp": "",
                    "registration_data": "",
                },
            },
        )
        return None, (
            jsonify({
                "error": "Too many OTP attempts, please request a new code",
            }),
            429,
        )

    attempt_window = {
        "$or": [
            {"attempts": {"$lt": OTP_MAX_VERIFY_ATTEMPTS}},
            {"attempts": {"$exists": False}},
        ],
    }

    if not re.fullmatch(r"\d{6}", candidate) or not otp_matches(
        record,
        mobile,
        purpose,
        candidate,
    ):
        updated_record = otp_collection.find_one_and_update(
            {
                "_id": record.get("_id"),
                "expires_at": {"$gt": now},
                **otp_identity,
                **attempt_window,
            },
            {"$inc": {"attempts": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if not isinstance(updated_record, dict):
            return None, (
                jsonify({
                    "error": "OTP changed or reached its attempt limit; request a new code",
                }),
                409,
            )

        try:
            updated_attempts = max(int(updated_record.get("attempts", 0)), 0)
        except (TypeError, ValueError):
            updated_attempts = OTP_MAX_VERIFY_ATTEMPTS
        remaining = max(OTP_MAX_VERIFY_ATTEMPTS - updated_attempts, 0)

        if remaining == 0:
            otp_collection.update_one(
                {
                    "_id": record.get("_id"),
                    **otp_identity,
                    "expires_at": expires_at,
                    "attempts": {"$gte": OTP_MAX_VERIFY_ATTEMPTS},
                },
                {
                    "$set": {
                        "attempts": OTP_MAX_VERIFY_ATTEMPTS,
                        "lockedAt": datetime.now(),
                    },
                    "$unset": {
                        "otpHash": "",
                        "otp": "",
                        "registration_data": "",
                    },
                },
            )
            return None, (
                jsonify({
                    "error": "Too many OTP attempts, please request a new code",
                    "attemptsRemaining": 0,
                }),
                429,
            )

        return None, (
            jsonify({
                "error": "Invalid OTP",
                "attemptsRemaining": remaining,
            }),
            400,
        )

    claimed_record = otp_collection.find_one_and_delete({
        "_id": record.get("_id"),
        "expires_at": {"$gt": now},
        **otp_identity,
        **attempt_window,
    })
    if not isinstance(claimed_record, dict):
        return None, (
            jsonify({
                "error": "OTP was already used or replaced; request a new code",
            }),
            409,
        )

    return claimed_record, None


def to_iso(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return value or ""


def normalize_utc_datetime(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(
                value.strip().replace("Z", "+00:00")
            )
        except ValueError:
            return None

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    return None


def format_duration(seconds):
    seconds = max(int(seconds or 0), 0)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60

    if hours:
        return f"{hours}h {minutes:02d}m"
    return f"{minutes}m"


def driver_related_query(driver_id):
    driver_object_id = ObjectId(driver_id)
    return {
        "$or": [
            {"driver_id": driver_id},
            {"driverId": driver_id},
            {"driver_id": driver_object_id},
            {"driverId": driver_object_id},
        ]
    }


def exact_case_insensitive_query(field, value):
    return {field: {"$regex": f"^{re.escape(value)}$", "$options": "i"}}


def find_driver_by_mobile(mobile):
    return drivers_collection.find_one({
        "$or": [
            {"mobileKey": mobile},
            {"mobile": mobile},
        ],
    })


def get_registration_conflicts(
    mobile=None,
    email=None,
    nic=None,
    driver_ntc_registration_number=None,
    driving_license_number=None,
):
    conflicts = {}

    if mobile:
        normalized_mobile = normalize_mobile(mobile)
        if drivers_collection.find_one({
            "$or": [
                {"mobileKey": normalized_mobile},
                {"mobile": normalized_mobile},
            ],
        }):
            conflicts["mobile"] = "This mobile number is already registered"

    if isinstance(email, str) and email.strip():
        normalized_email = email.strip().casefold()
        if drivers_collection.find_one({
            "$or": [
                {"emailKey": normalized_email},
                exact_case_insensitive_query("email", email.strip()),
            ],
        }):
            conflicts["email"] = "This email is already registered"

    if isinstance(nic, str) and nic.strip():
        normalized_nic = nic.strip().upper()
        if drivers_collection.find_one({
            "$or": [
                {"nicKey": normalized_nic},
                exact_case_insensitive_query("nic", normalized_nic),
            ],
        }):
            conflicts["nic"] = "This NIC is already registered"

    if (
        isinstance(driver_ntc_registration_number, str)
        and driver_ntc_registration_number.strip()
    ):
        normalized_ntc = driver_ntc_registration_number.strip().upper()
        if drivers_collection.find_one({
            "$or": [
                {"driverNtcRegistrationNumberKey": normalized_ntc},
                exact_case_insensitive_query(
                    "driverNtcRegistrationNumber",
                    normalized_ntc,
                ),
            ],
        }):
            conflicts["driverNtcRegistrationNumber"] = (
                "This driver NTC registration number is already registered"
            )

    if (
        isinstance(driving_license_number, str)
        and driving_license_number.strip()
    ):
        normalized_license = driving_license_number.strip().upper()
        if drivers_collection.find_one({
            "$or": [
                {"drivingLicenseNumberKey": normalized_license},
                exact_case_insensitive_query(
                    "drivingLicenseNumber",
                    normalized_license,
                ),
            ],
        }):
            conflicts["drivingLicenseNumber"] = (
                "This driving license number is already registered"
            )

    return conflicts

def is_today_or_future_date(value):
    try:
        selected_date = datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return False

    return selected_date >= datetime.now().date()


def registration_documents_complete(documents):
    if not isinstance(documents, dict):
        return False

    return all(
        isinstance(documents.get(document_type), dict)
        and documents[document_type].get("fileName")
        and documents[document_type].get("url")
        for document_type in REQUIRED_DOCUMENT_TYPES
    )


def sanitize_registration_documents(documents, mobile):
    if not isinstance(documents, dict):
        return None, "documents must be an object"

    provided_documents = {
        document_type: documents.get(document_type)
        for document_type in REQUIRED_DOCUMENT_TYPES
        if documents.get(document_type) is not None
    }
    if not provided_documents:
        return {}, None

    try:
        storage_url = urlparse(get_storage_url())
    except RuntimeError:
        return None, "Document storage is not configured"

    storage_prefix = (
        f"{storage_url.path.rstrip('/')}/object/public/{STORAGE_BUCKET}/"
    )
    expected_folder = build_safe_folder(mobile)
    mime_by_extension = {
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }
    sanitized = {}

    for document_type, document in provided_documents.items():
        if not isinstance(document, dict):
            return None, f"{document_type} document reference is invalid"

        file_name = str(document.get("fileName") or "").strip()
        mime_type = str(document.get("mimeType") or "").strip().lower()
        public_url = str(document.get("url") or "").strip()
        file_match = re.fullmatch(
            rf"{re.escape(expected_folder)}/([0-9a-f]{{32}})\.(jpg|png|webp)",
            file_name,
        )

        if not file_match:
            return None, f"{document_type} storage path is invalid"

        extension = file_match.group(2)
        if mime_type != mime_by_extension[extension]:
            return None, f"{document_type} MIME type does not match its upload"

        parsed_url = urlparse(public_url)
        expected_path = storage_prefix + file_name
        if (
            parsed_url.scheme != storage_url.scheme
            or parsed_url.netloc != storage_url.netloc
            or unquote(parsed_url.path) != expected_path
            or parsed_url.params
            or parsed_url.query
            or parsed_url.fragment
        ):
            return None, f"{document_type} public URL is invalid"

        sanitized[document_type] = {
            "fileName": file_name,
            "url": public_url,
            "mimeType": mime_type,
        }

    return sanitized, None


def validate_registration_identity(mobile, email, nic, password):
    errors = {}

    if not re.fullmatch(r"947\d{8}", mobile):
        errors["mobile"] = "Enter a valid Sri Lankan mobile number"

    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        errors["email"] = "Enter a valid email address"

    normalized_nic = nic.upper()
    if not (
        re.fullmatch(r"\d{9}[VX]", normalized_nic)
        or re.fullmatch(r"\d{12}", normalized_nic)
    ):
        errors["nic"] = "Enter a valid Sri Lankan NIC"

    if (
        not isinstance(password, str)
        or len(password) < 8
        or re.search(r"[A-Za-z]", password) is None
        or re.search(r"[0-9]", password) is None
    ):
        errors["password"] = (
            "Password must contain at least 8 characters, one letter, and one number"
        )

    return errors



def validate_registration_profile(
    full_name,
    driver_ntc_registration_number,
    driving_license_number,
    depot_operator,
):
    errors = {}

    if not 2 <= len(full_name) <= 120:
        errors["fullName"] = "Full name must contain between 2 and 120 characters"

    if not 2 <= len(driver_ntc_registration_number) <= 60:
        errors["driverNtcRegistrationNumber"] = (
            "Driver NTC registration number must contain between 2 and 60 characters"
        )

    if not 2 <= len(driving_license_number) <= 60:
        errors["drivingLicenseNumber"] = (
            "Driving license number must contain between 2 and 60 characters"
        )

    if len(depot_operator) > 120:
        errors["depotOperator"] = (
            "Operator or depot name cannot exceed 120 characters"
        )

    return errors

def serialize_driver(driver):
    created_at = driver.get("createdAt")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    if created_at is None:
        created_at = ""

    driver_id = str(driver["_id"])
    return {
        "_id": driver_id,
        "driver_id": driver_id,
        "fullName": driver.get("fullName", driver.get("name", "")),
        "nic": driver.get("nic", ""),
        "mobile": driver.get("mobile", ""),
        "email": driver.get("email", ""),
        "conductorName": driver.get("conductorName", ""),
        "driverNtcRegistrationNumber": driver.get("driverNtcRegistrationNumber", ""),
        "busNtcPermitNumber": driver.get("busNtcPermitNumber", ""),
        "drivingLicenseNumber": driver.get("drivingLicenseNumber", ""),
        "drivingLicenseExpiry": driver.get("drivingLicenseExpiry", ""),
        "busRouteNumber": driver.get("busRouteNumber", ""),
        "vehicleRegistrationNumber": driver.get("vehicleRegistrationNumber", ""),
        "depotOperator": driver.get("depotOperator", ""),
        "verificationStatus": driver.get("verificationStatus", "pending"),
        "kycStatus": driver.get("kycStatus", "NOT_SUBMITTED"),
        "documents": driver.get("documents", {}),
        "createdAt": created_at,
    }


def serialize_trip(trip):
    trip_time = (
        trip.get("completedAt")
        or trip.get("endTime")
        or trip.get("startedAt")
        or trip.get("createdAt")
        or trip.get("time")
    )
    if isinstance(trip_time, datetime):
        time_label = trip_time.strftime("%I:%M %p")
    else:
        time_label = str(trip_time or "")

    distance_value = trip.get("distanceKm", trip.get("distance", 0)) or 0
    try:
        distance_km = float(distance_value)
    except (TypeError, ValueError):
        distance_km = 0

    status = str(trip.get("status", "") or "completed").replace("_", " ").title()
    if status.lower() == "on time":
        status = "On-Time"

    return {
        "id": str(trip.get("_id", "")),
        "from": trip.get("from") or trip.get("origin") or trip.get("startLocation") or "",
        "to": trip.get("to") or trip.get("destination") or trip.get("endLocation") or "",
        "time": time_label,
        "distance": f"{distance_km:.1f} km",
        "passengers": int(trip.get("passengers", trip.get("passengerCount", 0)) or 0),
        "status": status,
    }


def build_shift_payload(driver_id):
    shift = driver_shifts_collection.find_one(
        {
            **driver_related_query(driver_id),
            "status": {"$in": ["active", "on_duty"]},
        },
        sort=[("startedAt", -1), ("createdAt", -1)],
    )

    if not shift:
        return {
            "status": "off_duty",
            "label": "Off Duty",
            "summary": "Shift not started",
            "startedAt": "",
            "activeSeconds": 0,
        }

    started_at = shift.get("startedAt") or shift.get("createdAt")
    active_seconds = 0
    if isinstance(started_at, datetime):
        active_seconds = int((datetime.now() - started_at).total_seconds())

    return {
        "status": "on_duty",
        "label": "On Duty",
        "summary": f"Your shift started {format_duration(active_seconds)} ago",
        "startedAt": to_iso(started_at),
        "activeSeconds": active_seconds,
    }


def build_tracking_payload(driver):
    vehicle_registration_number = driver.get("vehicleRegistrationNumber", "")
    bus_conditions = []
    if vehicle_registration_number:
        bus_conditions.extend([
            {"bus_id": vehicle_registration_number},
            {"vehicleRegistrationNumber": vehicle_registration_number},
        ])
    bus = (
        buses_collection.find_one({"$or": bus_conditions})
        if bus_conditions
        else None
    )

    if not bus or bus.get("lat") is None or bus.get("lng") is None:
        return {
            "status": "waiting",
            "label": "WAITING",
            "message": "Waiting for backend GPS update",
            "lastUpdatedAt": "",
            "lat": None,
            "lng": None,
        }

    last_updated_at = (
        bus.get("updatedAt")
        or bus.get("lastUpdatedAt")
        or bus.get("createdAt")
    )
    normalized_updated_at = normalize_utc_datetime(last_updated_at)
    operational_status = str(
        bus.get("operationalStatus") or ""
    ).strip().lower()

    if operational_status == "paused":
        tracking_status = "paused"
        label = "PAUSED"
        message = "Trip location sharing is paused"
    elif operational_status == "offline" or bus.get("isActive") is False:
        tracking_status = "offline"
        label = "OFFLINE"
        message = "Bus is not sharing live location"
    elif normalized_updated_at is None:
        tracking_status = "offline"
        label = "OFFLINE"
        message = "The last GPS update time is unavailable"
    else:
        age_seconds = (
            datetime.now(timezone.utc) - normalized_updated_at
        ).total_seconds()
        if (
            age_seconds > TRACKING_STALE_SECONDS
            or age_seconds < -TRACKING_FUTURE_TOLERANCE_SECONDS
        ):
            tracking_status = "offline"
            label = "OFFLINE"
            message = "The last GPS update is stale"
        else:
            tracking_status = "live"
            label = "LIVE"
            message = "GPS active"

    return {
        "status": tracking_status,
        "label": label,
        "message": message,
        "lastUpdatedAt": to_iso(last_updated_at),
        "lat": bus.get("lat"),
        "lng": bus.get("lng"),
    }


def build_driver_home_payload(driver):
    driver_id = str(driver["_id"])
    trip_query = driver_related_query(driver_id)
    trips = list(
        trips_collection.find(trip_query)
        .sort([("completedAt", -1), ("createdAt", -1)])
        .limit(5)
    )
    all_trips = list(trips_collection.find(trip_query))

    total_distance = 0
    total_active_seconds = 0
    completed_trip_count = 0
    for trip in all_trips:
        trip_status = str(trip.get("status") or "completed").strip().lower()
        if trip_status in {"active", "paused"}:
            continue

        completed_trip_count += 1
        distance_value = trip.get("distanceKm", trip.get("distance", 0)) or 0
        try:
            total_distance += float(distance_value)
        except (TypeError, ValueError):
            pass

        duration_seconds = trip.get(
            "activeDurationSeconds",
            trip.get("durationSeconds"),
        )
        duration_minutes = trip.get("durationMinutes")
        if duration_seconds is not None:
            total_active_seconds += int(duration_seconds or 0)
        elif duration_minutes is not None:
            total_active_seconds += int(duration_minutes or 0) * 60

    unread_notifications = notifications_collection.count_documents(
        {
            **driver_related_query(driver_id),
            "read": {"$ne": True},
        }
    )
    shift = build_shift_payload(driver_id)
    active_seconds = max(total_active_seconds, shift["activeSeconds"])

    return {
        "driver": serialize_driver(driver),
        "vehicle": {
            "number": driver.get("vehicleRegistrationNumber", ""),
            "route": driver.get("busRouteNumber", ""),
            "depotOperator": driver.get("depotOperator", ""),
            "serviceStatus": (
                "In Service"
                if str(driver.get("verificationStatus") or "").lower()
                in {"approved", "verified"}
                else "Pending Approval"
            ),
        },
        "shift": shift,
        "tracking": build_tracking_payload(driver),
        "stats": {
            "totalTrips": completed_trip_count,
            "totalDistanceKm": round(total_distance, 1),
            "activeSeconds": active_seconds,
            "activeHoursLabel": format_duration(active_seconds),
            "notifications": unread_notifications,
        },
        "recentTrips": [serialize_trip(trip) for trip in trips],
    }


def serialize_notification(notification):
    created_at = notification.get("createdAt")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()

    return {
        "id": str(notification.get("_id") or ""),
        "title": str(notification.get("title") or "Notification")[:200],
        "message": str(notification.get("message") or "")[:2000],
        "type": str(
            notification.get("type")
            or notification.get("category")
            or "general"
        )[:80],
        "read": bool(notification.get("read", False)),
        "createdAt": str(created_at or ""),
    }


@auth_bp.route("/api/driver/register/check-availability", methods=["POST"])
def driver_register_check_availability():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    conflicts = get_registration_conflicts(
        mobile=data.get("mobile"),
        email=data.get("email"),
        nic=data.get("nic"),
        driver_ntc_registration_number=data.get(
            "driverNtcRegistrationNumber"
        ),
        driving_license_number=data.get("drivingLicenseNumber"),
    )

    return jsonify({
        "available": not conflicts,
        "conflicts": conflicts,
    })


@auth_bp.route("/api/driver/register/request-otp", methods=["POST"])
def driver_register_request_otp():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    unsupported_fields = sorted(
        field
        for field in LEGACY_OPERATIONAL_REGISTRATION_FIELDS
        if field in data
    )
    if unsupported_fields:
        return jsonify({
            "error": (
                "Route, bus, permit, and conductor details are assigned "
                "operationally and cannot be submitted during driver registration"
            ),
            "code": "UNSUPPORTED_REGISTRATION_FIELDS",
            "fields": unsupported_fields,
        }), 400

    required_field_names = (
        "fullName",
        "nic",
        "mobile",
        "email",
        "password",
        "driverNtcRegistrationNumber",
        "drivingLicenseNumber",
        "drivingLicenseExpiry",
    )

    missing_fields = [
        field
        for field in required_field_names
        if field not in data
        or not isinstance(data.get(field), str)
        or not data.get(field).strip()
    ]
    if missing_fields:
        return jsonify({
            "error": "Required registration fields are missing or invalid",
            "fieldErrors": {
                field: "This field is required"
                for field in missing_fields
            },
        }), 400

    depot_operator_value = data.get("depotOperator", "")
    if depot_operator_value is None:
        depot_operator_value = ""
    if not isinstance(depot_operator_value, str):
        return jsonify({
            "error": "Operator or depot name must be text",
            "fieldErrors": {
                "depotOperator": "Operator or depot name must be text",
            },
        }), 400

    full_name = data["fullName"].strip()
    mobile = normalize_mobile(data["mobile"])
    email = data["email"].strip().lower()
    nic = data["nic"].strip().upper()
    password = data["password"]
    driver_ntc_registration_number = (
        data["driverNtcRegistrationNumber"].strip().upper()
    )
    driving_license_number = (
        data["drivingLicenseNumber"].strip().upper()
    )
    driving_license_expiry = data["drivingLicenseExpiry"].strip()
    depot_operator = depot_operator_value.strip()
    documents = data.get("documents") or {}

    documents, document_error = sanitize_registration_documents(
        documents,
        mobile,
    )
    if document_error:
        return jsonify({"error": document_error}), 400

    validation_errors = {
        **validate_registration_identity(
            mobile,
            email,
            nic,
            password,
        ),
        **validate_registration_profile(
            full_name,
            driver_ntc_registration_number,
            driving_license_number,
            depot_operator,
        ),
    }
    if validation_errors:
        return jsonify({
            "error": next(iter(validation_errors.values())),
            "fieldErrors": validation_errors,
        }), 400

    if not is_today_or_future_date(driving_license_expiry):
        return jsonify({
            "error": "Driving license expiry cannot be a past date",
            "fieldErrors": {
                "drivingLicenseExpiry": (
                    "Driving license expiry cannot be a past date"
                ),
            },
        }), 400

    conflicts = get_registration_conflicts(
        mobile=mobile,
        email=email,
        nic=nic,
        driver_ntc_registration_number=driver_ntc_registration_number,
        driving_license_number=driving_license_number,
    )
    if conflicts:
        return jsonify({
            "error": next(iter(conflicts.values())),
            "conflicts": conflicts,
        }), 409

    cooldown_response = otp_request_cooldown(mobile, "register")
    if cooldown_response:
        return cooldown_response

    hashed_password = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    registration_data = {
        "fullName": full_name,
        "nic": nic,
        "email": email,
        "password": hashed_password,
        "driverNtcRegistrationNumber": driver_ntc_registration_number,
        "drivingLicenseNumber": driving_license_number,
        "drivingLicenseExpiry": driving_license_expiry,
        "documents": documents,
    }
    if depot_operator:
        registration_data["depotOperator"] = depot_operator

    otp = generate_otp()
    reservation, reservation_error = reserve_otp_record(
        mobile,
        "register",
        otp,
        registration_data,
    )
    if reservation_error:
        return reservation_error

    sms_result = send_sms(
        mobile,
        f"Your Gamana.lk verification code is {otp}. Valid for 5 minutes.",
    )
    if not sms_result.get("ok"):
        otp_collection.delete_one({
            "_id": reservation.get("_id"),
            "otpHash": reservation.get("otpHash"),
        })
        return jsonify({
            "error": "The verification SMS could not be sent. Please retry.",
        }), 502

    return jsonify({"status": "OTP sent", "mobile": mobile})


@auth_bp.route(
    "/api/driver/register/verify-otp",
    methods=["POST"],
)
def driver_register_verify_otp():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    mobile = normalize_mobile(data.get("mobile", ""))
    otp = str(data.get("otp", "")).strip()

    if not re.fullmatch(r"947\d{8}", mobile):
        return jsonify({"error": "Enter a valid Sri Lankan mobile number"}), 400

    record, otp_error = consume_otp_record(mobile, "register", otp)
    if otp_error:
        return otp_error

    reg_data = record.get("registration_data", {})
    if not isinstance(reg_data, dict):
        return jsonify({
            "error": "Registration data is unavailable; start again",
            "code": "REGISTRATION_DATA_INVALID",
        }), 409

    conflicts = get_registration_conflicts(
        mobile=mobile,
        email=reg_data.get("email"),
        nic=reg_data.get("nic"),
        driver_ntc_registration_number=reg_data.get(
            "driverNtcRegistrationNumber"
        ),
        driving_license_number=reg_data.get("drivingLicenseNumber"),
    )

    if conflicts:
        return jsonify({
            "error": next(iter(conflicts.values())),
            "conflicts": conflicts,
        }), 409

    now = datetime.now(timezone.utc)
    driver = {
        "fullName": reg_data.get("fullName", record.get("name", "")),
        "nic": reg_data.get("nic", ""),
        "nicKey": str(reg_data.get("nic", "")).strip().upper(),
        "mobile": mobile,
        "mobileKey": mobile,
        "email": reg_data.get("email", ""),
        "emailKey": str(reg_data.get("email", "")).strip().casefold(),
        "password": reg_data.get("password", ""),
        "driverNtcRegistrationNumber": reg_data.get(
            "driverNtcRegistrationNumber",
            "",
        ),
        "driverNtcRegistrationNumberKey": str(
            reg_data.get("driverNtcRegistrationNumber", "")
        ).strip().upper(),
        "drivingLicenseNumber": reg_data.get(
            "drivingLicenseNumber",
            "",
        ),
        "drivingLicenseNumberKey": str(
            reg_data.get("drivingLicenseNumber", "")
        ).strip().upper(),
        "drivingLicenseExpiry": reg_data.get(
            "drivingLicenseExpiry",
            "",
        ),
        "documents": reg_data.get("documents", {}),
        "verificationStatus": "pending",
        "kycRevision": 0,
        "kycStatus": (
            "SUBMITTED"
            if registration_documents_complete(reg_data.get("documents", {}))
            else "NOT_SUBMITTED"
        ),
        "createdAt": now,
        "updatedAt": now,
    }

    depot_operator = str(reg_data.get("depotOperator") or "").strip()
    if depot_operator:
        driver["depotOperator"] = depot_operator

    try:
        result = drivers_collection.insert_one(driver)
    except DuplicateKeyError as error:
        duplicate_details = str(getattr(error, "details", "") or error)
        duplicate_map = {
            "unique_new_mobile_identity": (
                "mobile",
                "This mobile number is already registered",
            ),
            "unique_new_email_identity": (
                "email",
                "This email is already registered",
            ),
            "unique_new_nic_identity": (
                "nic",
                "This NIC is already registered",
            ),
            "unique_new_driver_ntc_identity": (
                "driverNtcRegistrationNumber",
                "This driver NTC registration number is already registered",
            ),
            "unique_new_driving_license_identity": (
                "drivingLicenseNumber",
                "This driving license number is already registered",
            ),
        }
        index_name = next(
            (
                name
                for name in duplicate_map
                if name in duplicate_details
            ),
            "",
        )
        field, message = duplicate_map.get(
            index_name,
            (
                "registration",
                "Registration details conflict with an existing driver",
            ),
        )
        return jsonify({
            "error": message,
            "conflicts": {field: message},
        }), 409

    driver_id = str(result.inserted_id)
    access_token = create_access_token(
        subject=driver_id,
        role="driver",
        expires_hours=DRIVER_ACCESS_TOKEN_HOURS,
    )

    return jsonify({
        "status": "Registered successfully",
        "driver_id": driver_id,
        "fullName": driver["fullName"],
        "mobile": mobile,
        "verificationStatus": "pending",
        "accessToken": access_token,
        "tokenType": "Bearer",
        "expiresInSeconds": DRIVER_ACCESS_TOKEN_SECONDS,
    })


@auth_bp.route("/api/driver/login/request-otp", methods=["POST"])
def driver_login_request_otp():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400
    mobile = normalize_mobile(data.get("mobile", ""))

    if not re.fullmatch(r"947\d{8}", mobile):
        return jsonify({"error": "Enter a valid Sri Lankan mobile number"}), 400

    driver = find_driver_by_mobile(mobile)
    if not driver:
        # Keep account existence private while avoiding an SMS for unknown users.
        return jsonify({
            "status": "If an account exists, an OTP has been sent",
            "mobile": mobile,
        })

    cooldown_response = otp_request_cooldown(mobile, "login")
    if cooldown_response:
        return cooldown_response

    otp = generate_otp()
    reservation, reservation_error = reserve_otp_record(
        mobile,
        "login",
        otp,
    )
    if reservation_error:
        return reservation_error

    sms_result = send_sms(
        mobile, f"Your Gamana.lk login code is {otp}. Valid for 5 minutes."
    )
    if not sms_result.get("ok"):
        otp_collection.delete_one({
            "_id": reservation.get("_id"),
            "otpHash": reservation.get("otpHash"),
        })
        return jsonify({
            "error": "The login SMS could not be sent. Please retry.",
        }), 502

    return jsonify({"status": "OTP sent", "mobile": mobile})


@auth_bp.route(
    "/api/driver/login/verify-otp",
    methods=["POST"],
)
def driver_login_verify_otp():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    mobile = normalize_mobile(data.get("mobile", ""))
    otp = str(data.get("otp", "")).strip()

    if not re.fullmatch(r"947\d{8}", mobile):
        return jsonify({"error": "Enter a valid Sri Lankan mobile number"}), 400

    record, otp_error = consume_otp_record(mobile, "login", otp)
    if otp_error:
        return otp_error

    driver = find_driver_by_mobile(mobile)

    if not driver:
        return jsonify({
            "error": "Driver account was not found"
        }), 404

    driver_id = str(driver["_id"])

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    response = {
        "status": "Login successful",
        "driver_id": driver_id,
        "fullName": driver.get(
            "fullName",
            driver.get("name", ""),
        ),
        "mobile": mobile,
        "verificationStatus": verification_status,
    }

    if verification_status != "blocked":
        response.update({
            "accessToken": create_access_token(
                subject=driver_id,
                role="driver",
                expires_hours=DRIVER_ACCESS_TOKEN_HOURS,
            ),
            "tokenType": "Bearer",
            "expiresInSeconds": DRIVER_ACCESS_TOKEN_SECONDS,
        })

    return jsonify(response)


@auth_bp.route(
    "/api/driver/<driver_id>/home",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
@subject_matches_route_param("driver_id")
def get_driver_home(driver_id):
    if not ObjectId.is_valid(driver_id):
        return jsonify({
            "error": "Invalid driver id"
        }), 400

    driver = drivers_collection.find_one({
        "_id": ObjectId(driver_id)
    })

    if not driver:
        return jsonify({
            "error": "Driver not found"
        }), 404

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    if verification_status not in {
        "approved",
        "verified",
    }:
        return jsonify({
            "error": (
                "Driver account has not been approved"
            ),
            "code": "DRIVER_NOT_APPROVED",
            "verificationStatus": verification_status,
        }), 403

    return jsonify(
        build_driver_home_payload(driver)
    )


@auth_bp.route(
    "/api/driver/notifications",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
def get_driver_notifications():
    driver_id = str(getattr(g, "auth", {}).get("sub", ""))
    if not ObjectId.is_valid(driver_id):
        return jsonify({"error": "Invalid authenticated driver"}), 401

    if not drivers_collection.find_one(
        {"_id": ObjectId(driver_id)},
        {"_id": 1},
    ):
        return jsonify({"error": "Driver not found"}), 404

    raw_limit = request.args.get("limit", "50")
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        limit = 0

    if not 1 <= limit <= 100:
        return jsonify({
            "error": "limit must be an integer between 1 and 100",
        }), 400

    notifications = list(
        notifications_collection.find(
            driver_related_query(driver_id),
            {
                "title": 1,
                "message": 1,
                "type": 1,
                "category": 1,
                "read": 1,
                "createdAt": 1,
            },
        )
        .sort([("createdAt", -1), ("_id", -1)])
        .limit(limit)
    )

    return jsonify({
        "status": "success",
        "notifications": [
            serialize_notification(notification)
            for notification in notifications
        ],
    })


@auth_bp.route(
    "/api/driver/<driver_id>",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
@subject_matches_route_param("driver_id")
def get_driver_profile(driver_id):
    if not ObjectId.is_valid(driver_id):
        return jsonify({
            "error": "Invalid driver id"
        }), 400

    driver = drivers_collection.find_one({
        "_id": ObjectId(driver_id)
    })

    if not driver:
        return jsonify({
            "error": "Driver not found"
        }), 404

    return jsonify(
        serialize_driver(driver)
    )

@auth_bp.route(
    "/api/driver/<driver_id>/status",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
@subject_matches_route_param("driver_id")
def get_driver_status(driver_id):
    if not ObjectId.is_valid(driver_id):
        return jsonify({
            "error": "Invalid driver id"
        }), 400

    driver = drivers_collection.find_one({
        "_id": ObjectId(driver_id)
    })

    if not driver:
        return jsonify({
            "error": "Driver not found"
        }), 404

    verification_status = str(
        driver.get("verificationStatus", "pending")
    ).strip().lower()

    allowed_statuses = {
        "pending",
        "approved",
        "verified",
        "blocked",
        "rejected",
        "unverified",
        "under_review",
    }

    if verification_status not in allowed_statuses:
        verification_status = "pending"

    return jsonify({
        "driver_id": driver_id,
        "_id": driver_id,
        "fullName": driver.get(
            "fullName",
            driver.get("name", ""),
        ),
        "mobile": driver.get("mobile", ""),
        "verificationStatus": verification_status,
        "status": verification_status,
        "kycStatus": driver.get(
            "kycStatus",
            "NOT_SUBMITTED",
        ),
        "rejectionReason": driver.get("rejectionReason", ""),
        "blockReason": driver.get("blockReason", ""),
    })
