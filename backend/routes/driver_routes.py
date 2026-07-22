from bson.objectid import ObjectId
from flask import Blueprint, g, jsonify, request

from services.driver_bus_request_service import (
    DriverBusRequestError,
    get_driver_bus_references,
    get_driver_bus_request,
    get_driver_onboarding_status,
    submit_driver_bus_request,
)
from utils.auth_utils import jwt_required, roles_required


driver_bp = Blueprint("driver_bp", __name__)


def _authenticated_driver_id() -> str:
    return str(getattr(g, "auth", {}).get("sub", "")).strip()


def _error_response(error: DriverBusRequestError):
    payload = {
        "error": error.message,
        "code": error.code,
        "field": error.field,
    }
    if error.details:
        payload["details"] = error.details
    return jsonify(payload), error.status


@driver_bp.route(
    "/api/driver/me/onboarding-status",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
def driver_onboarding_status():
    driver_id = _authenticated_driver_id()
    if not ObjectId.is_valid(driver_id):
        return jsonify({
            "error": "Invalid authenticated driver",
            "code": "INVALID_DRIVER_SUBJECT",
        }), 401

    try:
        return jsonify(
            get_driver_onboarding_status(driver_id)
        )
    except DriverBusRequestError as error:
        return _error_response(error)


@driver_bp.route(
    "/api/driver/me/bus-request",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
def get_my_bus_request():
    driver_id = _authenticated_driver_id()
    if not ObjectId.is_valid(driver_id):
        return jsonify({
            "error": "Invalid authenticated driver",
            "code": "INVALID_DRIVER_SUBJECT",
        }), 401

    try:
        bus_request = get_driver_bus_request(driver_id)
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "success",
        "busRequest": bus_request,
    })


@driver_bp.route(
    "/api/driver/bus-onboarding/references",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
def driver_bus_onboarding_references():
    return jsonify(get_driver_bus_references())


@driver_bp.route(
    "/api/driver/me/bus-request",
    methods=["POST"],
)
@jwt_required
@roles_required("driver")
def create_my_bus_request():
    driver_id = _authenticated_driver_id()
    if not ObjectId.is_valid(driver_id):
        return jsonify({
            "error": "Invalid authenticated driver",
            "code": "INVALID_DRIVER_SUBJECT",
        }), 401

    data = request.get_json(silent=True)
    try:
        bus_request = submit_driver_bus_request(
            driver_id,
            data,
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "submitted",
        "requestType": bus_request["requestType"],
        "busRequestStatus": bus_request["status"],
        "busRequest": bus_request,
    }), 201
