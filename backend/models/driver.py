from flask_pymongo import PyMongo
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from datetime import datetime


class DriverModel:
    def __init__(self, mongo):
        self.collection = mongo.db.drivers

    def create(self, data):
        """Admin creates a driver with full assignment (bus + route)"""
        driver = {
            "fullName": data.get("fullName"),
            "employee_id": data.get("employee_id", ""),
            "nic": data.get("nic", ""),
            "phone": data.get("phone"),
            "licenseNumber": data.get("licenseNumber"),
            "experience": data.get("experience", ""),
            "licensePhoto": data.get("licensePhoto", ""),
            "photo": data.get("photo", ""),
            "bus_number": data.get("bus_number", ""),
            "route_number": data.get("route_number", ""),
            "employer": data.get("employer", ""),
            "password": generate_password_hash(data.get("password")) if data.get("password") else "",
            "status": data.get("status", "approved"),  # Admin-created drivers are auto-approved
            "created_by": data.get("created_by", "admin"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        return self.collection.insert_one(driver)

    def find_by_license(self, license_number):
        return self.collection.find_one({"licenseNumber": license_number.upper()})

    def find_by_nic(self, nic):
        return self.collection.find_one({"nic": nic.upper()})

    def find_by_employee_id(self, employee_id):
        return self.collection.find_one({"employee_id": employee_id.upper()})

    def find_by_id(self, driver_id):
        from bson.objectid import ObjectId
        return self.collection.find_one({"_id": ObjectId(driver_id)})

    def find_all(self, query=None, page=1, limit=20):
        if query is None:
            query = {}
        skip = (page - 1) * limit
        total = self.collection.count_documents(query)
        drivers = list(self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit))
        return drivers, total

    def update_status(self, driver_id, status, employee_id=None, password=None):
        from bson.objectid import ObjectId
        update = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        if employee_id:
            update["employee_id"] = employee_id.upper()
        if password:
            update["password"] = generate_password_hash(password)
        return self.collection.update_one({"_id": ObjectId(driver_id)}, {"$set": update})

    def update_assignment(self, driver_id, bus_number=None, route_number=None):
        """Update driver's bus/route assignment (Admin/Fleet Manager only)"""
        from bson.objectid import ObjectId
        update = {"updated_at": datetime.utcnow()}
        if bus_number is not None:
            update["bus_number"] = bus_number
        if route_number is not None:
            update["route_number"] = route_number
        return self.collection.update_one({"_id": ObjectId(driver_id)}, {"$set": update})

    def delete(self, driver_id):
        from bson.objectid import ObjectId
        return self.collection.delete_one({"_id": ObjectId(driver_id)})

    def get_stats(self):
        total = self.collection.count_documents({})
        pending = self.collection.count_documents({"status": "pending"})
        approved = self.collection.count_documents({"status": "approved"})
        rejected = self.collection.count_documents({"status": "rejected"})
        return {"total": total, "pending": pending, "approved": approved, "rejected": rejected}
