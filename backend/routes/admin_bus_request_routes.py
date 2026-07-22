from flask import Blueprint, g, jsonify, request

from services.driver_bus_request_service import (
    BUS_REQUEST_STATUSES,
    DriverBusRequestError,
    approve_driver_bus_request,
    delete_admin_driver_bus_request,
    get_admin_driver_bus_request,
    list_driver_bus_requests,
    reject_driver_bus_request,
    request_driver_bus_correction,
    start_driver_bus_request_review,
    update_admin_driver_bus_request,
)
from utils.auth_utils import jwt_required, roles_required


admin_bus_request_bp = Blueprint(
    "admin_bus_request_bp",
    __name__,
)


def _error_response(error: DriverBusRequestError):
    payload = {
        "error": error.message,
        "code": error.code,
        "field": error.field,
    }
    if error.details:
        payload["details"] = error.details
    return jsonify(payload), error.status


@admin_bus_request_bp.route(
    "/api/admin/bus-requests",
    methods=["GET"],
)
@jwt_required
@roles_required("admin")
def list_admin_bus_requests():
    status = request.args.get("status", "").strip().lower()
    query = request.args.get("q", "").strip()

    if status and status not in BUS_REQUEST_STATUSES:
        return jsonify({
            "error": "Invalid bus request status",
            "allowedStatuses": sorted(BUS_REQUEST_STATUSES),
        }), 400

    if len(query) > 80:
        return jsonify({
            "error": "q must be 80 characters or fewer"
        }), 400

    try:
        requests_list = list_driver_bus_requests(
            status=status,
            query=query,
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "success",
        "requests": requests_list,
        "meta": {
            "count": len(requests_list),
            "statuses": sorted(BUS_REQUEST_STATUSES),
        },
    })


@admin_bus_request_bp.route(
    "/api/admin/bus-requests/<request_id>",
    methods=["GET"],
)
@jwt_required
@roles_required("admin")
def get_admin_bus_request(request_id):
    try:
        bus_request = get_admin_driver_bus_request(
            request_id
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "success",
        "busRequest": bus_request,
    })


@admin_bus_request_bp.route(
    "/api/admin/bus-requests/<request_id>",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def update_admin_bus_request(request_id):
    data = request.get_json(silent=True)
    try:
        bus_request = update_admin_driver_bus_request(
            request_id,
            data,
            actor=str(g.auth.get("sub") or ""),
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "updated",
        "busRequest": bus_request,
    })


@admin_bus_request_bp.route(
    "/api/admin/bus-requests/<request_id>",
    methods=["DELETE"],
)
@jwt_required
@roles_required("admin")
def delete_admin_bus_request(request_id):
    try:
        deleted_request_id = delete_admin_driver_bus_request(
            request_id,
            actor=str(g.auth.get("sub") or ""),
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "deleted",
        "requestId": deleted_request_id,
    })


@admin_bus_request_bp.route(
    "/api/admin/bus-requests/<request_id>/review",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def review_admin_bus_request(request_id):
    try:
        bus_request = start_driver_bus_request_review(
            request_id,
            actor=str(g.auth.get("sub") or ""),
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "under_review",
        "busRequest": bus_request,
    })


@admin_bus_request_bp.route(
    "/api/admin/bus-requests/<request_id>/approve",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def approve_admin_bus_request(request_id):
    try:
        bus_request = approve_driver_bus_request(
            request_id,
            actor=str(g.auth.get("sub") or ""),
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "approved",
        "busRequest": bus_request,
    })


@admin_bus_request_bp.route(
    "/api/admin/bus-requests/<request_id>/request-correction",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def correction_admin_bus_request(request_id):
    data = request.get_json(silent=True) or {}

    try:
        bus_request = request_driver_bus_correction(
            request_id,
            actor=str(g.auth.get("sub") or ""),
            fields=data.get("fields"),
            message=data.get("message"),
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "correction_required",
        "busRequest": bus_request,
    })


@admin_bus_request_bp.route(
    "/api/admin/bus-requests/<request_id>/reject",
    methods=["PATCH"],
)
@jwt_required
@roles_required("admin")
def reject_admin_bus_request(request_id):
    data = request.get_json(silent=True) or {}

    try:
        bus_request = reject_driver_bus_request(
            request_id,
            actor=str(g.auth.get("sub") or ""),
            reason=data.get("reason"),
        )
    except DriverBusRequestError as error:
        return _error_response(error)

    return jsonify({
        "status": "rejected",
        "busRequest": bus_request,
    })
