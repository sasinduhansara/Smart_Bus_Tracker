import re
from datetime import datetime, timezone
from typing import Any

from bson.objectid import ObjectId
from pymongo.errors import DuplicateKeyError

from config import (
    buses_collection,
    driver_bus_requests_collection,
    drivers_collection,
)
from services.route_service import (
    get_route_admin_details,
    list_route_records,
)


operators_collection = buses_collection.database["operators"]
depots_collection = buses_collection.database["depots"]

SERVICE_TYPES = {"sltb", "private", "intercity"}

BUS_REQUEST_STATUSES = {
    "pending",
    "under_review",
    "correction_required",
    "approved",
    "rejected",
}
OPEN_BUS_REQUEST_STATUSES = {
    "pending",
    "under_review",
    "correction_required",
}
BUS_REQUEST_TYPES = {
    "existing_bus_claim",
    "new_bus_registration",
}
ADMIN_EDITABLE_BUS_REQUEST_STATUSES = {
    "pending",
    "under_review",
    "correction_required",
    "rejected",
    "approved",
}
ADMIN_DELETABLE_BUS_REQUEST_STATUSES = {
    "pending",
    "under_review",
    "correction_required",
    "rejected",
    "approved",
}
CORRECTABLE_BUS_FIELDS = {
    "vehicleRegistrationNumber",
    "ntcPermitNumber",
    "operatorId",
    "depotId",
    "serviceType",
    "routeId",
    "make",
    "model",
    "manufactureYear",
    "seatingCapacity",
    "notes",
}


class DriverBusRequestError(ValueError):
    def __init__(
        self,
        message: str,
        *,
        field: str = "",
        code: str = "INVALID_DRIVER_BUS_REQUEST",
        status: int = 400,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.field = field
        self.code = code
        self.status = status
        self.details = details or {}


def _iso_value(value: Any) -> str:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return str(value) if value else ""


def _clean_text(value: Any, *, max_length: int) -> str:
    return str(value or "").strip()[:max_length]


def _identity_key(value: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())


def _object_id(value: Any, *, field: str) -> ObjectId:
    raw_value = str(value or "").strip()
    if not ObjectId.is_valid(raw_value):
        raise DriverBusRequestError(
            f"A valid {field} is required",
            field=field,
        )
    return ObjectId(raw_value)


def _optional_positive_int(
    value: Any,
    *,
    field: str,
    minimum: int,
    maximum: int,
) -> int | None:
    if value in (None, ""):
        return None

    try:
        parsed = int(value)
    except (TypeError, ValueError) as error:
        raise DriverBusRequestError(
            f"{field} must be an integer",
            field=field,
        ) from error

    if not minimum <= parsed <= maximum:
        raise DriverBusRequestError(
            f"{field} must be between {minimum} and {maximum}",
            field=field,
        )

    return parsed


def _driver_document(driver_id: str) -> dict[str, Any]:
    driver_object_id = _object_id(driver_id, field="driverId")
    driver = drivers_collection.find_one({"_id": driver_object_id})
    if not driver:
        raise DriverBusRequestError(
            "Driver not found",
            field="driverId",
            code="DRIVER_NOT_FOUND",
            status=404,
        )
    return driver


def _request_document(request_id: str) -> dict[str, Any]:
    request_object_id = _object_id(request_id, field="requestId")
    document = driver_bus_requests_collection.find_one(
        {"_id": request_object_id}
    )
    if not document:
        raise DriverBusRequestError(
            "Bus request not found",
            field="requestId",
            code="BUS_REQUEST_NOT_FOUND",
            status=404,
        )
    return document


def _operator_and_depot(
    operator_id: Any,
    depot_id: Any,
    *,
    require_active: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    operator_object_id = _object_id(operator_id, field="operatorId")
    depot_object_id = _object_id(depot_id, field="depotId")

    operator = operators_collection.find_one({"_id": operator_object_id})
    if not operator:
        raise DriverBusRequestError(
            "Operator not found",
            field="operatorId",
            code="OPERATOR_NOT_FOUND",
            status=404,
        )

    depot = depots_collection.find_one({"_id": depot_object_id})
    if not depot:
        raise DriverBusRequestError(
            "Depot not found",
            field="depotId",
            code="DEPOT_NOT_FOUND",
            status=404,
        )

    if str(depot.get("operatorId") or "") != str(operator_object_id):
        raise DriverBusRequestError(
            "The selected depot does not belong to the selected operator",
            field="depotId",
            code="DEPOT_OPERATOR_MISMATCH",
            status=409,
        )

    if require_active and not bool(operator.get("isActive", True)):
        raise DriverBusRequestError(
            "The selected operator is inactive",
            field="operatorId",
            code="OPERATOR_INACTIVE",
            status=409,
        )

    if require_active and not bool(depot.get("isActive", True)):
        raise DriverBusRequestError(
            "The selected depot is inactive",
            field="depotId",
            code="DEPOT_INACTIVE",
            status=409,
        )

    return operator, depot


def _active_depot_with_operator(
    depot_id: Any,
) -> tuple[dict[str, Any], dict[str, Any]]:
    depot_object_id = _object_id(depot_id, field="depotId")
    depot = depots_collection.find_one({"_id": depot_object_id})
    if not depot:
        raise DriverBusRequestError(
            "Depot not found",
            field="depotId",
            code="DEPOT_NOT_FOUND",
            status=404,
        )
    if not bool(depot.get("isActive", True)):
        raise DriverBusRequestError(
            "The selected depot is inactive",
            field="depotId",
            code="DEPOT_INACTIVE",
            status=409,
        )

    operator_id = depot.get("operatorId")
    if not isinstance(operator_id, ObjectId):
        operator_id = _object_id(operator_id, field="operatorId")
    operator = operators_collection.find_one({"_id": operator_id})
    if not operator:
        raise DriverBusRequestError(
            "The selected depot does not have a valid operator",
            field="depotId",
            code="DEPOT_OPERATOR_NOT_FOUND",
            status=409,
        )
    if not bool(operator.get("isActive", True)):
        raise DriverBusRequestError(
            "The operator for the selected depot is inactive",
            field="depotId",
            code="DEPOT_OPERATOR_INACTIVE",
            status=409,
        )

    return operator, depot


def _route_assignment(
    *,
    service_type: Any,
    depot: dict[str, Any],
    route_id: Any,
) -> tuple[str, dict[str, Any]]:
    normalized_service_type = str(service_type or "").strip().lower()
    if normalized_service_type not in SERVICE_TYPES:
        raise DriverBusRequestError(
            "Select a valid service type",
            field="serviceType",
            code="INVALID_SERVICE_TYPE",
        )

    route = get_route_admin_details(str(route_id or "").strip())
    if not route:
        raise DriverBusRequestError(
            "Route not found",
            field="routeId",
            code="ROUTE_NOT_FOUND",
            status=404,
        )
    if str(route.get("recordStatus") or "inactive").lower() != "active":
        raise DriverBusRequestError(
            "The selected route is inactive",
            field="routeId",
            code="ROUTE_INACTIVE",
            status=409,
        )
    if (
        str(route.get("depotName") or "").strip().casefold()
        != str(depot.get("name") or "").strip().casefold()
    ):
        raise DriverBusRequestError(
            "The selected route does not belong to the selected depot",
            field="routeId",
            code="ROUTE_DEPOT_MISMATCH",
            status=409,
        )
    route_service_types = {
        str(category or "").strip().lower()
        for category in route.get("serviceCategories", [])
    }
    if normalized_service_type not in route_service_types:
        raise DriverBusRequestError(
            "The selected route does not support this service type",
            field="routeId",
            code="ROUTE_SERVICE_TYPE_MISMATCH",
            status=409,
        )

    return normalized_service_type, route


def _find_bus_by_registration(
    vehicle_registration_number: str,
) -> dict[str, Any] | None:
    registration_key = _identity_key(vehicle_registration_number)
    if not registration_key:
        return None

    return buses_collection.find_one({
        "$or": [
            {"vehicleRegistrationKey": registration_key},
            {"trackingKey": registration_key},
            {
                "vehicleRegistrationNumber": {
                    "$regex": (
                        "^"
                        + re.escape(vehicle_registration_number.strip())
                        + "$"
                    ),
                    "$options": "i",
                }
            },
            {
                "bus_id": {
                    "$regex": (
                        "^"
                        + re.escape(vehicle_registration_number.strip())
                        + "$"
                    ),
                    "$options": "i",
                }
            },
        ]
    })


def _serialize_bus(
    bus: dict[str, Any] | None,
    *,
    operator_name: str = "",
    depot_name: str = "",
) -> dict[str, Any] | None:
    if not bus:
        return None

    return {
        "id": str(bus.get("_id") or ""),
        "vehicleRegistrationNumber": str(
            bus.get("vehicleRegistrationNumber")
            or bus.get("bus_id")
            or ""
        ),
        "ntcPermitNumber": str(bus.get("ntcPermitNumber") or ""),
        "operatorId": str(bus.get("operatorId") or ""),
        "operatorName": operator_name,
        "depotId": str(bus.get("depotId") or ""),
        "depotName": depot_name,
        "serviceType": str(bus.get("serviceType") or ""),
        "routeId": str(bus.get("routeId") or ""),
        "routeNumber": str(bus.get("routeNumber") or ""),
        "routeName": str(bus.get("routeName") or ""),
        "make": str(bus.get("make") or ""),
        "model": str(bus.get("model") or ""),
        "manufactureYear": bus.get("manufactureYear"),
        "seatingCapacity": bus.get("seatingCapacity"),
        "recordStatus": str(bus.get("recordStatus") or "active"),
        "operationalStatus": str(
            bus.get("operationalStatus") or "offline"
        ),
    }


def serialize_driver_bus_request(
    document: dict[str, Any],
) -> dict[str, Any]:
    return {
        "id": str(document.get("_id") or ""),
        "driverId": str(document.get("driverId") or ""),
        "driverName": str(document.get("driverName") or ""),
        "driverMobile": str(document.get("driverMobile") or ""),
        "driverNtcRegistrationNumber": str(
            document.get("driverNtcRegistrationNumber") or ""
        ),
        "requestType": str(document.get("requestType") or ""),
        "existingBusId": str(document.get("existingBusId") or ""),
        "approvedBusId": str(document.get("approvedBusId") or ""),
        "vehicleRegistrationNumber": str(
            document.get("vehicleRegistrationNumber") or ""
        ),
        "ntcPermitNumber": str(document.get("ntcPermitNumber") or ""),
        "operatorId": str(document.get("operatorId") or ""),
        "operatorName": str(document.get("operatorName") or ""),
        "depotId": str(document.get("depotId") or ""),
        "depotName": str(document.get("depotName") or ""),
        "serviceType": str(document.get("serviceType") or ""),
        "routeId": str(document.get("routeId") or ""),
        "routeNumber": str(document.get("routeNumber") or ""),
        "routeName": str(document.get("routeName") or ""),
        "make": str(document.get("make") or ""),
        "model": str(document.get("model") or ""),
        "manufactureYear": document.get("manufactureYear"),
        "seatingCapacity": document.get("seatingCapacity"),
        "notes": str(document.get("notes") or ""),
        "status": str(document.get("status") or "pending"),
        "requestRevision": int(document.get("requestRevision") or 1),
        "correctionFields": list(
            document.get("correctionFields") or []
        ),
        "correctionMessage": str(
            document.get("correctionMessage") or ""
        ),
        "rejectionReason": str(document.get("rejectionReason") or ""),
        "createdAt": _iso_value(document.get("createdAt")),
        "updatedAt": _iso_value(document.get("updatedAt")),
        "reviewedAt": _iso_value(document.get("reviewedAt")),
        "approvedAt": _iso_value(document.get("approvedAt")),
        "correctionRequestedAt": _iso_value(
            document.get("correctionRequestedAt")
        ),
        "rejectedAt": _iso_value(document.get("rejectedAt")),
    }


def _latest_driver_request(
    driver_id: str,
) -> dict[str, Any] | None:
    driver_object_id = _object_id(driver_id, field="driverId")
    return driver_bus_requests_collection.find_one(
        {
            "$or": [
                {"driverId": driver_object_id},
                {"driverId": str(driver_object_id)},
            ]
        },
        sort=[("updatedAt", -1), ("createdAt", -1)],
    )


def _verified_driver_bus(
    driver: dict[str, Any],
) -> dict[str, Any] | None:
    bus_id = driver.get("verifiedBusId")
    if bus_id is None:
        return None

    if isinstance(bus_id, ObjectId):
        return buses_collection.find_one({"_id": bus_id})

    if ObjectId.is_valid(str(bus_id)):
        return buses_collection.find_one({"_id": ObjectId(str(bus_id))})

    return None


def get_driver_onboarding_status(
    driver_id: str,
) -> dict[str, Any]:
    driver = _driver_document(driver_id)
    verification_status = str(
        driver.get("verificationStatus") or "pending"
    ).strip().lower()
    kyc_status = str(
        driver.get("kycStatus") or "NOT_SUBMITTED"
    ).strip().upper()

    latest_request = _latest_driver_request(driver_id)
    bus = _verified_driver_bus(driver)
    bus_verification_status = str(
        driver.get("busVerificationStatus") or "not_submitted"
    ).strip().lower()

    if verification_status == "blocked":
        next_step = "ACCOUNT_BLOCKED"
    elif verification_status == "rejected":
        next_step = "DRIVER_REJECTED"
    elif verification_status == "correction_required":
        next_step = "DRIVER_CORRECTION_REQUIRED"
    elif verification_status not in {"approved", "verified"}:
        next_step = "DRIVER_VERIFICATION_PENDING"
    elif bus_verification_status == "approved" and bus is not None:
        next_step = "READY_FOR_HOME"
    elif latest_request is None:
        next_step = "BUS_REGISTRATION_REQUIRED"
    else:
        request_status = str(
            latest_request.get("status") or "pending"
        ).strip().lower()
        next_step = {
            "pending": "BUS_REQUEST_PENDING",
            "under_review": "BUS_REQUEST_PENDING",
            "correction_required": "BUS_CORRECTION_REQUIRED",
            "rejected": "BUS_REQUEST_REJECTED",
            "approved": "BUS_REGISTRATION_REQUIRED",
        }.get(request_status, "BUS_REGISTRATION_REQUIRED")

    operator_name = ""
    depot_name = ""
    if bus:
        operator_id = bus.get("operatorId")
        depot_id = bus.get("depotId")
        if isinstance(operator_id, ObjectId):
            operator = operators_collection.find_one(
                {"_id": operator_id},
                {"name": 1},
            )
            operator_name = str((operator or {}).get("name") or "")
        if isinstance(depot_id, ObjectId):
            depot = depots_collection.find_one(
                {"_id": depot_id},
                {"name": 1},
            )
            depot_name = str((depot or {}).get("name") or "")

    return {
        "status": "success",
        "driverId": str(driver.get("_id") or ""),
        "driverVerificationStatus": verification_status,
        "kycStatus": kyc_status,
        "busVerificationStatus": bus_verification_status,
        "nextStep": next_step,
        "verifiedBus": _serialize_bus(
            bus,
            operator_name=operator_name,
            depot_name=depot_name,
        ),
        "busRequest": (
            serialize_driver_bus_request(latest_request)
            if latest_request
            else None
        ),
    }


def get_driver_bus_request(
    driver_id: str,
) -> dict[str, Any] | None:
    _driver_document(driver_id)
    document = _latest_driver_request(driver_id)
    return serialize_driver_bus_request(document) if document else None


def get_driver_bus_references() -> dict[str, Any]:
    operators = list(
        operators_collection.find(
            {"isActive": {"$ne": False}},
            {"name": 1, "code": 1},
        ).sort("name", 1)
    )

    operator_ids = [operator["_id"] for operator in operators]
    depots = list(
        depots_collection.find(
            {
                "isActive": {"$ne": False},
                "operatorId": {"$in": operator_ids},
            },
            {"operatorId": 1, "name": 1, "code": 1, "district": 1},
        ).sort("name", 1)
    )

    routes = list_route_records(status="active")

    return {
        "status": "success",
        "operators": [
            {
                "id": str(operator["_id"]),
                "name": str(operator.get("name") or ""),
                "code": str(operator.get("code") or ""),
            }
            for operator in operators
        ],
        "depots": [
            {
                "id": str(depot["_id"]),
                "operatorId": str(depot.get("operatorId") or ""),
                "name": str(depot.get("name") or ""),
                "code": str(depot.get("code") or ""),
                "district": str(depot.get("district") or ""),
            }
            for depot in depots
        ],
        "serviceTypes": sorted(SERVICE_TYPES),
        "routes": [
            {
                "id": route["id"],
                "routeNumber": route["routeNumber"],
                "name": route["name"],
                "origin": route["origin"],
                "destination": route["destination"],
                "depotName": str(route.get("depotName") or ""),
                "serviceCategories": [
                    category
                    for category in route.get("serviceCategories", [])
                    if category in SERVICE_TYPES
                ],
            }
            for route in routes
        ],
    }


def submit_driver_bus_request(
    driver_id: str,
    payload: Any,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise DriverBusRequestError(
            "A JSON bus request payload is required"
        )

    driver = _driver_document(driver_id)
    verification_status = str(
        driver.get("verificationStatus") or "pending"
    ).strip().lower()
    if verification_status in {"blocked", "rejected"}:
        raise DriverBusRequestError(
            "This driver account cannot submit a bus request",
            code="DRIVER_CANNOT_SUBMIT_BUS_REQUEST",
            status=403,
        )

    verified_bus = _verified_driver_bus(driver)
    if (
        str(driver.get("busVerificationStatus") or "").lower()
        == "approved"
        and verified_bus is not None
    ):
        raise DriverBusRequestError(
            "A bus is already verified for this driver",
            code="DRIVER_ALREADY_HAS_VERIFIED_BUS",
            status=409,
        )

    vehicle_registration_number = _clean_text(
        payload.get("vehicleRegistrationNumber"),
        max_length=30,
    ).upper()
    vehicle_registration_key = _identity_key(
        vehicle_registration_number
    )
    if not vehicle_registration_key:
        raise DriverBusRequestError(
            "Vehicle registration number is required",
            field="vehicleRegistrationNumber",
        )

    operator, depot = _active_depot_with_operator(
        payload.get("depotId"),
    )
    service_type, route = _route_assignment(
        service_type=payload.get("serviceType"),
        depot=depot,
        route_id=payload.get("routeId"),
    )

    ntc_permit_number = _clean_text(
        payload.get("ntcPermitNumber"),
        max_length=80,
    ).upper()
    manufacture_year = _optional_positive_int(
        payload.get("manufactureYear"),
        field="manufactureYear",
        minimum=1950,
        maximum=datetime.now(timezone.utc).year + 1,
    )
    seating_capacity = _optional_positive_int(
        payload.get("seatingCapacity"),
        field="seatingCapacity",
        minimum=1,
        maximum=120,
    )

    existing_bus = _find_bus_by_registration(
        vehicle_registration_number
    )
    request_type = (
        "existing_bus_claim"
        if existing_bus
        else "new_bus_registration"
    )

    current_request = _latest_driver_request(driver_id)
    if current_request:
        current_status = str(
            current_request.get("status") or "pending"
        ).strip().lower()
        if current_status in {"pending", "under_review"}:
            raise DriverBusRequestError(
                "A bus request is already awaiting admin review",
                code="BUS_REQUEST_ALREADY_PENDING",
                status=409,
            )
        if current_status == "approved":
            raise DriverBusRequestError(
                "The previous bus request is already approved",
                code="BUS_REQUEST_ALREADY_APPROVED",
                status=409,
            )

    conflicting_request = driver_bus_requests_collection.find_one({
        "openVehicleKey": vehicle_registration_key,
        "driverId": {"$ne": driver["_id"]},
        "status": {"$in": list(OPEN_BUS_REQUEST_STATUSES)},
    })
    if conflicting_request:
        raise DriverBusRequestError(
            "Another driver already has an open request for this vehicle",
            field="vehicleRegistrationNumber",
            code="VEHICLE_HAS_OPEN_REQUEST",
            status=409,
        )

    now = datetime.now(timezone.utc)
    request_revision = (
        int(current_request.get("requestRevision") or 1) + 1
        if current_request
        else 1
    )
    request_fields: dict[str, Any] = {
        "driverId": driver["_id"],
        "driverName": str(
            driver.get("fullName") or driver.get("name") or ""
        ),
        "driverMobile": str(driver.get("mobile") or ""),
        "driverNtcRegistrationNumber": str(
            driver.get("driverNtcRegistrationNumber") or ""
        ),
        "requestType": request_type,
        "existingBusId": existing_bus.get("_id") if existing_bus else None,
        "vehicleRegistrationNumber": vehicle_registration_number,
        "vehicleRegistrationKey": vehicle_registration_key,
        "ntcPermitNumber": ntc_permit_number,
        "ntcPermitKey": (
            _identity_key(ntc_permit_number)
            if ntc_permit_number
            else ""
        ),
        "operatorId": operator["_id"],
        "operatorName": str(operator.get("name") or ""),
        "depotId": depot["_id"],
        "depotName": str(depot.get("name") or ""),
        "serviceType": service_type,
        "routeId": ObjectId(route["id"]),
        "routeNumber": str(route.get("routeNumber") or ""),
        "routeName": str(route.get("name") or ""),
        "make": _clean_text(payload.get("make"), max_length=80),
        "model": _clean_text(payload.get("model"), max_length=80),
        "manufactureYear": manufacture_year,
        "seatingCapacity": seating_capacity,
        "notes": _clean_text(payload.get("notes"), max_length=1000),
        "status": "pending",
        "requestRevision": request_revision,
        "openDriverKey": str(driver["_id"]),
        "openVehicleKey": vehicle_registration_key,
        "submittedAt": now,
        "updatedAt": now,
    }

    unset_fields = {
        "scheduleTemplateId": "",
        "departureTime": "",
        "operatingDays": "",
        "reviewedAt": "",
        "reviewedBy": "",
        "approvedAt": "",
        "approvedBy": "",
        "approvedBusId": "",
        "correctionFields": "",
        "correctionMessage": "",
        "correctionRequestedAt": "",
        "correctionRequestedBy": "",
        "rejectionReason": "",
        "rejectedAt": "",
        "rejectedBy": "",
    }

    try:
        if current_request and str(
            current_request.get("status") or ""
        ).lower() in {"correction_required", "rejected"}:
            result = driver_bus_requests_collection.update_one(
                {
                    "_id": current_request["_id"],
                    "status": current_request.get("status"),
                },
                {
                    "$set": request_fields,
                    "$unset": unset_fields,
                },
            )
            if result.matched_count != 1:
                raise DriverBusRequestError(
                    "The bus request changed; reload and submit again",
                    code="BUS_REQUEST_STALE",
                    status=409,
                )
            document = driver_bus_requests_collection.find_one(
                {"_id": current_request["_id"]}
            )
        else:
            request_fields.update({
                "createdAt": now,
            })
            result = driver_bus_requests_collection.insert_one(
                request_fields
            )
            document = {
                **request_fields,
                "_id": result.inserted_id,
            }
    except DuplicateKeyError as error:
        raise DriverBusRequestError(
            "A bus request with the same driver or vehicle is already open",
            code="DUPLICATE_OPEN_BUS_REQUEST",
            status=409,
        ) from error

    drivers_collection.update_one(
        {"_id": driver["_id"]},
        {
            "$set": {
                "busVerificationStatus": "pending",
                "busRequestId": document["_id"],
                "updatedAt": now,
            },
            "$unset": {
                "busCorrectionMessage": "",
                "busRejectionReason": "",
            },
        },
    )

    return serialize_driver_bus_request(document)


def list_driver_bus_requests(
    *,
    status: str = "",
    query: str = "",
) -> list[dict[str, Any]]:
    mongo_query: dict[str, Any] = {}

    normalized_status = status.strip().lower()
    if normalized_status:
        if normalized_status not in BUS_REQUEST_STATUSES:
            raise DriverBusRequestError(
                "Invalid bus request status",
                field="status",
            )
        mongo_query["status"] = normalized_status

    normalized_query = query.strip()
    if normalized_query:
        escaped = re.escape(normalized_query[:80])
        mongo_query["$or"] = [
            {"driverName": {"$regex": escaped, "$options": "i"}},
            {"driverMobile": {"$regex": escaped, "$options": "i"}},
            {
                "driverNtcRegistrationNumber": {
                    "$regex": escaped,
                    "$options": "i",
                }
            },
            {
                "vehicleRegistrationNumber": {
                    "$regex": escaped,
                    "$options": "i",
                }
            },
            {"ntcPermitNumber": {"$regex": escaped, "$options": "i"}},
            {"operatorName": {"$regex": escaped, "$options": "i"}},
            {"depotName": {"$regex": escaped, "$options": "i"}},
        ]

    documents = driver_bus_requests_collection.find(
        mongo_query
    ).sort([
        ("status", 1),
        ("updatedAt", -1),
        ("createdAt", -1),
    ])

    return [
        serialize_driver_bus_request(document)
        for document in documents
    ]


def get_admin_driver_bus_request(
    request_id: str,
) -> dict[str, Any]:
    return serialize_driver_bus_request(
        _request_document(request_id)
    )


def update_admin_driver_bus_request(
    request_id: str,
    payload: Any,
    *,
    actor: str,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise DriverBusRequestError(
            "A JSON bus request payload is required"
        )

    document = _request_document(request_id)
    current_status = str(
        document.get("status") or "pending"
    ).strip().lower()
    if current_status not in ADMIN_EDITABLE_BUS_REQUEST_STATUSES:
        raise DriverBusRequestError(
            "This bus request cannot be edited",
            code="BUS_REQUEST_EDIT_NOT_ALLOWED",
            status=409,
        )

    vehicle_registration_number = _clean_text(
        payload.get("vehicleRegistrationNumber"),
        max_length=30,
    ).upper()
    vehicle_registration_key = _identity_key(
        vehicle_registration_number
    )
    if not vehicle_registration_key:
        raise DriverBusRequestError(
            "Vehicle registration number is required",
            field="vehicleRegistrationNumber",
        )

    operator, depot = _active_depot_with_operator(
        payload.get("depotId"),
    )
    service_type, route = _route_assignment(
        service_type=payload.get("serviceType"),
        depot=depot,
        route_id=payload.get("routeId"),
    )

    manufacture_year = _optional_positive_int(
        payload.get("manufactureYear"),
        field="manufactureYear",
        minimum=1950,
        maximum=datetime.now(timezone.utc).year + 1,
    )
    seating_capacity = _optional_positive_int(
        payload.get("seatingCapacity"),
        field="seatingCapacity",
        minimum=1,
        maximum=120,
    )
    ntc_permit_number = _clean_text(
        payload.get("ntcPermitNumber"),
        max_length=80,
    ).upper()

    existing_bus = _find_bus_by_registration(
        vehicle_registration_number
    )
    approved_bus = None
    if current_status == "approved":
        approved_bus_id = document.get("approvedBusId")
        if isinstance(approved_bus_id, ObjectId):
            approved_bus = buses_collection.find_one({"_id": approved_bus_id})
        elif ObjectId.is_valid(str(approved_bus_id or "")):
            approved_bus = buses_collection.find_one({
                "_id": ObjectId(str(approved_bus_id)),
            })
        if not approved_bus:
            raise DriverBusRequestError(
                "The approved bus linked to this request was not found",
                code="APPROVED_BUS_NOT_FOUND",
                status=409,
            )
        if existing_bus and existing_bus["_id"] != approved_bus["_id"]:
            raise DriverBusRequestError(
                "Another bus already uses this registration number",
                field="vehicleRegistrationNumber",
                code="BUS_IDENTITY_CONFLICT",
                status=409,
            )
        request_type = str(
            document.get("requestType") or "new_bus_registration"
        )
        request_existing_bus_id = document.get("existingBusId")
    else:
        request_type = (
            "existing_bus_claim"
            if existing_bus
            else "new_bus_registration"
        )
        request_existing_bus_id = (
            existing_bus.get("_id") if existing_bus else None
        )

    conflicting_request = driver_bus_requests_collection.find_one({
        "_id": {"$ne": document["_id"]},
        "openVehicleKey": vehicle_registration_key,
        "status": {"$in": list(OPEN_BUS_REQUEST_STATUSES)},
    })
    if conflicting_request:
        raise DriverBusRequestError(
            "Another driver already has an open request for this vehicle",
            field="vehicleRegistrationNumber",
            code="VEHICLE_HAS_OPEN_REQUEST",
            status=409,
        )

    next_status = (
        "under_review"
        if current_status in {"correction_required", "rejected"}
        else current_status
    )
    now = datetime.now(timezone.utc)
    next_revision = int(document.get("requestRevision") or 1) + 1
    fields = {
        "requestType": request_type,
        "existingBusId": request_existing_bus_id,
        "vehicleRegistrationNumber": vehicle_registration_number,
        "vehicleRegistrationKey": vehicle_registration_key,
        "ntcPermitNumber": ntc_permit_number,
        "ntcPermitKey": (
            _identity_key(ntc_permit_number)
            if ntc_permit_number
            else ""
        ),
        "operatorId": operator["_id"],
        "operatorName": str(operator.get("name") or ""),
        "depotId": depot["_id"],
        "depotName": str(depot.get("name") or ""),
        "serviceType": service_type,
        "routeId": ObjectId(route["id"]),
        "routeNumber": str(route.get("routeNumber") or ""),
        "routeName": str(route.get("name") or ""),
        "make": _clean_text(payload.get("make"), max_length=80),
        "model": _clean_text(payload.get("model"), max_length=80),
        "manufactureYear": manufacture_year,
        "seatingCapacity": seating_capacity,
        "notes": _clean_text(payload.get("notes"), max_length=1000),
        "status": next_status,
        "requestRevision": next_revision,
        "updatedAt": now,
        "updatedBy": actor,
    }
    if current_status != "approved":
        fields.update({
            "openDriverKey": str(document.get("driverId") or ""),
            "openVehicleKey": vehicle_registration_key,
        })

    unset_fields = {
        "correctionFields": "",
        "correctionMessage": "",
        "correctionRequestedAt": "",
        "correctionRequestedBy": "",
        "rejectionReason": "",
        "rejectedAt": "",
        "rejectedBy": "",
        "scheduleTemplateId": "",
        "departureTime": "",
        "operatingDays": "",
    }
    if current_status == "approved":
        unset_fields.update({
            "openDriverKey": "",
            "openVehicleKey": "",
        })
    else:
        unset_fields.update({
            "approvedAt": "",
            "approvedBy": "",
            "approvedBusId": "",
        })

    try:
        result = driver_bus_requests_collection.update_one(
            {
                "_id": document["_id"],
                "status": document.get("status"),
                "requestRevision": document.get("requestRevision"),
            },
            {
                "$set": fields,
                "$unset": unset_fields,
            },
        )
    except DuplicateKeyError as error:
        raise DriverBusRequestError(
            "A bus request with the same driver or vehicle is already open",
            code="DUPLICATE_OPEN_BUS_REQUEST",
            status=409,
        ) from error

    if result.matched_count != 1:
        raise DriverBusRequestError(
            "The bus request changed; reload before saving",
            code="BUS_REQUEST_STALE",
            status=409,
        )

    if approved_bus is not None:
        bus_set_fields = {
            "bus_id": vehicle_registration_number,
            "vehicleRegistrationNumber": vehicle_registration_number,
            "vehicleRegistrationKey": vehicle_registration_key,
            "trackingKey": vehicle_registration_key,
            "ntcPermitNumber": ntc_permit_number,
            "operatorId": operator["_id"],
            "depotId": depot["_id"],
            "serviceType": service_type,
            "routeId": ObjectId(route["id"]),
            "routeNumber": str(route.get("routeNumber") or ""),
            "routeName": str(route.get("name") or ""),
            "make": _clean_text(payload.get("make"), max_length=80),
            "model": _clean_text(payload.get("model"), max_length=80),
            "manufactureYear": manufacture_year,
            "seatingCapacity": seating_capacity,
            "notes": _clean_text(payload.get("notes"), max_length=1000),
            "updatedAt": now,
            "updatedBy": actor,
        }
        bus_update: dict[str, Any] = {
            "$set": bus_set_fields,
            "$unset": {
                "scheduleTemplateId": "",
                "departureTime": "",
            },
        }
        if ntc_permit_number:
            bus_set_fields["ntcPermitKey"] = _identity_key(
                ntc_permit_number
            )
        else:
            bus_update["$unset"]["ntcPermitKey"] = ""

        buses_collection.update_one(
            {"_id": approved_bus["_id"]},
            bus_update,
        )
        drivers_collection.update_one(
            {
                "_id": document.get("driverId"),
                "verifiedBusId": approved_bus["_id"],
            },
            {
                "$set": {
                    "vehicleRegistrationNumber": vehicle_registration_number,
                    "busNtcPermitNumber": ntc_permit_number,
                    "busRouteId": ObjectId(route["id"]),
                    "busRouteNumber": str(route.get("routeNumber") or ""),
                    "busRouteName": str(route.get("name") or ""),
                    "busServiceType": service_type,
                    "updatedAt": now,
                },
                "$unset": {
                    "busScheduleTemplateId": "",
                    "busDepartureTime": "",
                },
            },
        )
    else:
        drivers_collection.update_one(
            {"_id": document.get("driverId")},
            {
                "$set": {
                    "busVerificationStatus": "pending",
                    "busRequestId": document["_id"],
                    "updatedAt": now,
                },
                "$unset": {
                    "busCorrectionMessage": "",
                    "busRejectionReason": "",
                },
            },
        )

    updated = driver_bus_requests_collection.find_one(
        {"_id": document["_id"]}
    )
    return serialize_driver_bus_request(updated)


def delete_admin_driver_bus_request(
    request_id: str,
    *,
    actor: str,
) -> str:
    document = _request_document(request_id)
    current_status = str(
        document.get("status") or "pending"
    ).strip().lower()
    if current_status not in ADMIN_DELETABLE_BUS_REQUEST_STATUSES:
        raise DriverBusRequestError(
            "This bus request cannot be deleted",
            code="BUS_REQUEST_DELETE_NOT_ALLOWED",
            status=409,
        )

    result = driver_bus_requests_collection.delete_one({
        "_id": document["_id"],
        "status": document.get("status"),
        "requestRevision": document.get("requestRevision"),
    })
    if result.deleted_count != 1:
        raise DriverBusRequestError(
            "The bus request changed; reload before deleting",
            code="BUS_REQUEST_STALE",
            status=409,
        )

    now = datetime.now(timezone.utc)
    driver_set_fields = {
        "busRequestDeletedAt": now,
        "busRequestDeletedBy": actor,
        "updatedAt": now,
    }
    driver_query: dict[str, Any] = {
        "_id": document.get("driverId"),
        "busRequestId": document["_id"],
    }
    if current_status != "approved":
        driver_query["$or"] = [
            {"verifiedBusId": {"$exists": False}},
            {"verifiedBusId": None},
        ]
        driver_set_fields["busVerificationStatus"] = "not_submitted"

    drivers_collection.update_one(
        driver_query,
        {
            "$set": driver_set_fields,
            "$unset": {
                "busRequestId": "",
                "busCorrectionMessage": "",
                "busRejectionReason": "",
            },
        },
    )
    return str(document["_id"])


def start_driver_bus_request_review(
    request_id: str,
    *,
    actor: str,
) -> dict[str, Any]:
    document = _request_document(request_id)
    status = str(document.get("status") or "pending").lower()

    if status == "under_review":
        return serialize_driver_bus_request(document)

    if status != "pending":
        raise DriverBusRequestError(
            "Only a pending bus request can be moved to under review",
            code="BUS_REQUEST_REVIEW_NOT_ALLOWED",
            status=409,
        )

    now = datetime.now(timezone.utc)
    result = driver_bus_requests_collection.update_one(
        {
            "_id": document["_id"],
            "status": "pending",
            "requestRevision": document.get("requestRevision"),
        },
        {
            "$set": {
                "status": "under_review",
                "reviewedAt": now,
                "reviewedBy": actor,
                "updatedAt": now,
            }
        },
    )
    if result.matched_count != 1:
        raise DriverBusRequestError(
            "The bus request changed; reload before reviewing",
            code="BUS_REQUEST_STALE",
            status=409,
        )

    updated = driver_bus_requests_collection.find_one(
        {"_id": document["_id"]}
    )
    return serialize_driver_bus_request(updated)


def request_driver_bus_correction(
    request_id: str,
    *,
    actor: str,
    fields: Any,
    message: Any,
) -> dict[str, Any]:
    document = _request_document(request_id)
    if str(document.get("status") or "").lower() != "under_review":
        raise DriverBusRequestError(
            "The bus request must be under review before requesting corrections",
            code="BUS_REQUEST_REVIEW_REQUIRED",
            status=409,
        )

    if not isinstance(fields, list):
        raise DriverBusRequestError(
            "fields must be a list",
            field="fields",
        )

    correction_fields = sorted({
        str(field or "").strip()
        for field in fields
        if str(field or "").strip()
    })
    invalid_fields = [
        field
        for field in correction_fields
        if field not in CORRECTABLE_BUS_FIELDS
    ]
    if not correction_fields:
        raise DriverBusRequestError(
            "Select at least one field that requires correction",
            field="fields",
        )
    if invalid_fields:
        raise DriverBusRequestError(
            "One or more correction fields are invalid",
            field="fields",
            details={
                "invalidFields": invalid_fields,
                "allowedFields": sorted(CORRECTABLE_BUS_FIELDS),
            },
        )

    correction_message = _clean_text(message, max_length=1000)
    if not correction_message:
        raise DriverBusRequestError(
            "A correction message is required",
            field="message",
        )

    now = datetime.now(timezone.utc)
    result = driver_bus_requests_collection.update_one(
        {
            "_id": document["_id"],
            "status": "under_review",
            "requestRevision": document.get("requestRevision"),
        },
        {
            "$set": {
                "status": "correction_required",
                "correctionFields": correction_fields,
                "correctionMessage": correction_message,
                "correctionRequestedAt": now,
                "correctionRequestedBy": actor,
                "updatedAt": now,
            }
        },
    )
    if result.matched_count != 1:
        raise DriverBusRequestError(
            "The bus request changed; reload before requesting corrections",
            code="BUS_REQUEST_STALE",
            status=409,
        )

    drivers_collection.update_one(
        {"_id": document.get("driverId")},
        {
            "$set": {
                "busVerificationStatus": "correction_required",
                "busCorrectionMessage": correction_message,
                "updatedAt": now,
            }
        },
    )

    updated = driver_bus_requests_collection.find_one(
        {"_id": document["_id"]}
    )
    return serialize_driver_bus_request(updated)


def reject_driver_bus_request(
    request_id: str,
    *,
    actor: str,
    reason: Any,
) -> dict[str, Any]:
    document = _request_document(request_id)
    if str(document.get("status") or "").lower() != "under_review":
        raise DriverBusRequestError(
            "The bus request must be under review before rejection",
            code="BUS_REQUEST_REVIEW_REQUIRED",
            status=409,
        )

    rejection_reason = _clean_text(reason, max_length=1000)
    if not rejection_reason:
        raise DriverBusRequestError(
            "A rejection reason is required",
            field="reason",
        )

    now = datetime.now(timezone.utc)
    result = driver_bus_requests_collection.update_one(
        {
            "_id": document["_id"],
            "status": "under_review",
            "requestRevision": document.get("requestRevision"),
        },
        {
            "$set": {
                "status": "rejected",
                "rejectionReason": rejection_reason,
                "rejectedAt": now,
                "rejectedBy": actor,
                "updatedAt": now,
            },
            "$unset": {
                "openDriverKey": "",
                "openVehicleKey": "",
            },
        },
    )
    if result.matched_count != 1:
        raise DriverBusRequestError(
            "The bus request changed; reload before rejection",
            code="BUS_REQUEST_STALE",
            status=409,
        )

    drivers_collection.update_one(
        {"_id": document.get("driverId")},
        {
            "$set": {
                "busVerificationStatus": "rejected",
                "busRejectionReason": rejection_reason,
                "updatedAt": now,
            },
            "$unset": {
                "busCorrectionMessage": "",
            },
        },
    )

    updated = driver_bus_requests_collection.find_one(
        {"_id": document["_id"]}
    )
    return serialize_driver_bus_request(updated)


def _create_bus_from_request(
    document: dict[str, Any],
    *,
    actor: str,
) -> dict[str, Any]:
    operator, depot = _operator_and_depot(
        document.get("operatorId"),
        document.get("depotId"),
        require_active=True,
    )

    vehicle_registration_number = str(
        document.get("vehicleRegistrationNumber") or ""
    ).strip().upper()
    vehicle_registration_key = _identity_key(
        vehicle_registration_number
    )
    if not vehicle_registration_key:
        raise DriverBusRequestError(
            "The bus request does not contain a valid registration number",
            field="vehicleRegistrationNumber",
        )

    existing_bus = _find_bus_by_registration(
        vehicle_registration_number
    )
    if existing_bus:
        return existing_bus

    ntc_permit_number = str(
        document.get("ntcPermitNumber") or ""
    ).strip().upper()
    now = datetime.now(timezone.utc)
    bus: dict[str, Any] = {
        "bus_id": vehicle_registration_number,
        "vehicleRegistrationNumber": vehicle_registration_number,
        "vehicleRegistrationKey": vehicle_registration_key,
        "trackingKey": vehicle_registration_key,
        "ntcPermitNumber": ntc_permit_number,
        "operatorId": operator["_id"],
        "depotId": depot["_id"],
        "serviceType": str(document.get("serviceType") or ""),
        "routeId": document.get("routeId"),
        "routeNumber": str(document.get("routeNumber") or ""),
        "routeName": str(document.get("routeName") or ""),
        "make": str(document.get("make") or ""),
        "model": str(document.get("model") or ""),
        "manufactureYear": document.get("manufactureYear"),
        "seatingCapacity": document.get("seatingCapacity"),
        "recordStatus": "active",
        "notes": str(document.get("notes") or ""),
        "operationalStatus": "offline",
        "isActive": False,
        "statusUpdatedAt": now,
        "createdAt": now,
        "createdBy": actor,
        "updatedAt": now,
        "updatedBy": actor,
    }
    if ntc_permit_number:
        bus["ntcPermitKey"] = _identity_key(ntc_permit_number)

    try:
        result = buses_collection.insert_one(bus)
    except DuplicateKeyError:
        existing_bus = _find_bus_by_registration(
            vehicle_registration_number
        )
        if existing_bus:
            return existing_bus
        raise DriverBusRequestError(
            "A bus with the same registration or permit already exists",
            code="BUS_IDENTITY_CONFLICT",
            status=409,
        )

    bus["_id"] = result.inserted_id
    return bus


def approve_driver_bus_request(
    request_id: str,
    *,
    actor: str,
) -> dict[str, Any]:
    document = _request_document(request_id)
    if str(document.get("status") or "").lower() != "under_review":
        raise DriverBusRequestError(
            "The bus request must be under review before approval",
            code="BUS_REQUEST_REVIEW_REQUIRED",
            status=409,
        )

    driver_id = document.get("driverId")
    if not isinstance(driver_id, ObjectId):
        driver_id = _object_id(driver_id, field="driverId")

    driver = drivers_collection.find_one({"_id": driver_id})
    if not driver:
        raise DriverBusRequestError(
            "Driver not found",
            code="DRIVER_NOT_FOUND",
            status=404,
        )

    verification_status = str(
        driver.get("verificationStatus") or "pending"
    ).strip().lower()
    if verification_status not in {"approved", "verified"}:
        raise DriverBusRequestError(
            "Approve the driver KYC before approving the bus request",
            code="DRIVER_APPROVAL_REQUIRED",
            status=409,
        )

    operator, depot = _operator_and_depot(
        document.get("operatorId"),
        document.get("depotId"),
        require_active=True,
    )
    service_type, route = _route_assignment(
        service_type=document.get("serviceType"),
        depot=depot,
        route_id=document.get("routeId"),
    )

    existing_verified_bus_id = driver.get("verifiedBusId")

    bus: dict[str, Any] | None = None
    existing_bus_id = document.get("existingBusId")
    if isinstance(existing_bus_id, ObjectId):
        bus = buses_collection.find_one({"_id": existing_bus_id})
    elif ObjectId.is_valid(str(existing_bus_id or "")):
        bus = buses_collection.find_one(
            {"_id": ObjectId(str(existing_bus_id))}
        )

    if bus is None:
        bus = _create_bus_from_request(document, actor=actor)

    if str(bus.get("recordStatus") or "active").lower() != "active":
        raise DriverBusRequestError(
            "The selected bus master record is not active",
            code="BUS_MASTER_INACTIVE",
            status=409,
        )

    now = datetime.now(timezone.utc)
    bus_registration = str(
        bus.get("vehicleRegistrationNumber")
        or bus.get("bus_id")
        or ""
    )
    bus_permit = str(bus.get("ntcPermitNumber") or "")

    buses_collection.update_one(
        {"_id": bus["_id"]},
        {
            "$set": {
                "operatorId": operator["_id"],
                "depotId": depot["_id"],
                "serviceType": service_type,
                "routeId": ObjectId(route["id"]),
                "routeNumber": str(route.get("routeNumber") or ""),
                "routeName": str(route.get("name") or ""),
                "updatedAt": now,
                "updatedBy": actor,
            },
            "$unset": {
                "scheduleTemplateId": "",
                "departureTime": "",
            },
        },
    )

    driver_assignment_query: dict[str, Any] = {"_id": driver_id}
    if existing_verified_bus_id:
        driver_assignment_query["verifiedBusId"] = existing_verified_bus_id
    else:
        driver_assignment_query["$or"] = [
                {"verifiedBusId": {"$exists": False}},
                {"verifiedBusId": None},
            ]

    driver_result = drivers_collection.update_one(
        driver_assignment_query,
        {
            "$set": {
                "verifiedBusId": bus["_id"],
                "busVerificationStatus": "approved",
                "busRequestId": document["_id"],
                "vehicleRegistrationNumber": bus_registration,
                "busNtcPermitNumber": bus_permit,
                "busRouteId": ObjectId(route["id"]),
                "busRouteNumber": str(route.get("routeNumber") or ""),
                "busRouteName": str(route.get("name") or ""),
                "busServiceType": service_type,
                "busVerifiedAt": now,
                "busVerifiedBy": actor,
                "updatedAt": now,
            },
            "$unset": {
                "busScheduleTemplateId": "",
                "busDepartureTime": "",
                "busCorrectionMessage": "",
                "busRejectionReason": "",
            },
        },
    )
    if driver_result.matched_count != 1:
        raise DriverBusRequestError(
            "The driver's verified bus changed; reload before approval",
            code="DRIVER_BUS_LINK_STALE",
            status=409,
        )

    if (
        existing_verified_bus_id
        and str(existing_verified_bus_id) != str(bus["_id"])
    ):
        previous_bus_query = (
            {"_id": existing_verified_bus_id}
            if isinstance(existing_verified_bus_id, ObjectId)
            else {
                "_id": ObjectId(str(existing_verified_bus_id))
            }
            if ObjectId.is_valid(str(existing_verified_bus_id))
            else None
        )
        if previous_bus_query:
            buses_collection.update_one(
                previous_bus_query,
                {
                    "$pull": {"verifiedDriverIds": driver_id},
                    "$set": {
                        "updatedAt": now,
                        "updatedBy": actor,
                    },
                },
            )

    buses_collection.update_one(
        {"_id": bus["_id"]},
        {
            "$addToSet": {
                "verifiedDriverIds": driver_id,
            },
            "$set": {
                "updatedAt": now,
                "updatedBy": actor,
            },
        },
    )

    request_result = driver_bus_requests_collection.update_one(
        {
            "_id": document["_id"],
            "status": "under_review",
            "requestRevision": document.get("requestRevision"),
        },
        {
            "$set": {
                "status": "approved",
                "approvedBusId": bus["_id"],
                "approvedAt": now,
                "approvedBy": actor,
                "updatedAt": now,
            },
            "$unset": {
                "openDriverKey": "",
                "openVehicleKey": "",
                "scheduleTemplateId": "",
                "departureTime": "",
                "operatingDays": "",
                "correctionFields": "",
                "correctionMessage": "",
                "rejectionReason": "",
            },
        },
    )
    if request_result.matched_count != 1:
        raise DriverBusRequestError(
            "The bus request changed during approval; reload its latest status",
            code="BUS_REQUEST_STALE",
            status=409,
        )

    updated = driver_bus_requests_collection.find_one(
        {"_id": document["_id"]}
    )
    return serialize_driver_bus_request(updated)
