from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash
from datetime import datetime, timedelta
import jwt
import os

passenger_bp = Blueprint("passenger", __name__, url_prefix="/api/passenger")
SECRET_KEY = os.getenv("PASSENGER_JWT_SECRET", "passenger-secret-gamana-2024")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/bus_tracker")


@passenger_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.json
        full_name = data.get("fullName")
        email = data.get("email")
        phone = data.get("phone")
        password = data.get("password")

        if not all([full_name, email, phone, password]):
            return jsonify({"success": False, "message": "All fields are required"}), 400

        from app import mongo
        existing = mongo.db.passengers.find_one({"email": email.lower()})
        if existing:
            return jsonify({"success": False, "message": "Email already registered"}), 400

        from werkzeug.security import generate_password_hash
        passenger = {
            "fullName": full_name.strip(),
            "email": email.lower().strip(),
            "phone": phone.strip(),
            "password": generate_password_hash(password),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = mongo.db.passengers.insert_one(passenger)

        return jsonify({
            "success": True,
            "message": "Registration successful",
            "data": {"id": str(result.inserted_id), "fullName": full_name, "email": email}
        }), 201

    except Exception as e:
        print(f"❌ Register Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


@passenger_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        print(f"📝 Login attempt: {data}")
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"success": False, "message": "Email and password required"}), 400

        print(f"🔍 Looking for user: {email.lower().strip()}")
        # Direct access method instead of current_app
        from app import mongo
        passenger = mongo.db.passengers.find_one({"email": email.lower().strip()})
        print(f"🔍 Found user: {passenger is not None}")

        if not passenger:
            return jsonify({"success": False, "message": "Invalid credentials"}), 401

        print(f"🔐 Checking password...")
        stored_password = passenger.get("password", "")
        if isinstance(stored_password, bytes):
            stored_password = stored_password.decode('utf-8')
            print(f"🔄 Converted bytes password to string")
        
        if not check_password_hash(stored_password, password):
            print(f"❌ Password mismatch")
            return jsonify({"success": False, "message": "Invalid credentials"}), 401

        print(f"✅ Password OK, generating token...")
        token = jwt.encode(
            {"id": str(passenger["_id"]), "email": passenger["email"], "role": "passenger", "exp": datetime.utcnow() + timedelta(hours=24)},
            SECRET_KEY,
            algorithm="HS256"
        )

        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": token,
            "passenger": {
                "id": str(passenger["_id"]),
                "fullName": passenger["fullName"],
                "email": passenger["email"],
                "phone": passenger["phone"]
            }
        })

    except Exception as e:
        print(f"❌ Login Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

