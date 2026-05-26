from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


class AdminModel:
    def __init__(self, mongo):
        self.collection = mongo.db.admins

    def seed_default_admin(self):
        """Create default admin if not exists"""
        existing = self.collection.find_one({"email": "admin@gamanalak.com"})
        if not existing:
            admin = {
                "name": "Admin User",
                "email": "admin@gamanalak.com",
                "password": generate_password_hash("admin123"),
                "role": "Fleet Manager",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            self.collection.insert_one(admin)
            print("✅ Default admin created (admin@gamanalak.com / admin123)")

    def find_by_email(self, email):
        return self.collection.find_one({"email": email.lower().strip()})

    def find_by_id(self, admin_id):
        from bson.objectid import ObjectId
        return self.collection.find_one({"_id": ObjectId(admin_id)})

    @staticmethod
    def check_password(hashed, password):
        return check_password_hash(hashed, password)
