from datetime import datetime


class PassengerModel:
    def __init__(self, mongo):
        self.collection = mongo.db.passengers

    def create(self, data):
        passenger = {
            "fullName": data.get("fullName"),
            "email": data.get("email"),
            "phone": data.get("phone"),
            "password": self._hash_password(data.get("password")),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        return self.collection.insert_one(passenger)

    def find_by_email(self, email):
        return self.collection.find_one({"email": email.lower()})

    def find_by_id(self, passenger_id):
        from bson.objectid import ObjectId
        return self.collection.find_one({"_id": ObjectId(passenger_id)})

    def _hash_password(self, password):
        from werkzeug.security import generate_password_hash
        return generate_password_hash(password)

    @staticmethod
    def check_password(hashed, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(hashed, password)
