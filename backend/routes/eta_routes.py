import math
from datetime import datetime

import pandas as pd
from flask import Blueprint, jsonify, request

from config import eta_model
from services.eta_service import (
    FEATURE_ORDER,
    EtaPredictionError,
    build_eta_prediction,
)

eta_bp = Blueprint("eta_bp", __name__)


def parse_number(value, minimum, maximum):
    if isinstance(value, bool):
        return None

    try:
        parsed_value = float(value)
    except (TypeError, ValueError):
        return None

    if minimum <= parsed_value <= maximum:
        return parsed_value

    return None


@eta_bp.route("/api/eta/predict", methods=["POST"])
def predict_trusted_eta():
    data = request.get_json(silent=True) or {}

    try:
        prediction = build_eta_prediction(data)
    except EtaPredictionError as error:
        return jsonify({
            "error": error.message,
        }), error.status_code

    return jsonify(prediction)


@eta_bp.route("/api/predict-eta", methods=["POST"])
def predict_eta():
    data = request.get_json(silent=True) or {}

    if eta_model is None:
        return jsonify({
            "error": "ETA model is not available.",
        }), 500

    distance_km = parse_number(data.get("distance_km"), 0, 1000)
    current_speed_kmh = parse_number(data.get("current_speed_kmh"), 0, 200)
    traffic_level = parse_number(data.get("traffic_level", 0.3), 0, 1)

    if distance_km is None or current_speed_kmh is None:
        return jsonify({
            "error": "distance_km and current_speed_kmh are required",
        }), 400

    if traffic_level is None:
        return jsonify({
            "error": "traffic_level must be between 0 and 1",
        }), 400

    now = datetime.now()
    hour_of_day = parse_number(data.get("hour_of_day", now.hour), 0, 23)
    day_of_week = parse_number(data.get("day_of_week", now.weekday()), 0, 6)

    if hour_of_day is None or day_of_week is None:
        return jsonify({
            "error": "hour_of_day and day_of_week are invalid",
        }), 400

    day_of_week = int(day_of_week)
    try:
        is_weekend = int(data.get("is_weekend", 1 if day_of_week >= 5 else 0))
    except (TypeError, ValueError):
        is_weekend = 1 if day_of_week >= 5 else 0

    is_weekend = 1 if is_weekend else 0

    features = pd.DataFrame([{
        "distance_km": distance_km,
        "current_speed_kmh": current_speed_kmh,
        "hour_of_day": int(hour_of_day),
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "traffic_level": traffic_level,
    }], columns=FEATURE_ORDER)
    predicted_eta = float(eta_model.predict(features)[0])

    if not math.isfinite(predicted_eta) or predicted_eta < 0:
        return jsonify({
            "error": "ETA model returned an invalid prediction",
        }), 500

    return jsonify({
        "eta_minutes": round(float(predicted_eta), 2),
        "inputs_used": {
            "distance_km": distance_km,
            "current_speed_kmh": current_speed_kmh,
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "traffic_level": traffic_level,
        }
    })
