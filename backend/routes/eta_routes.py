from flask import Blueprint, jsonify, request

from services.eta_service import (
    EtaPredictionError,
    build_eta_prediction,
)

eta_bp = Blueprint("eta_bp", __name__)


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
    return jsonify({
        "error": (
            "This legacy client-supplied ETA endpoint has been retired. "
            "Use /api/eta/predict with a live bus and route destination."
        ),
    }), 410
