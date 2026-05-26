"""
   GamanaLK - Driver Routes
   ───────────────────────────────────────────────────────────────
   NEW FLOW:
   1. Admin pre-registers a bus with (Bus#, Route#, Phone, NIC/License)
   2. Driver uses that pre-registered data to complete registration
   3. OTP verification via phone number
   4. ID photo upload with auto-scan & cross-check
   5. Only matching pre-registered IDs can register
"""

from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash
from bson.objectid import ObjectId
from datetime import datetime, timedelta
import jwt
import os
import random
import requests

from utils.helpers import normalize_phone

driver_bp = Blueprint("driver", __name__, url_prefix="/api/driver")
SECRET_KEY = os.getenv("DRIVER_JWT_SECRET", "driver-secret-gamana-2024")


def get_driver_collection():
    return current_app.mongo.db.drivers


def get_bus_registration_collection():
    """Collection where Admin pre-registers bus+driver data"""
    return current_app.mongo.db.bus_registrations


def get_otp_collection():
    return current_app.mongo.db.otp_codes


# ═══════════════════════════════════════════════════════════════
#  TEXTLK SMS CONFIGURATION
#  ═══════════════════════════════════════════════════════════════
#  Get your API token from: https://app.text.lk
#  ═══════════════════════════════════════════════════════════════
TEXTLK_API_URL = "https://app.text.lk/api/v3/sms/send"
TEXTLK_API_TOKEN = "2100|aLRN1RCPkqfBPI0RQnyK5oHfWtVvEXpeksPEEhXt6867021c"
TEXTLK_SENDER_ID = "VEHICHECK"


# ─── Helper: Generate OTP ─────────────────────────────────────────
def generate_otp():
    return str(random.randint(100000, 999999))


# ─── 1. GET: Fetch Pre-Registered Data for Dropdown ──────────────
@driver_bp.route("/pre-registrations", methods=["GET"])
def get_pre_registrations():
    """
    Returns list of pre-registered bus assignments (for dropdown).
    Only returns ones that haven't been fully registered yet.
    """
    try:
        registrations = list(get_bus_registration_collection().find(
            {"status": "pending"},
            {"nic": 1, "licenseNumber": 1, "fullName": 1,
             "busNumber": 1, "routeNumber": 1, "phone": 1}
        ))

        result = []
        for reg in registrations:
            reg["id"] = str(reg["_id"])
            del reg["_id"]
            result.append(reg)

        return jsonify({
            "success": True,
            "data": result
        })

    except Exception as e:
        print(f"❌ Get Pre-Registrations Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── 2. POST: Send OTP to Phone ──────────────────────────────────
@driver_bp.route("/send-otp", methods=["POST"])
def send_otp():
    """
    Sends OTP to the pre-registered phone number.
    In production, integrate with SMS gateway (e.g., Twilio, Vonage).
    """
    try:
        data = request.json
        raw_phone = data.get("phone", "").strip()
        phone = normalize_phone(raw_phone)
        registration_id = data.get("registrationId", "").strip()

        if not phone or not registration_id:
            return jsonify({"success": False, "message": "Phone and registration ID required"}), 400

        # Verify this phone matches pre-registration (try normalized match)
        reg = get_bus_registration_collection().find_one({
            "_id": ObjectId(registration_id),
            "phone": phone
        })
        if not reg:
            # Try to find registration by normalized phone
            all_regs = list(get_bus_registration_collection().find({"_id": ObjectId(registration_id)}))
            for r in all_regs:
                if normalize_phone(r.get("phone", "")) == phone:
                    reg = r
                    break

        if not reg:
            return jsonify({
                "success": False,
                "message": "Phone number does not match our records. Contact your Admin."
            }), 400

        otp = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=5)

        # Store OTP in multiple formats for lookup flexibility
        phone_variants = [phone, raw_phone]
        if phone.startswith('+94'):
            phone_variants.append('0' + phone[3:])
            phone_variants.append(phone[3:])

        # Clean up old OTPs for all phone variants
        get_otp_collection().delete_many({"phone": {"$in": list(set(phone_variants))}})

        for p in set(phone_variants):
            get_otp_collection().update_one(
                {"phone": p},
                {"$set": {
                    "phone": p,
                    "otp": otp,
                    "expires_at": expires_at,
                    "created_at": datetime.utcnow()
                }},
                upsert=True
            )

        # ─── Send SMS via TextLk OAuth2 API ───────────────────────
        try:
            headers = {
                "Authorization": f"Bearer {TEXTLK_API_TOKEN}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            payload = {
                "sender_id": TEXTLK_SENDER_ID,
                "recipient": phone,
                "message": f"Your OTP for GamanaLK Driver Registration is: {otp}\nValid for 5 minutes.",
                "type": "plain"
            }
            response = requests.post(
                TEXTLK_API_URL,
                json=payload,
                headers=headers,
                timeout=15
            )
            print(f"📱 TextLk Response ({response.status_code}): {response.text}")

            if response.status_code == 200:
                print("✅ SMS sent successfully via TextLk!")
            else:
                print(f"⚠️ TextLk returned status {response.status_code}")

        except Exception as sms_err:
            print(f"⚠️ TextLk SMS Error (non-critical): {sms_err}")
            # Continue anyway - OTP is stored and can be retried

        print(f"📱 OTP for {phone}: {otp}")

        return jsonify({
            "success": True,
            "message": "OTP sent successfully",
            "data": {
                "phone": phone,
                "otp": otp  # ⚠️ Remove in production! Only for dev testing
            }
        })

    except Exception as e:
        print(f"❌ Send OTP Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── 3. POST: Verify OTP & Complete Registration ─────────────────
@driver_bp.route("/verify-otp-register", methods=["POST"])
def verify_otp_and_register():
    """
    Final registration step:
    1. Verify OTP
    2. Check scanned ID matches pre-registered ID
    3. Create driver account
    """
    try:
        data = request.json
        registration_id = data.get("registrationId", "").strip()
        raw_phone = data.get("phone", "").strip()
        phone = normalize_phone(raw_phone)
        otp = data.get("otp", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        id_photo_front = data.get("idPhotoFront", "")  # base64 or URL
        id_photo_back = data.get("idPhotoBack", "")     # base64 or URL
        scanned_id_number = data.get("scannedIdNumber", "").strip().upper()

        # ─── Basic Validation ──────────────────────────────────
        if not all([registration_id, phone, otp, email, password, scanned_id_number]):
            return jsonify({
                "success": False,
                "message": "Required: registrationId, phone, otp, email, password, scannedIdNumber"
            }), 400

        # ─── Verify OTP (try multiple phone formats) ────────────
        phone_variants = [phone, raw_phone]
        if phone.startswith('+94'):
            phone_variants.append('0' + phone[3:])
            phone_variants.append(phone[3:])

        otp_record = None
        for p in set(phone_variants):
            otp_record = get_otp_collection().find_one({
                "phone": p,
                "otp": otp,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            if otp_record:
                break

        if not otp_record:
            return jsonify({
                "success": False,
                "message": "Invalid or expired OTP. Please request a new one."
            }), 400

        # ─── Get Pre-Registration ───────────────────────────────
        reg = get_bus_registration_collection().find_one({
            "_id": ObjectId(registration_id)
        })

        if not reg:
            return jsonify({
                "success": False,
                "message": "Pre-registration not found. Contact Admin."
            }), 400

        if reg.get("status") != "pending":
            return jsonify({
                "success": False,
                "message": "This registration has already been completed."
            }), 400

        # ─── Cross-Check: Scanned ID matches Pre-Registered ID ──
        pre_reg_nic = reg.get("nic", "").upper()
        pre_reg_license = reg.get("licenseNumber", "").upper()

        is_nic_match = (pre_reg_nic and scanned_id_number == pre_reg_nic)
        is_license_match = (pre_reg_license and scanned_id_number == pre_reg_license)

        if not (is_nic_match or is_license_match):
            return jsonify({
                "success": False,
                "message": f"Scanned ID ({scanned_id_number}) does not match pre-registered records (NIC: {pre_reg_nic}, License: {pre_reg_license}). Contact Admin.",
                "code": "ID_MISMATCH"
            }), 400

        # ─── Check Duplicates ───────────────────────────────────
        existing_email = get_driver_collection().find_one({"email": email})
        if existing_email:
            return jsonify({
                "success": False,
                "message": "Email is already registered"
            }), 400

        existing_id = get_driver_collection().find_one({
            "$or": [
                {"nic": pre_reg_nic} if pre_reg_nic else {},
                {"licenseNumber": pre_reg_license} if pre_reg_license else {}
            ]
        })
        if existing_id:
            return jsonify({
                "success": False,
                "message": "A driver with this NIC/License is already registered"
            }), 400

        # ─── Generate Employee ID ───────────────────────────────
        count = get_driver_collection().count_documents({})
        employee_id = f"DRV-{count + 1:04d}"

        # ─── Create Driver Document ─────────────────────────────
        driver_doc = {
            "fullName": reg.get("fullName", ""),
            "employee_id": employee_id,
            "nic": pre_reg_nic,
            "licenseNumber": pre_reg_license,
            "phone": phone,
            "email": email,
            "bus_number": reg.get("busNumber", ""),
            "route_number": reg.get("routeNumber", ""),
            "password": generate_password_hash(password),
            "idPhotoFront": id_photo_front,
            "idPhotoBack": id_photo_back,
            "scannedIdUsed": scanned_id_number,
            "registration_source": "self_registration_with_otp",
            "status": "approved",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = get_driver_collection().insert_one(driver_doc)

        # ─── Mark Pre-Registration as Completed ─────────────────
        get_bus_registration_collection().update_one(
            {"_id": ObjectId(registration_id)},
            {"$set": {
                "status": "completed",
                "driver_id": str(result.inserted_id),
                "completed_at": datetime.utcnow()
            }}
        )

        # ─── Delete Used OTP ────────────────────────────────────
        get_otp_collection().delete_many({"phone": {"$in": list(set(phone_variants))}})

        return jsonify({
            "success": True,
            "message": f"Driver '{reg['fullName']}' registered successfully!",
            "data": {
                "id": str(result.inserted_id),
                "employeeId": employee_id,
                "fullName": reg.get("fullName", ""),
                "busNumber": reg.get("busNumber", ""),
                "routeNumber": reg.get("routeNumber", ""),
                "email": email,
                "status": "approved"
            }
        }), 201

    except Exception as e:
        print(f"❌ Verify OTP & Register Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── Driver Login ─────────────────────────────────────────────────
@driver_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        
        # ─── Support both: employeeID+password OR phone+otp ──────
        employee_id = data.get("employeeId")
        password = data.get("password")
        phone = data.get("phone")
        otp = data.get("otp")

        # ─── Option 1: Phone + OTP Login (NEW) ──────────────────
        if phone and otp:
            raw_phone = data.get("phone", "").strip()
            otp = otp.strip()

            # Build ALL possible phone variants for OTP lookup
            raw_normalized = normalize_phone(raw_phone)
            phone_variants = []
            # Add the normalized form (+947XXXXXXXX)
            phone_variants.append(raw_normalized)
            # Add the raw form as received
            phone_variants.append(raw_phone)
            # Add more variants derived from the normalized form
            if raw_normalized and raw_normalized.startswith('+94'):
                no_country_code = raw_normalized[3:]  # e.g., 784978256 or 712345678
                phone_variants.append('0' + no_country_code)  # 0784978256
                phone_variants.append(no_country_code)  # 784978256
            # Now set phone to normalized for driver lookup later
            phone = raw_normalized

            otp_record = None
            for p in phone_variants:
                otp_record = get_otp_collection().find_one({
                    "phone": p,
                    "otp": otp,
                    "expires_at": {"$gt": datetime.utcnow()}
                })
                if otp_record:
                    print(f"✅ OTP matched with phone variant: '{p}'")
                    break

            if not otp_record:
                print(f"❌ OTP NOT matched! Attempted variants: {phone_variants}")
                print(f"🔍 Provided OTP: {otp}")
                # Debug: Check if ANY OTP exists for this phone
                for pv in phone_variants:
                    existing = get_otp_collection().find_one({"phone": pv})
                    if existing:
                        print(f"  OTP found for {pv}: otp={existing.get('otp')}, expires={existing.get('expires_at')}")
                    else:
                        print(f"  No OTP found for {pv}")
                return jsonify({"success": False, "message": "Invalid or expired OTP"}), 400

            # Find driver by phone - try multiple format matches
            driver = get_driver_collection().find_one({"phone": phone})  # normalized: +947XXXXXXXX
            if not driver:
                # Try raw format
                driver = get_driver_collection().find_one({"phone": raw_phone})
            if not driver:
                # Try by normalized phone match across all drivers
                all_drivers = list(get_driver_collection().find({}))
                for d in all_drivers:
                    db_phone = d.get("phone", "")
                    if normalize_phone(db_phone) == phone or db_phone == raw_phone:
                        driver = d
                        print(f"✅ Driver found by variant match: {d.get('fullName')}")
                        break

            if not driver:
                return jsonify({"success": False, "message": "No driver found with this phone number"}), 404

            if driver["status"] != "approved":
                msg = "Application still pending" if driver["status"] == "pending" else "Application rejected"
                return jsonify({"success": False, "message": msg}), 403

            # Delete used OTP (for all variants)
            get_otp_collection().delete_many({"phone": {"$in": list(set(phone_variants))}})

            token = jwt.encode(
                {
                    "id": str(driver["_id"]),
                    "employeeId": driver["employee_id"],
                    "role": "driver",
                    "exp": datetime.utcnow() + timedelta(hours=24)
                },
                SECRET_KEY,
                algorithm="HS256"
            )

            return jsonify({
                "success": True,
                "message": f"Welcome back, {driver['fullName']}!",
                "token": token,
                "driver": {
                    "id": str(driver["_id"]),
                    "fullName": driver["fullName"],
                    "employeeId": driver["employee_id"],
                    "phone": driver["phone"],
                    "busNumber": driver.get("bus_number", ""),
                    "routeNumber": driver.get("route_number", ""),
                    "email": driver.get("email", ""),
                    "licenseNumber": driver["licenseNumber"]
                }
            })

        # ─── Option 2: Employee ID + Password Login ─────────────
        if employee_id and password:
            driver = get_driver_collection().find_one({"employee_id": employee_id.strip().upper()})

            if not driver:
                return jsonify({"success": False, "message": "Invalid credentials"}), 401

            if driver["status"] != "approved":
                msg = "Application still pending" if driver["status"] == "pending" else "Application rejected"
                return jsonify({"success": False, "message": msg}), 403

            from werkzeug.security import check_password_hash
            stored_password = driver.get("password", "")
            if isinstance(stored_password, bytes):
                stored_password = stored_password.decode('utf-8')

            if not check_password_hash(stored_password, password):
                return jsonify({"success": False, "message": "Invalid credentials"}), 401

            token = jwt.encode(
                {
                    "id": str(driver["_id"]),
                    "employeeId": driver["employee_id"],
                    "role": "driver",
                    "exp": datetime.utcnow() + timedelta(hours=24)
                },
                SECRET_KEY,
                algorithm="HS256"
            )

            return jsonify({
                "success": True,
                "message": "Login successful",
                "token": token,
                "driver": {
                    "id": str(driver["_id"]),
                    "fullName": driver["fullName"],
                    "employeeId": driver["employee_id"],
                    "phone": driver["phone"],
                    "busNumber": driver.get("bus_number", ""),
                    "routeNumber": driver.get("route_number", ""),
                    "email": driver.get("email", ""),
                    "licenseNumber": driver["licenseNumber"]
                }
            })

        return jsonify({"success": False, "message": "Please provide phone+otp or employeeId+password"}), 400

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── 3.5 POST: Verify OTP Only (for registration step) ───────────
@driver_bp.route("/verify-otp-only", methods=["POST"])
def verify_otp_only():
    """
    Standalone OTP verification - does NOT complete registration.
    Used by register.tsx handleVerifyOtp to verify OTP before proceeding
    to photo upload step.
    """
    try:
        data = request.json
        raw_phone = data.get("phone", "").strip()
        phone = normalize_phone(raw_phone)
        otp = data.get("otp", "").strip()

        if not phone or not otp:
            return jsonify({"success": False, "message": "Phone and OTP are required"}), 400

        # Verify OTP - try multiple phone formats
        phone_variants = [phone, raw_phone]
        if phone.startswith('+94'):
            phone_variants.append('0' + phone[3:])
            phone_variants.append(phone[3:])

        otp_record = None
        for p in set(phone_variants):
            otp_record = get_otp_collection().find_one({
                "phone": p,
                "otp": otp,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            if otp_record:
                break

        if not otp_record:
            return jsonify({
                "success": False,
                "message": "Invalid or expired OTP. Please request a new one."
            }), 400

        return jsonify({
            "success": True,
            "message": "OTP verified successfully"
        })

    except Exception as e:
        print(f"❌ Verify OTP Only Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ─── NEW: Send OTP for Login (no registrationId needed) ──────────
@driver_bp.route("/send-login-otp", methods=["POST"])
def send_login_otp():
    """
    Sends OTP for existing driver login.
    Checks driver exists before sending OTP.
    Handles mixed DB phone formats: +94771234567, 0784978256, 771234567
    """
    try:
        data = request.json
        raw_phone = data.get("phone", "").strip()

        if not raw_phone:
            return jsonify({"success": False, "message": "Phone number is required"}), 400

        phone = normalize_phone(raw_phone)

        # ─── Driver exists check (handles any DB phone format) ───
        driver = get_driver_collection().find_one({"phone": phone})
        if not driver:
            # Try to find driver by raw phone format
            driver = get_driver_collection().find_one({"phone": raw_phone})

        if not driver:
            # Try ALL possible phone format variants against every driver
            all_drivers = list(get_driver_collection().find({}))
            raw_normalized = normalize_phone(raw_phone)
            for d in all_drivers:
                db_phone = d.get("phone", "")
                db_normalized = normalize_phone(db_phone)
                if db_normalized == raw_normalized:
                    driver = d
                    break

        if not driver:
            return jsonify({
                "success": False,
                "message": "No driver found with this phone number. Please register first."
            }), 404

        if driver.get("status") != "approved":
            status_msg = "pending approval" if driver.get("status") == "pending" else "rejected"
            return jsonify({
                "success": False,
                "message": f"Your account is {status_msg}. Contact Admin."
            }), 403

        otp = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=5)

        # Build phone variants for storage and cleanup
        phone_variants = [phone, raw_phone]
        if phone.startswith('+94'):
            phone_variants.append('0' + phone[3:])  # 07XXXXXXXX
            phone_variants.append(phone[3:])  # 7XXXXXXXX (no leading 0)

        # Clean up any existing OTPs for this phone before storing new one
        get_otp_collection().delete_many({"phone": {"$in": list(set(phone_variants))}})

        # Store OTP in all format variants so login can match any
        for p in set(phone_variants):
            get_otp_collection().update_one(
                {"phone": p},
                {"$set": {
                    "phone": p,
                    "otp": otp,
                    "expires_at": expires_at,
                    "created_at": datetime.utcnow()
                }},
                upsert=True
            )

        # ─── Send SMS via TextLk ────────────────────────────────
        try:
            headers = {
                "Authorization": f"Bearer {TEXTLK_API_TOKEN}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            payload = {
                "sender_id": TEXTLK_SENDER_ID,
                "recipient": phone,
                "message": f"Your OTP for GamanaLK Driver Login is: {otp}\nValid for 5 minutes.",
                "type": "plain"
            }
            response = requests.post(TEXTLK_API_URL, json=payload, headers=headers, timeout=15)
            print(f"📱 Login OTP - TextLk Response ({response.status_code}): {response.text}")
        except Exception as sms_err:
            print(f"⚠️ TextLk SMS Error (non-critical): {sms_err}")

        print(f"📱 Login OTP for {phone}: {otp}")

        return jsonify({
            "success": True,
            "message": "OTP sent to your phone",
            "data": {
                "phone": phone,
                "otp": otp  # Dev mode only!
            }
        })

    except Exception as e:
        print(f"❌ Send Login OTP Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@driver_bp.route("/status/<driver_id>", methods=["GET"])
def get_status(driver_id):
    try:
        driver = get_driver_collection().find_one({"_id": ObjectId(driver_id)})
        if not driver:
            return jsonify({"success": False, "message": "Driver not found"}), 404

        return jsonify({
            "success": True,
            "data": {
                "fullName": driver["fullName"],
                "licenseNumber": driver["licenseNumber"],
                "status": driver["status"],
                "createdAt": driver["created_at"].isoformat()
            }
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
