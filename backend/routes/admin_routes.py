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


# ─── Bus Fleet (from drivers collection) ──────────────────────────
@admin_bp.route("/bus-fleet", methods=["GET"])
@admin_required
def list_bus_fleet():
    try:
        drivers = list(get_driver_collection().find(
            {"bus_number": {"$ne": "", "$exists": True}},
            {"password": 0}
        ).sort("bus_number", 1))

        fleet = []
        for d in drivers:
            fleet.append({
                "id": str(d["_id"]),
                "busNumber": d.get("bus_number", ""),
                "routeNumber": d.get("route_number", ""),
                "driverName": d.get("fullName", ""),
                "driverPhone": d.get("phone", ""),
                "driverNic": d.get("nic", ""),
                "licenseNumber": d.get("licenseNumber", ""),
                "status": d.get("status", "approved"),
                "employeeId": d.get("employee_id", ""),
                "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
                "updated_at": d.get("updated_at").isoformat() if d.get("updated_at") else None,
            })

        total = len(fleet)
        active = sum(1 for f in fleet if f["status"] == "approved")

        return jsonify({
            "success": True,
            "data": {
                "fleet": fleet,
                "stats": {
                    "total": total,
                    "active": active,
                    "inactive": total - active
                }
            }
        })

    except Exception as e:
        print(f"❌ List Bus Fleet Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Update Bus Fleet (driver details) ────────────────────────────
@admin_bp.route("/bus-fleet/<driver_id>", methods=["PUT"])
@admin_required
def update_bus_fleet(driver_id):
    try:
        data = request.json
        driver = get_driver_collection().find_one({"_id": ObjectId(driver_id)})
        if not driver:
            return jsonify({"success": False, "message": "Driver not found"}), 404

        update = {"updated_at": datetime.utcnow()}

        # Fields that can be updated: busNumber, routeNumber, phone, licenseNumber, fullName
        bus_number = data.get("busNumber", "").strip().upper()
        route_number = data.get("routeNumber", "").strip().upper()
        phone = data.get("phone", "").strip()
        license_number = data.get("licenseNumber", "").strip().upper()
        full_name = data.get("fullName", "").strip()

        if bus_number and bus_number != driver.get("bus_number", ""):
            # Check bus not taken by another active driver
            existing = get_driver_collection().find_one({
                "bus_number": bus_number,
                "_id": {"$ne": ObjectId(driver_id)}
            })
            if existing:
                return jsonify({"success": False, "message": f"Bus '{bus_number}' already assigned to driver {existing['fullName']}"}), 400
            update["bus_number"] = bus_number

        if route_number:
            update["route_number"] = route_number

        if phone:
            update["phone"] = phone

        if license_number:
            existing_lic = get_driver_collection().find_one({
                "licenseNumber": license_number,
                "_id": {"$ne": ObjectId(driver_id)}
            })
            if existing_lic:
                return jsonify({"success": False, "message": f"License '{license_number}' already assigned to another driver"}), 400
            update["licenseNumber"] = license_number

        if full_name:
            update["fullName"] = full_name

        get_driver_collection().update_one(
            {"_id": ObjectId(driver_id)},
            {"$set": update}
        )

        return jsonify({
            "success": True,
            "message": f"Fleet entry for '{bus_number or driver.get('bus_number', '')}' updated successfully",
            "data": {
                "id": driver_id,
                "busNumber": update.get("bus_number", driver.get("bus_number", "")),
                "routeNumber": update.get("route_number", driver.get("route_number", "")),
                "driverName": update.get("fullName", driver.get("fullName", "")),
                "driverPhone": update.get("phone", driver.get("phone", "")),
                "licenseNumber": update.get("licenseNumber", driver.get("licenseNumber", "")),
            }
        })

    except Exception as e:
        print(f"❌ Update Bus Fleet Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Delete Bus Fleet Entry ───────────────────────────────────────
@admin_bp.route("/bus-fleet/<driver_id>", methods=["DELETE"])
@admin_required
def delete_bus_fleet(driver_id):
    try:
        driver = get_driver_collection().find_one({"_id": ObjectId(driver_id)})
        if not driver:
            return jsonify({"success": False, "message": "Driver not found"}), 404

        get_driver_collection().delete_one({"_id": ObjectId(driver_id)})

        return jsonify({
            "success": True,
            "message": f"Fleet entry for {driver.get('fullName', 'driver')} has been removed"
        })

    except Exception as e:
        print(f"❌ Delete Bus Fleet Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── List Routes (derived from drivers + bus_registrations) ───────
@admin_bp.route("/routes", methods=["GET"])
@admin_required
def list_routes():
    try:
        # Collect all unique route numbers from drivers
        pipeline = [
            {"$group": {
                "_id": "$route_number",
                "busCount": {"$sum": 1},
                "activeCount": {"$sum": {"$cond": [{"$eq": ["$status", "approved"]}, 1, 0]}},
                "drivers": {"$push": {
                    "name": "$fullName",
                    "bus": "$bus_number",
                    "status": "$status",
                    "employee_id": "$employee_id"
                }}
            }},
            {"$sort": {"_id": 1}}
        ]
        route_groups = list(get_driver_collection().aggregate(pipeline))

        # Also get route numbers from bus_registrations
        reg_routes = set()
        try:
            regs = list(current_app.mongo.db.bus_registrations.find({}, {"routeNumber": 1}))
            for r in regs:
                rn = r.get("routeNumber", "").strip()
                if rn:
                    reg_routes.add(rn)
        except Exception:
            pass

        routes = []
        for g in route_groups:
            rn = g.get("_id", "")
            if not rn:
                continue
            reg_routes.discard(rn)
            routes.append({
                "number": rn,
                "name": f"Route {rn}",
                "type": "Bus Route",
                "start": "Main Terminal",
                "end": "City Center",
                "stops": 0,
                "totalBuses": g.get("busCount", 0),
                "activeBuses": g.get("activeCount", 0),
                "drivers": g.get("drivers", [])
            })

        # Add routes from registrations not yet in drivers
        for rn in reg_routes:
            routes.append({
                "number": rn,
                "name": f"Route {rn}",
                "type": "Registered Route",
                "start": "Pending",
                "end": "Pending",
                "stops": 0,
                "totalBuses": 0,
                "activeBuses": 0,
                "drivers": []
            })

        # Stats
        total_routes = len(routes)
        total_buses = sum(r["totalBuses"] for r in routes)
        total_stops = sum(r["stops"] for r in routes)
        avg_stops = round(total_stops / total_routes) if total_routes > 0 else 0

        return jsonify({
            "success": True,
            "data": {
                "routes": routes,
                "stats": {
                    "totalRoutes": total_routes,
                    "totalBuses": total_buses,
                    "averageStops": avg_stops,
                    "coverage": min(100, total_routes * 4) if total_routes > 0 else 0
                }
            }
        })

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


# ─── Dashboard Stats ────────────────────────────────────────────
@admin_bp.route("/dashboard/stats", methods=["GET"])
@admin_required
def get_dashboard_stats():
    try:
        # Driver stats
        total_drivers = get_driver_collection().count_documents({})
        approved_drivers = get_driver_collection().count_documents({"status": "approved"})
        pending_drivers = get_driver_collection().count_documents({"status": "pending"})
        rejected_drivers = get_driver_collection().count_documents({"status": "rejected"})

        # Active buses (drivers with bus_number and approved)
        active_buses = get_driver_collection().count_documents({
            "bus_number": {"$ne": "", "$exists": True},
            "status": "approved"
        })

        # Fleet data
        fleet_drivers = list(get_driver_collection().find(
            {"bus_number": {"$ne": "", "$exists": True}},
            {"password": 0}
        ))
        fleet_total = len(fleet_drivers)

        # Passenger count
        total_passengers = 0
        try:
            total_passengers = current_app.mongo.db.passengers.count_documents({})
        except Exception:
            pass

        # Bus registrations
        total_registrations = 0
        pending_registrations = 0
        completed_registrations = 0
        try:
            reg_collection = current_app.mongo.db.bus_registrations
            total_registrations = reg_collection.count_documents({})
            pending_registrations = reg_collection.count_documents({"status": "pending"})
            completed_registrations = reg_collection.count_documents({"status": "completed"})
        except Exception:
            pass

        # Unique routes from drivers
        route_numbers = set()
        for d in fleet_drivers:
            rn = d.get("route_number", "")
            if rn:
                route_numbers.add(rn)
        total_routes = len(route_numbers)

        # Recent activity (last 5 registrations)
        recent = list(get_bus_registration_collection().find({}).sort("created_at", -1).limit(5))
        recent_activity = []
        for r in recent:
            recent_activity.append({
                "text": f"Bus {r.get('busNumber', '')} {'completed registration' if r.get('status') == 'completed' else 'pre-registered'} for route {r.get('routeNumber', '')}",
                "time": r.get("created_at").strftime("%Y-%m-%d %H:%M") if r.get("created_at") else "",
                "critical": False
            })

        # Recent driver updates
        recent_drivers = list(get_driver_collection().find(
            {}, {"password": 0}
        ).sort("updated_at", -1).limit(5))
        for d in recent_drivers:
            if d.get("updated_at"):
                action = "approved" if d.get("status") == "approved" else ("rejected" if d.get("status") == "rejected" else "registered")
                recent_activity.append({
                    "text": f"Driver {d.get('fullName', '')} ({d.get('employee_id', 'N/A')}) {action}",
                    "time": d["updated_at"].strftime("%Y-%m-%d %H:%M") if hasattr(d["updated_at"], "strftime") else "",
                    "critical": d.get("status") == "rejected"
                })

        # Sort by time descending and take latest 5
        recent_activity.sort(key=lambda x: x["time"], reverse=True)
        recent_activity = recent_activity[:5]

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "activeBuses": active_buses,
                    "totalFleet": fleet_total,
                    "totalPassengers": total_passengers,
                    "totalRoutes": total_routes,
                    "totalDrivers": total_drivers,
                    "approvedDrivers": approved_drivers,
                    "pendingDrivers": pending_drivers,
                    "rejectedDrivers": rejected_drivers,
                    "pendingRegistrations": pending_registrations,
                    "completedRegistrations": completed_registrations,
                },
                "recentActivity": recent_activity
            }
        })

    except Exception as e:
        print(f"❌ Dashboard Stats Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Alerts & Notifications ──────────────────────────────────────
def get_alerts_collection():
    return current_app.mongo.db.alerts


@admin_bp.route("/alerts", methods=["GET"])
@admin_required
def list_alerts():
    try:
        status_filter = request.args.get("status", "all")  # all, unresolved, critical
        search = request.args.get("search", "")

        query = {}
        if status_filter == "unresolved":
            query["resolved"] = False
        elif status_filter == "critical":
            query["severity"] = "critical"
            query["resolved"] = False

        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"title": search_regex},
                {"message": search_regex},
                {"busNumber": search_regex},
                {"routeNumber": search_regex}
            ]

        # Get stored alerts
        alerts = list(get_alerts_collection().find(query).sort("created_at", -1).limit(50))
        for a in alerts:
            a["_id"] = str(a["_id"])
            a["id"] = a["_id"]
            if "created_at" in a and a["created_at"]:
                a["created_at"] = a["created_at"].isoformat()
            if "resolved_at" in a and a["resolved_at"]:
                a["resolved_at"] = a["resolved_at"].isoformat()

        # Stats
        total = get_alerts_collection().count_documents({})
        unresolved = get_alerts_collection().count_documents({"resolved": False})
        critical = get_alerts_collection().count_documents({"severity": "critical", "resolved": False})
        resolved_today = get_alerts_collection().count_documents({
            "resolved": True,
            "resolved_at": {"$gte": datetime.utcnow() - timedelta(days=1)}
        })

        return jsonify({
            "success": True,
            "data": {
                "alerts": alerts,
                "stats": {
                    "total": total,
                    "unresolved": unresolved,
                    "critical": critical,
                    "resolvedToday": resolved_today,
                    "resolutionRate": round((resolved_today / max(total, 1)) * 100)
                }
            }
        })

    except Exception as e:
        print(f"❌ List Alerts Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/alerts/create", methods=["POST"])
@admin_required
def create_alert():
    try:
        data = request.json
        title = data.get("title", "").strip()
        message = data.get("message", "").strip()
        severity = data.get("severity", "info")  # critical, warning, info
        bus_number = data.get("busNumber", "").strip().upper()
        route_number = data.get("routeNumber", "").strip().upper()

        if not title or not message:
            return jsonify({"success": False, "message": "Title and message are required"}), 400
        if severity not in ["critical", "warning", "info"]:
            return jsonify({"success": False, "message": "Severity must be 'critical', 'warning', or 'info'"}), 400

        alert_doc = {
            "title": title,
            "message": message,
            "severity": severity,
            "busNumber": bus_number,
            "routeNumber": route_number,
            "resolved": False,
            "resolved_at": None,
            "resolved_by": None,
            "created_by": request.admin.get("email", "admin"),
            "created_at": datetime.utcnow()
        }

        result = get_alerts_collection().insert_one(alert_doc)
        alert_doc["_id"] = str(result.inserted_id)
        alert_doc["id"] = alert_doc["_id"]

        return jsonify({
            "success": True,
            "message": "Alert created successfully",
            "data": alert_doc
        }), 201

    except Exception as e:
        print(f"❌ Create Alert Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/alerts/<alert_id>/resolve", methods=["PUT"])
@admin_required
def resolve_alert(alert_id):
    try:
        alert = get_alerts_collection().find_one({"_id": ObjectId(alert_id)})
        if not alert:
            return jsonify({"success": False, "message": "Alert not found"}), 404

        get_alerts_collection().update_one(
            {"_id": ObjectId(alert_id)},
            {"$set": {
                "resolved": True,
                "resolved_at": datetime.utcnow(),
                "resolved_by": request.admin.get("email", "admin")
            }}
        )

        return jsonify({
            "success": True,
            "message": "Alert resolved successfully"
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@admin_bp.route("/alerts/<alert_id>", methods=["DELETE"])
@admin_required
def delete_alert(alert_id):
    try:
        alert = get_alerts_collection().find_one({"_id": ObjectId(alert_id)})
        if not alert:
            return jsonify({"success": False, "message": "Alert not found"}), 404

        get_alerts_collection().delete_one({"_id": ObjectId(alert_id)})
        return jsonify({"success": True, "message": "Alert deleted"})

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
