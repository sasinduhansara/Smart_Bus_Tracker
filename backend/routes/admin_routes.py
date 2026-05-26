from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from functools import wraps
import jwt
import os

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")
SECRET_KEY = os.getenv("ADMIN_JWT_SECRET", "admin-secret-gamana-2024")


def get_driver_collection():
    return current_app.mongo.db.drivers


def get_admin_collection():
    return current_app.mongo.db.admins


# ─── Admin Auth Decorator ─────────────────────────────────────────
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "message": "Access denied. No token provided."}), 401

        try:
            token = auth_header.split(" ")[1]
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.admin = decoded
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "message": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "message": "Invalid token"}), 401

    return decorated


# ─── Admin Login ──────────────────────────────────────────────────
@admin_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email = data.get("email", "").lower().strip()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"success": False, "message": "Email and password are required"}), 400

        admin = get_admin_collection().find_one({"email": email})
        if not admin:
            return jsonify({"success": False, "message": "Invalid credentials"}), 401

        from werkzeug.security import check_password_hash
        stored_password = admin.get("password", "")
        if isinstance(stored_password, bytes):
            stored_password = stored_password.decode("utf-8")

        if not check_password_hash(stored_password, password):
            return jsonify({"success": False, "message": "Invalid credentials"}), 401

        token = jwt.encode(
            {
                "id": str(admin["_id"]),
                "email": admin["email"],
                "role": "admin",
                "exp": datetime.utcnow() + timedelta(hours=24)
            },
            SECRET_KEY,
            algorithm="HS256"
        )

        return jsonify({
            "success": True,
            "message": "Login successful",
            "data": {
                "token": token,
                "admin": {
                    "name": admin.get("name", "Admin"),
                    "email": admin["email"],
                    "role": admin.get("role", "Fleet Manager")
                }
            }
        })

    except Exception as e:
        print(f"❌ Admin Login Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── List Drivers (with filtering, search, pagination) ────────────
@admin_bp.route("/drivers", methods=["GET"])
@admin_required
def list_drivers():
    try:
        status_filter = request.args.get("status", "all")
        search = request.args.get("search", "")
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))

        query = {}
        if status_filter and status_filter != "all":
            query["status"] = status_filter

        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"fullName": search_regex},
                {"licenseNumber": search_regex},
                {"phone": search_regex},
                {"employee_id": search_regex}
            ]

        skip = (page - 1) * limit
        total = get_driver_collection().count_documents(query)
        drivers = list(get_driver_collection().find(
            query,
            {"password": 0}
        ).sort("created_at", -1).skip(skip).limit(limit))

        for d in drivers:
            d["_id"] = str(d["_id"])
            d["id"] = d["_id"]
            if "created_at" in d and d["created_at"]:
                d["created_at"] = d["created_at"].isoformat()
            if "updated_at" in d and d["updated_at"]:
                d["updated_at"] = d["updated_at"].isoformat()

        total_pages = (total + limit - 1) // limit

        return jsonify({
            "success": True,
            "data": {
                "drivers": drivers,
                "pagination": {
                    "total": total,
                    "page": page,
                    "limit": limit,
                    "totalPages": total_pages
                }
            }
        })

    except Exception as e:
        print(f"❌ List Drivers Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Get Driver Stats ─────────────────────────────────────────────
@admin_bp.route("/drivers/stats", methods=["GET"])
@admin_required
def get_stats():
    try:
        total = get_driver_collection().count_documents({})
        pending = get_driver_collection().count_documents({"status": "pending"})
        approved = get_driver_collection().count_documents({"status": "approved"})
        rejected = get_driver_collection().count_documents({"status": "rejected"})

        return jsonify({
            "success": True,
            "data": {
                "total": total,
                "pending": pending,
                "approved": approved,
                "rejected": rejected
            }
        })

    except Exception as e:
        print(f"❌ Stats Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Get Single Driver ────────────────────────────────────────────
@admin_bp.route("/drivers/<driver_id>", methods=["GET"])
@admin_required
def get_driver(driver_id):
    try:
        driver = get_driver_collection().find_one(
            {"_id": ObjectId(driver_id)},
            {"password": 0}
        )
        if not driver:
            return jsonify({"success": False, "message": "Driver not found"}), 404

        driver["_id"] = str(driver["_id"])
        driver["id"] = driver["_id"]
        if "created_at" in driver and driver["created_at"]:
            driver["created_at"] = driver["created_at"].isoformat()
        if "updated_at" in driver and driver["updated_at"]:
            driver["updated_at"] = driver["updated_at"].isoformat()

        return jsonify({"success": True, "data": driver})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Update Driver Status (Approve/Reject) ───────────────────────
@admin_bp.route("/drivers/<driver_id>/status", methods=["PUT"])
@admin_required
def update_driver_status(driver_id):
    try:
        data = request.json
        new_status = data.get("status")

        if new_status not in ["approved", "rejected"]:
            return jsonify({"success": False, "message": "Status must be 'approved' or 'rejected'"}), 400

        driver = get_driver_collection().find_one({"_id": ObjectId(driver_id)})
        if not driver:
            return jsonify({"success": False, "message": "Driver not found"}), 404

        update = {
            "status": new_status,
            "updated_at": datetime.utcnow()
        }

        if new_status == "approved":
            employee_id = data.get("employeeId", "").strip().upper()
            password = data.get("password", "")

            if not employee_id or not password:
                return jsonify({"success": False, "message": "Employee ID and password are required for approval"}), 400

            existing = get_driver_collection().find_one({
                "employee_id": employee_id,
                "_id": {"$ne": ObjectId(driver_id)}
            })
            if existing:
                return jsonify({"success": False, "message": "Employee ID already assigned to another driver"}), 400

            update["employee_id"] = employee_id
            update["password"] = generate_password_hash(password)

        get_driver_collection().update_one(
            {"_id": ObjectId(driver_id)},
            {"$set": update}
        )

        action = "approved" if new_status == "approved" else "rejected"
        return jsonify({
            "success": True,
            "message": f"Driver {driver['fullName']} has been {action}"
        })

    except Exception as e:
        print(f"❌ Update Status Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Delete Driver ────────────────────────────────────────────────
@admin_bp.route("/drivers/<driver_id>", methods=["DELETE"])
@admin_required
def delete_driver(driver_id):
    try:
        driver = get_driver_collection().find_one({"_id": ObjectId(driver_id)})
        if not driver:
            return jsonify({"success": False, "message": "Driver not found"}), 404

        get_driver_collection().delete_one({"_id": ObjectId(driver_id)})

        return jsonify({
            "success": True,
            "message": f"Driver {driver['fullName']} has been removed"
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Admin Create Driver (Invitation-Based) ──────────────────────
@admin_bp.route("/drivers/create", methods=["POST"])
@admin_required
def create_driver():
    try:
        data = request.json
        full_name = data.get("fullName", "").strip()
        nic = data.get("nic", "").strip().upper()
        phone = data.get("phone", "").strip()
        license_number = data.get("licenseNumber", "").strip().upper()
        bus_number = data.get("busNumber", "").strip().upper()
        route_number = data.get("routeNumber", "").strip()
        employer = data.get("employer", "").strip()
        experience = data.get("experience", "").strip()
        photo = data.get("photo", "")

        if not all([full_name, nic, phone, license_number, bus_number, route_number]):
            return jsonify({"success": False, "message": "Required fields: fullName, nic, phone, licenseNumber, busNumber, routeNumber"}), 400

        existing_nic = get_driver_collection().find_one({"nic": nic})
        if existing_nic:
            return jsonify({"success": False, "message": f"NIC '{nic}' is already registered"}), 400

        existing_license = get_driver_collection().find_one({"licenseNumber": license_number})
        if existing_license:
            return jsonify({"success": False, "message": f"License '{license_number}' is already registered"}), 400

        bus = current_app.mongo.db.buses.find_one({"busNumber": bus_number})
        if not bus:
            return jsonify({"success": False, "message": f"Bus '{bus_number}' not found in system"}), 400
        if bus.get("status") == "inactive":
            return jsonify({"success": False, "message": f"Bus '{bus_number}' is inactive"}), 400

        route = current_app.mongo.db.routes.find_one({"routeNumber": route_number})
        if not route:
            return jsonify({"success": False, "message": f"Route '{route_number}' not found"}), 400

        count = get_driver_collection().count_documents({})
        employee_id = f"DRV-{count + 1:04d}"
        temp_password = f"{phone[-4:]}{nic[-4:]}"

        driver_doc = {
            "fullName": full_name, "employee_id": employee_id, "nic": nic,
            "phone": phone, "licenseNumber": license_number, "experience": experience,
            "bus_number": bus_number, "route_number": route_number, "employer": employer,
            "photo": photo, "password": generate_password_hash(temp_password),
            "status": "approved", "created_by": request.admin.get("email", "admin"),
            "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()
        }

        result = get_driver_collection().insert_one(driver_doc)

        return jsonify({
            "success": True,
            "message": f"Driver '{full_name}' created successfully with Employee ID: {employee_id}",
            "data": {
                "id": str(result.inserted_id), "employeeId": employee_id,
                "fullName": full_name, "busNumber": bus_number, "routeNumber": route_number,
                "temporaryPassword": temp_password, "status": "approved"
            }
        }), 201

    except Exception as e:
        print(f"❌ Create Driver Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Update Driver Bus/Route Assignment ────────────────────────────
@admin_bp.route("/drivers/<driver_id>/assign", methods=["PUT"])
@admin_required
def update_driver_assignment(driver_id):
    try:
        data = request.json
        bus_number = data.get("busNumber", "").strip().upper()
        route_number = data.get("routeNumber", "").strip()

        driver = get_driver_collection().find_one({"_id": ObjectId(driver_id)})
        if not driver:
            return jsonify({"success": False, "message": "Driver not found"}), 404

        update = {"updated_at": datetime.utcnow()}

        if bus_number:
            bus = current_app.mongo.db.buses.find_one({"busNumber": bus_number})
            if not bus:
                return jsonify({"success": False, "message": f"Bus '{bus_number}' not found"}), 400
            update["bus_number"] = bus_number

        if route_number:
            route = current_app.mongo.db.routes.find_one({"routeNumber": route_number})
            if not route:
                return jsonify({"success": False, "message": f"Route '{route_number}' not found"}), 400
            update["route_number"] = route_number

        get_driver_collection().update_one(
            {"_id": ObjectId(driver_id)},
            {"$set": update}
        )

        return jsonify({
            "success": True,
            "message": f"Driver {driver['fullName']}'s assignment updated",
            "data": {
                "busNumber": update.get("bus_number", driver.get("bus_number", "")),
                "routeNumber": update.get("route_number", driver.get("route_number", ""))
            }
        })

    except Exception as e:
        print(f"❌ Update Assignment Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── List Buses (for dropdown) ────────────────────────────────────
@admin_bp.route("/buses", methods=["GET"])
@admin_required
def list_buses():
    try:
        status_filter = request.args.get("status", "all")
        query = {}
        if status_filter and status_filter != "all":
            query["status"] = status_filter

        buses = list(current_app.mongo.db.buses.find(query).sort("busNumber", 1))
        for b in buses:
            b["_id"] = str(b["_id"])
            b["id"] = b["_id"]

        return jsonify({"success": True, "data": {"buses": buses}})

    except Exception as e:
        print(f"❌ List Buses Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── List Routes (for dropdown) ───────────────────────────────────
@admin_bp.route("/routes", methods=["GET"])
@admin_required
def list_routes():
    try:
        routes = list(current_app.mongo.db.routes.find({}).sort("routeNumber", 1))
        for r in routes:
            r["_id"] = str(r["_id"])
            r["id"] = r["_id"]

        return jsonify({"success": True, "data": {"routes": routes}})

    except Exception as e:
        print(f"❌ List Routes Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════
#  BUS PRE-REGISTRATION ENDPOINTS
#  Admin pre-registers a bus with (Bus#, Route#, Phone, NIC/License)
#  Driver uses this to self-register with OTP + ID scan
# ═══════════════════════════════════════════════════════════════════

def get_bus_registration_collection():
    return current_app.mongo.db.bus_registrations


@admin_bp.route("/bus-registrations", methods=["GET"])
@admin_required
def list_bus_registrations():
    try:
        status_filter = request.args.get("status", "all")
        search = request.args.get("search", "")
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))

        query = {}
        if status_filter and status_filter != "all":
            query["status"] = status_filter
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"busNumber": search_regex}, {"routeNumber": search_regex},
                {"phone": search_regex}, {"nic": search_regex},
                {"licenseNumber": search_regex}, {"fullName": search_regex}
            ]

        skip = (page - 1) * limit
        total = get_bus_registration_collection().count_documents(query)
        registrations = list(get_bus_registration_collection().find(query).sort("created_at", -1).skip(skip).limit(limit))

        for r in registrations:
            r["_id"] = str(r["_id"])
            r["id"] = r["_id"]
            if "created_at" in r and r["created_at"]:
                r["created_at"] = r["created_at"].isoformat()
            if "updated_at" in r and r["updated_at"]:
                r["updated_at"] = r["updated_at"].isoformat()

        total_pages = (total + limit - 1) // limit
        return jsonify({"success": True, "data": {"registrations": registrations, "pagination": {"total": total, "page": page, "limit": limit, "totalPages": total_pages}}})
    except Exception as e:
        print(f"❌ List Bus Registrations Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/bus-registrations/create", methods=["POST"])
@admin_required
def create_bus_registration():
    try:
        data = request.json
        bus_number = data.get("busNumber", "").strip().upper()
        route_number = data.get("routeNumber", "").strip().upper()
        phone = data.get("phone", "").strip()
        nic = data.get("nic", "").strip().upper()
        license_number = data.get("licenseNumber", "").strip().upper()
        full_name = data.get("fullName", "").strip()

        if not bus_number:
            return jsonify({"success": False, "message": "Bus Number is required"}), 400
        if not route_number:
            return jsonify({"success": False, "message": "Route Number is required"}), 400
        if not phone:
            return jsonify({"success": False, "message": "Phone Number is required"}), 400
        if not nic and not license_number:
            return jsonify({"success": False, "message": "NIC or Driving License Number is required"}), 400

        existing = get_bus_registration_collection().find_one({"busNumber": bus_number, "status": "pending"})
        if existing:
            return jsonify({"success": False, "message": f"Bus '{bus_number}' already has a pending registration"}), 400
        if nic:
            existing_nic = get_bus_registration_collection().find_one({"nic": nic, "status": "pending"})
            if existing_nic:
                return jsonify({"success": False, "message": f"NIC '{nic}' already has a pending registration"}), 400
        if license_number:
            existing_lic = get_bus_registration_collection().find_one({"licenseNumber": license_number, "status": "pending"})
            if existing_lic:
                return jsonify({"success": False, "message": f"License '{license_number}' already has a pending registration"}), 400

        reg_doc = {
            "busNumber": bus_number, "routeNumber": route_number, "phone": phone,
            "nic": nic, "licenseNumber": license_number, "fullName": full_name,
            "status": "pending", "created_by": request.admin.get("email", "admin"),
            "admin_id": request.admin.get("id", ""), "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()
        }
        result = get_bus_registration_collection().insert_one(reg_doc)
        return jsonify({"success": True, "message": f"Bus '{bus_number}' pre-registered successfully", "data": {"id": str(result.inserted_id), "busNumber": bus_number, "routeNumber": route_number, "phone": phone, "nic": nic, "licenseNumber": license_number, "fullName": full_name, "status": "pending"}}), 201
    except Exception as e:
        print(f"❌ Create Bus Registration Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/bus-registrations/<reg_id>", methods=["DELETE"])
@admin_required
def delete_bus_registration(reg_id):
    try:
        reg = get_bus_registration_collection().find_one({"_id": ObjectId(reg_id)})
        if not reg:
            return jsonify({"success": False, "message": "Registration not found"}), 404
        if reg.get("status") == "completed":
            return jsonify({"success": False, "message": "Cannot delete completed registration"}), 400
        get_bus_registration_collection().delete_one({"_id": ObjectId(reg_id)})
        return jsonify({"success": True, "message": "Registration deleted"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/bus-registrations/stats", methods=["GET"])
@admin_required
def get_bus_registration_stats():
    try:
        total = get_bus_registration_collection().count_documents({})
        pending = get_bus_registration_collection().count_documents({"status": "pending"})
        completed = get_bus_registration_collection().count_documents({"status": "completed"})
        return jsonify({"success": True, "data": {"total": total, "pending": pending, "completed": completed}})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Seed Test Drivers ────────────────────────────────────────────
@admin_bp.route("/seed", methods=["POST"])
@admin_required
def seed_drivers():
    try:
        password_hash = generate_password_hash("driver123")

        test_drivers = [
            {"fullName": "Supun Perera", "phone": "+94771234567", "licenseNumber": "B-12345", "experience": "5 years", "status": "pending"},
            {"fullName": "Kamal Fernando", "phone": "+94772345678", "licenseNumber": "B-23456", "experience": "8 years", "status": "pending"},
            {"fullName": "Nimal Silva", "phone": "+94773456789", "licenseNumber": "B-34567", "experience": "3 years", "status": "approved", "employee_id": "DRV-001", "password": password_hash},
            {"fullName": "Priya Jayawardena", "phone": "+94774567890", "licenseNumber": "B-45678", "experience": "6 years", "status": "rejected"},
            {"fullName": "Rohan de Silva", "phone": "+94775678901", "licenseNumber": "B-56789", "experience": "10 years", "status": "pending"},
            {"fullName": "Dinesh Kumar", "phone": "+94776789012", "licenseNumber": "B-67890", "experience": "4 years", "status": "pending"},
            {"fullName": "Samantha Rathnayake", "phone": "+94777890123", "licenseNumber": "B-78901", "experience": "7 years", "status": "pending"},
        ]

        for d in test_drivers:
            d["created_at"] = datetime.utcnow()
            d["updated_at"] = datetime.utcnow()
            if "password" not in d:
                d["password"] = ""
            if "employee_id" not in d:
                d["employee_id"] = ""

        get_driver_collection().delete_many({})
        get_driver_collection().insert_many(test_drivers)

        return jsonify({
            "success": True,
            "message": "Test drivers seeded successfully"
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
