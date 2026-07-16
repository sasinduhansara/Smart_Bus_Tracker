from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import re
import bcrypt
from bson.objectid import ObjectId
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
from utils.auth_utils import (
    create_access_token,
    jwt_required,
    roles_required,
    subject_matches_route_param,
)

auth_bp = Blueprint("auth_bp", __name__)

DRIVER_ACCESS_TOKEN_HOURS = 24 * 30
DRIVER_ACCESS_TOKEN_SECONDS = DRIVER_ACCESS_TOKEN_HOURS * 60 * 60


def to_iso(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value or ""


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


def get_registration_conflicts(mobile=None, email=None, nic=None):
    conflicts = {}

    if mobile:
        normalized_mobile = normalize_mobile(mobile)
        if drivers_collection.find_one({"mobile": normalized_mobile}):
            conflicts["mobile"] = "This mobile number is already registered"

    if email:
        email = email.strip()
        if drivers_collection.find_one(exact_case_insensitive_query("email", email)):
            conflicts["email"] = "This email is already registered"

    if nic:
        nic = nic.strip()
        if drivers_collection.find_one(exact_case_insensitive_query("nic", nic)):
            conflicts["nic"] = "This NIC is already registered"

    return conflicts


def is_today_or_future_date(value):
    try:
        selected_date = datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return False

    return selected_date >= datetime.now().date()


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
    route_number = driver.get("busRouteNumber", "")
    bus_conditions = []
    if vehicle_registration_number:
        bus_conditions.extend([
            {"bus_id": vehicle_registration_number},
            {"vehicleRegistrationNumber": vehicle_registration_number},
        ])
    if route_number:
        bus_conditions.extend([
            {"bus_id": route_number},
            {"route": route_number},
            {"routeNumber": route_number},
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
    return {
        "status": "live",
        "label": "LIVE",
        "message": "GPS Active",
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
    for trip in all_trips:
        distance_value = trip.get("distanceKm", trip.get("distance", 0)) or 0
        try:
            total_distance += float(distance_value)
        except (TypeError, ValueError):
            pass

        duration_seconds = trip.get("durationSeconds")
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
                if driver.get("verificationStatus") == "approved"
                else "Pending Approval"
            ),
        },
        "shift": shift,
        "tracking": build_tracking_payload(driver),
        "stats": {
            "totalTrips": len(all_trips),
            "totalDistanceKm": round(total_distance, 1),
            "activeSeconds": active_seconds,
            "activeHoursLabel": format_duration(active_seconds),
            "notifications": unread_notifications,
        },
        "recentTrips": [serialize_trip(trip) for trip in trips],
    }


@auth_bp.route("/api/driver/register/check-availability", methods=["POST"])
def driver_register_check_availability():
    data = request.get_json() or {}
    conflicts = get_registration_conflicts(
        mobile=data.get("mobile"),
        email=data.get("email"),
        nic=data.get("nic"),
    )

    return jsonify({
        "available": not conflicts,
        "conflicts": conflicts,
    })


@auth_bp.route("/api/driver/register/request-otp", methods=["POST"])
def driver_register_request_otp():
    data = request.get_json() or {}
    full_name = data.get("fullName")
    nic = data.get("nic")
    mobile = data.get("mobile")
    email = data.get("email")
    password = data.get("password")
    conductor_name = data.get("conductorName")
    driver_ntc_registration_number = data.get("driverNtcRegistrationNumber")
    bus_ntc_permit_number = data.get("busNtcPermitNumber")
    driving_license_number = data.get("drivingLicenseNumber")
    driving_license_expiry = data.get("drivingLicenseExpiry")
    bus_route_number = data.get("busRouteNumber")
    vehicle_registration_number = data.get("vehicleRegistrationNumber")
    depot_operator = data.get("depotOperator")
    documents = data.get("documents") or {}
    kyc_status = data.get("kycStatus") or "NOT_SUBMITTED"

    if not all([
        full_name,
        nic,
        mobile,
        email,
        password,
        conductor_name,
        driver_ntc_registration_number,
        bus_ntc_permit_number,
        driving_license_number,
        driving_license_expiry,
        bus_route_number,
        vehicle_registration_number,
        depot_operator,
    ]):
        return jsonify({"error": "All fields are required"}), 400

    mobile = normalize_mobile(mobile)
    email = email.strip()
    nic = nic.strip()

    if not is_today_or_future_date(driving_license_expiry):
        return jsonify({
            "error": "Driving license expiry cannot be a past date",
        }), 400

    conflicts = get_registration_conflicts(mobile=mobile, email=email, nic=nic)
    if conflicts:
        return jsonify({
            "error": next(iter(conflicts.values())),
            "conflicts": conflicts,
        }), 400

    # Hash password before storing temporarily
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    otp = generate_otp()
    expires_at = datetime.now() + timedelta(minutes=5)

    otp_collection.update_one(
        {"mobile": mobile, "purpose": "register"},
        {
            "$set": {
                "otp": otp,
                "expires_at": expires_at,
                "registration_data": {
                    "fullName": full_name,
                    "nic": nic,
                    "email": email,
                    "password": hashed_password,
                    "conductorName": conductor_name,
                    "driverNtcRegistrationNumber": driver_ntc_registration_number,
                    "busNtcPermitNumber": bus_ntc_permit_number,
                    "drivingLicenseNumber": driving_license_number,
                    "drivingLicenseExpiry": driving_license_expiry,
                    "busRouteNumber": bus_route_number,
                    "vehicleRegistrationNumber": vehicle_registration_number,
                    "depotOperator": depot_operator,
                    "documents": documents,
                    "kycStatus": kyc_status,
                },
            }
        },
        upsert=True,
    )

    sms_result = send_sms(
        mobile, f"Your Gamana.lk verification code is {otp}. Valid for 5 minutes."
    )
    return jsonify({"status": "OTP sent", "mobile": mobile, "sms_result": sms_result})


@auth_bp.route(
    "/api/driver/register/verify-otp",
    methods=["POST"],
)
def driver_register_verify_otp():
    data = request.get_json(silent=True) or {}

    mobile = normalize_mobile(data.get("mobile", ""))
    otp = str(data.get("otp", "")).strip()

    record = otp_collection.find_one({
        "mobile": mobile,
        "purpose": "register",
    })

    if not record:
        return jsonify({
            "error": "No OTP request found for this number"
        }), 400

    if datetime.now() > record["expires_at"]:
        otp_collection.delete_one({"_id": record["_id"]})

        return jsonify({
            "error": (
                "OTP has expired, please request a new one"
            )
        }), 400

    if str(record.get("otp", "")) != otp:
        return jsonify({
            "error": "Invalid OTP"
        }), 400

    reg_data = record.get("registration_data", {})

    conflicts = get_registration_conflicts(
        mobile=mobile,
        email=reg_data.get("email"),
        nic=reg_data.get("nic"),
    )

    if conflicts:
        return jsonify({
            "error": next(iter(conflicts.values())),
            "conflicts": conflicts,
        }), 409

    driver = {
        "fullName": reg_data.get(
            "fullName",
            record.get("name", ""),
        ),
        "nic": reg_data.get("nic", ""),
        "mobile": mobile,
        "email": reg_data.get("email", ""),
        "password": reg_data.get("password", ""),
        "conductorName": reg_data.get(
            "conductorName",
            "",
        ),
        "driverNtcRegistrationNumber": reg_data.get(
            "driverNtcRegistrationNumber",
            "",
        ),
        "busNtcPermitNumber": reg_data.get(
            "busNtcPermitNumber",
            "",
        ),
        "drivingLicenseNumber": reg_data.get(
            "drivingLicenseNumber",
            "",
        ),
        "drivingLicenseExpiry": reg_data.get(
            "drivingLicenseExpiry",
            "",
        ),
        "busRouteNumber": reg_data.get(
            "busRouteNumber",
            "",
        ),
        "vehicleRegistrationNumber": reg_data.get(
            "vehicleRegistrationNumber",
            "",
        ),
        "depotOperator": reg_data.get(
            "depotOperator",
            "",
        ),
        "documents": reg_data.get("documents", {}),
        "verificationStatus": "pending",
        "kycStatus": reg_data.get(
            "kycStatus",
            "NOT_SUBMITTED",
        ),
        "createdAt": datetime.now(),
    }

    result = drivers_collection.insert_one(driver)
    driver_id = str(result.inserted_id)

    otp_collection.delete_one({
        "_id": record["_id"]
    })

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
    data = request.get_json()
    mobile = normalize_mobile(data.get("mobile", ""))

    driver = drivers_collection.find_one({"mobile": mobile})
    if not driver:
        return jsonify({"error": "No account found with this mobile number"}), 404

    otp = generate_otp()
    expires_at = datetime.now() + timedelta(minutes=5)

    otp_collection.update_one(
        {"mobile": mobile, "purpose": "login"},
        {"$set": {"otp": otp, "expires_at": expires_at}},
        upsert=True,
    )

    sms_result = send_sms(
        mobile, f"Your Gamana.lk login code is {otp}. Valid for 5 minutes."
    )
    return jsonify({"status": "OTP sent", "mobile": mobile, "sms_result": sms_result})


@auth_bp.route(
    "/api/driver/login/verify-otp",
    methods=["POST"],
)
def driver_login_verify_otp():
    data = request.get_json(silent=True) or {}

    mobile = normalize_mobile(data.get("mobile", ""))
    otp = str(data.get("otp", "")).strip()

    record = otp_collection.find_one({
        "mobile": mobile,
        "purpose": "login",
    })

    if not record:
        return jsonify({
            "error": "No OTP request found for this number"
        }), 400

    if datetime.now() > record["expires_at"]:
        otp_collection.delete_one({"_id": record["_id"]})

        return jsonify({
            "error": (
                "OTP has expired, please request a new one"
            )
        }), 400

    if str(record.get("otp", "")) != otp:
        return jsonify({
            "error": "Invalid OTP"
        }), 400

    driver = drivers_collection.find_one({
        "mobile": mobile
    })

    if not driver:
        otp_collection.delete_one({"_id": record["_id"]})

        return jsonify({
            "error": "Driver account was not found"
        }), 404

    otp_collection.delete_one({
        "_id": record["_id"]
    })

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

    if verification_status not in {
        "blocked",
        "rejected",
    }:
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
            "verificationStatus": verification_status,
        }), 403

    return jsonify(
        build_driver_home_payload(driver)
    )


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
    })
