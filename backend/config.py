import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "gamanalk_secret")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DB_NAME = os.getenv("DB_NAME", "bus_tracker")
    JWT_EXPIRY = int(os.getenv("JWT_EXPIRY", 86400))  # 24 hours in seconds
