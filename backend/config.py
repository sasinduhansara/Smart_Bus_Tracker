import os
from pathlib import Path

import joblib
from pymongo import MongoClient
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
TEXTLK_API_TOKEN = os.getenv("TEXTLK_API_TOKEN")
TEXTLK_SENDER_ID = os.getenv("TEXTLK_SENDER_ID", "TextLKDemo")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "driver-documents")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client["smart_bus_db"]

buses_collection = db["buses"]
drivers_collection = db["drivers"]
otp_collection = db["otp_requests"]
trips_collection = db["trips"]
driver_shifts_collection = db["driver_shifts"]
notifications_collection = db["notifications"]
routes_collection = db["routes"]
issue_reports_collection = db["issue_reports"]

eta_model_load_error = None

try:
    eta_model = joblib.load(BASE_DIR / "eta_model.pkl")
except Exception as error:
    eta_model = None
    eta_model_load_error = error
