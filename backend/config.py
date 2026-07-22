import os
from pathlib import Path

import joblib
from dotenv import load_dotenv
from pymongo import MongoClient


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _read_int_environment(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()

    try:
        return int(raw_value)
    except ValueError as error:
        raise RuntimeError(
            f"{name} must be a valid integer"
        ) from error


MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017",
).strip()

TEXTLK_API_TOKEN = os.getenv("TEXTLK_API_TOKEN")
TEXTLK_SENDER_ID = os.getenv(
    "TEXTLK_SENDER_ID",
    "TextLKDemo",
).strip()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_BUCKET = os.getenv(
    "SUPABASE_BUCKET",
    "driver-documents",
).strip()


# ---------------------------------------------------------------------------
# Trip-start location policy
# ---------------------------------------------------------------------------
# Permanent university-project behaviour: a driver may start a trip from any
# valid GPS coordinate. Authentication, driver approval, vehicle assignment,
# route assignment, GPS accuracy, timestamp freshness, and active-trip conflict
# checks remain enforced by the trip routes.
TRIP_START_LOCATION_POLICY = "anywhere"

# Kept for compatibility with modules that import these constants. They are no
# longer used to block trip starts.
SRI_LANKA_LATITUDE_RANGE = (5.5, 10.2)
SRI_LANKA_LONGITUDE_RANGE = (79.0, 82.5)


def is_within_service_area(
    latitude: float,
    longitude: float,
) -> bool:
    """Accept every already-validated GPS coordinate for trip start."""
    return True


# ---------------------------------------------------------------------------
# Map and routing configuration
# ---------------------------------------------------------------------------
MAP_STYLE_URL = os.getenv(
    "MAP_STYLE_URL",
    "https://demotiles.maplibre.org/style.json",
).strip()

MAP_TILE_URL = os.getenv(
    "MAP_TILE_URL",
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
).strip()

MAP_ATTRIBUTION_TEXT = os.getenv(
    "MAP_ATTRIBUTION_TEXT",
    "\u00a9 OpenStreetMap contributors",
).strip()

MAP_MIN_ZOOM = _read_int_environment(
    "MAP_MIN_ZOOM",
    5,
)

MAP_MAX_ZOOM = _read_int_environment(
    "MAP_MAX_ZOOM",
    18,
)

if MAP_MIN_ZOOM > MAP_MAX_ZOOM:
    raise RuntimeError(
        "MAP_MIN_ZOOM cannot be greater than MAP_MAX_ZOOM"
    )

OSRM_BASE_URL = os.getenv(
    "OSRM_BASE_URL",
    "http://router.project-osrm.org",
).strip()


# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------
client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,
)

db = client["smart_bus_db"]

# Existing collections. Do not rename because other modules import them.
buses_collection = db["buses"]
drivers_collection = db["drivers"]
otp_collection = db["otp_requests"]
trips_collection = db["trips"]
driver_shifts_collection = db["driver_shifts"]
notifications_collection = db["notifications"]
routes_collection = db["routes"]
issue_reports_collection = db["issue_reports"]
driver_bus_requests_collection = db["driver_bus_requests"]

# Collections used by the OpenStreetMap live-tracking implementation.
stops_collection = db["stops"]
live_bus_states_collection = db["live_bus_states"]
location_history_collection = db["location_history"]
eta_predictions_collection = db["eta_predictions"]


# ---------------------------------------------------------------------------
# ETA model
# ---------------------------------------------------------------------------
ETA_MODEL_PATH = BASE_DIR / os.getenv(
    "ETA_MODEL_PATH",
    "eta_model.pkl",
)

eta_model_load_error = None

try:
    eta_model = joblib.load(ETA_MODEL_PATH)
except Exception as error:
    # The deterministic ETA implementation remains available when the model
    # file does not exist or cannot be loaded.
    eta_model = None
    eta_model_load_error = error
