import re
from datetime import date, datetime, timezone
from typing import Any

from bson.objectid import ObjectId
from pymongo.errors import DuplicateKeyError

from config import buses_collection, drivers_collection
from services.route_service import get_route_admin_details, list_route_records


database = buses_collection.database
schedule_templates_collection = database["schedule_templates"]
daily_services_collection = database["daily_services"]
operators_collection = database["operators"]
depots_collection = database["depots"]

SERVICE_TYPES = {"sltb", "private", "intercity"}
SCHEDULE_STATUSES = {"active", "inactive"}
DAILY_SERVICE_STATUSES = {
    "scheduled",
    "cancelled",
    "in_progress",
    "completed",
}
EDITABLE_DAILY_SERVICE_STATUSES = {"scheduled", "cancelled"}
OPERATING_DAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ScheduleValidationError(ValueError):
    def __init__(
        self,
        message: str,
        *,
        field: str = "",
        code: str = "INVALID_SCHEDULE",
        status: int = 400,
    ):
        super().__init__(message)
        self.message = message
        self.field = field
        self.code = code
        self.status = status


def _iso_value(value: Any) -> str:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return str(value) if value else ""


def _clean_text(value: Any, *, max_length: int) -> str:
    return str(value or "").strip()[:max_length]


def _object_id(value: Any, *, field: str) -> ObjectId:
    raw = str(value or "").strip()
    if not ObjectId.is_valid(raw):
        raise ScheduleValidationError(
            f"A valid {field} is required",
            field=field,
        )
    return ObjectId(raw)


def _normalize_time(value: Any) -> str:
    normalized = str(value or "").strip()
    if not TIME_PATTERN.fullmatch(normalized):
        raise ScheduleValidationError(
            "departureTime must use 24-hour HH:MM format",
            field="departureTime",
        )
    return normalized


def _normalize_date(value: Any) -> tuple[str, date]:
    normalized = str(value or "").strip()
    if not DATE_PATTERN.fullmatch(normalized):
        raise ScheduleValidationError(
            "serviceDate must use YYYY-MM-DD format",
            field="serviceDate",
        )
    try:
        parsed = datetime.strptime(normalized, "%Y-%m-%d").date()
    except ValueError as error:
        raise ScheduleValidationError(
            "serviceDate is not a valid calendar date",
            field="serviceDate",
        ) from error
    return normalized, parsed


def _normalize_service_type(value: Any) -> str:
    service_type = str(value or "").strip().lower()
    if service_type not in SERVICE_TYPES:
        raise ScheduleValidationError(
            "serviceType must be SLTB, Private or Intercity",
            field="serviceType",
        )
    return service_type


def _normalize_schedule_status(value: Any) -> str:
    status = str(value or "active").strip().lower()
    if status not in SCHEDULE_STATUSES:
        raise ScheduleValidationError(
            "recordStatus must be active or inactive",
            field="recordStatus",
        )
    return status


def _normalize_operating_days(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise ScheduleValidationError(
            "operatingDays must be a list",
            field="operatingDays",
        )

    normalized: list[str] = []
    for raw_day in value:
        day = str(raw_day or "").strip().lower()
        if day not in OPERATING_DAYS:
            raise ScheduleValidationError(
                "One or more operating days are invalid",
                field="operatingDays",
            )
        if day not in normalized:
            normalized.append(day)

    if not normalized:
        raise ScheduleValidationError(
            "Select at least one operating day",
            field="operatingDays",
        )

    return [day for day in OPERATING_DAYS if day in normalized]


def _schedule_template_key(
    route_id: str,
    service_type: str,
    departure_time: str,
) -> str:
    return f"{route_id}:{service_type}:{departure_time}"


def _daily_service_key(
    service_date: str,
    route_id: str,
    service_type: str,
    departure_time: str,
) -> str:
    return f"{service_date}:{route_id}:{service_type}:{departure_time}"


def _assignment_key(
    service_date: str,
    departure_time: str,
    record_id: str,
) -> str:
    return f"{service_date}:{departure_time}:{record_id}"


def _find_document(collection, identifier: str) -> dict[str, Any] | None:
    if not ObjectId.is_valid(str(identifier or "")):
        return None
    return collection.find_one({"_id": ObjectId(identifier)})


def _route_for_schedule(route_id: Any, *, require_active: bool) -> dict[str, Any]:
    route = get_route_admin_details(str(route_id or "").strip())
    if route is None:
        raise ScheduleValidationError(
            "Route not found",
            field="routeId",
            code="ROUTE_NOT_FOUND",
            status=404,
        )
    if require_active and route["recordStatus"] != "active":
        raise ScheduleValidationError(
            "Only an active route can receive an active timetable",
            field="routeId",
            code="ROUTE_INACTIVE",
            status=409,
        )
    return route


def _validate_route_service_type(
    route: dict[str, Any],
    service_type: str,
) -> None:
    """Allow every supported timetable service type on every active route.

    Route service categories remain descriptive master data, but they do not
    block SLTB, Private or Intercity timetable creation.
    """

    if service_type not in SERVICE_TYPES:
        raise ScheduleValidationError(
            "serviceType must be SLTB, Private or Intercity",
            field="serviceType",
            code="INVALID_SERVICE_TYPE",
            status=400,
        )


def serialize_schedule_template(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document.get("_id") or ""),
        "routeId": str(document.get("routeId") or ""),
        "routeNumber": str(document.get("routeNumber") or ""),
        "routeName": str(document.get("routeName") or ""),
        "origin": str(document.get("origin") or ""),
        "destination": str(document.get("destination") or ""),
        "depotName": str(document.get("depotName") or ""),
        "serviceType": str(document.get("serviceType") or ""),
        "departureTime": str(document.get("departureTime") or ""),
        "operatingDays": list(document.get("operatingDays") or []),
        "recordStatus": str(document.get("recordStatus") or "active"),
        "notes": str(document.get("notes") or ""),
        "createdAt": _iso_value(document.get("createdAt")),
        "updatedAt": _iso_value(document.get("updatedAt")),
    }


def serialize_daily_service(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document.get("_id") or ""),
        "scheduleTemplateId": str(document.get("scheduleTemplateId") or ""),
        "serviceDate": str(document.get("serviceDate") or ""),
        "routeId": str(document.get("routeId") or ""),
        "routeNumber": str(document.get("routeNumber") or ""),
        "routeName": str(document.get("routeName") or ""),
        "origin": str(document.get("origin") or ""),
        "destination": str(document.get("destination") or ""),
        "depotName": str(document.get("depotName") or ""),
        "serviceType": str(document.get("serviceType") or ""),
        "departureTime": str(document.get("departureTime") or ""),
        "busId": str(document.get("busId") or ""),
        "busRegistration": str(document.get("busRegistration") or ""),
        "operatorName": str(document.get("operatorName") or ""),
        "busDepotName": str(document.get("busDepotName") or ""),
        "driverId": str(document.get("driverId") or ""),
        "driverName": str(document.get("driverName") or ""),
        "driverNtcRegistrationNumber": str(
            document.get("driverNtcRegistrationNumber") or ""
        ),
        "status": str(document.get("status") or "scheduled"),
        "notes": str(document.get("notes") or ""),
        "tripId": str(document.get("tripId") or ""),
        "createdAt": _iso_value(document.get("createdAt")),
        "updatedAt": _iso_value(document.get("updatedAt")),
    }


def list_schedule_templates(
    *,
    query: str = "",
    status: str = "",
    service_type: str = "",
) -> list[dict[str, Any]]:
    mongo_query: dict[str, Any] = {}

    normalized_status = status.strip().lower()
    if normalized_status:
        if normalized_status not in SCHEDULE_STATUSES:
            raise ScheduleValidationError(
                "Invalid schedule status",
                field="status",
            )
        mongo_query["recordStatus"] = normalized_status

    normalized_service_type = service_type.strip().lower()
    if normalized_service_type:
        normalized_service_type = _normalize_service_type(
            normalized_service_type
        )
        mongo_query["serviceType"] = normalized_service_type

    normalized_query = query.strip()
    if normalized_query:
        escaped = re.escape(normalized_query[:80])
        mongo_query["$or"] = [
            {"routeNumber": {"$regex": escaped, "$options": "i"}},
            {"routeName": {"$regex": escaped, "$options": "i"}},
            {"origin": {"$regex": escaped, "$options": "i"}},
            {"destination": {"$regex": escaped, "$options": "i"}},
            {"depotName": {"$regex": escaped, "$options": "i"}},
        ]

    records = schedule_templates_collection.find(mongo_query).sort([
        ("recordStatus", 1),
        ("routeNumber", 1),
        ("departureTime", 1),
    ])
    return [serialize_schedule_template(record) for record in records]


def get_schedule_template(identifier: str) -> dict[str, Any] | None:
    document = _find_document(schedule_templates_collection, identifier)
    return serialize_schedule_template(document) if document else None


def create_schedule_template(payload: Any, *, actor: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ScheduleValidationError("A JSON timetable payload is required")

    route_id = str(payload.get("routeId") or "").strip()
    status = _normalize_schedule_status(payload.get("recordStatus"))
    route = _route_for_schedule(route_id, require_active=status == "active")
    service_type = _normalize_service_type(payload.get("serviceType"))
    _validate_route_service_type(route, service_type)
    departure_time = _normalize_time(payload.get("departureTime"))
    operating_days = _normalize_operating_days(payload.get("operatingDays"))

    now = datetime.now(timezone.utc)
    document = {
        "routeId": route["id"],
        "routeNumber": route["routeNumber"],
        "routeName": route["name"],
        "origin": route["origin"],
        "destination": route["destination"],
        "depotName": route.get("depotName", ""),
        "serviceType": service_type,
        "departureTime": departure_time,
        "operatingDays": operating_days,
        "recordStatus": status,
        "templateKey": _schedule_template_key(
            route["id"], service_type, departure_time
        ),
        "notes": _clean_text(payload.get("notes"), max_length=500),
        "createdAt": now,
        "createdBy": actor,
        "updatedAt": now,
        "updatedBy": actor,
    }

    try:
        result = schedule_templates_collection.insert_one(document)
    except DuplicateKeyError as error:
        raise ScheduleValidationError(
            "This route already has a timetable slot for the selected service type and departure time",
            field="departureTime",
            code="DUPLICATE_SCHEDULE_SLOT",
            status=409,
        ) from error

    document["_id"] = result.inserted_id
    return serialize_schedule_template(document)


def update_schedule_template(
    identifier: str,
    payload: Any,
    *,
    actor: str,
) -> dict[str, Any] | None:
    existing = _find_document(schedule_templates_collection, identifier)
    if not existing:
        return None
    if not isinstance(payload, dict):
        raise ScheduleValidationError("A JSON timetable payload is required")

    status = _normalize_schedule_status(
        payload.get("recordStatus", existing.get("recordStatus"))
    )
    route_id = str(payload.get("routeId", existing.get("routeId")) or "").strip()
    route = _route_for_schedule(route_id, require_active=status == "active")
    service_type = _normalize_service_type(
        payload.get("serviceType", existing.get("serviceType"))
    )
    _validate_route_service_type(route, service_type)
    departure_time = _normalize_time(
        payload.get("departureTime", existing.get("departureTime"))
    )
    operating_days = _normalize_operating_days(
        payload.get("operatingDays", existing.get("operatingDays"))
    )

    update_fields = {
        "routeId": route["id"],
        "routeNumber": route["routeNumber"],
        "routeName": route["name"],
        "origin": route["origin"],
        "destination": route["destination"],
        "depotName": route.get("depotName", ""),
        "serviceType": service_type,
        "departureTime": departure_time,
        "operatingDays": operating_days,
        "recordStatus": status,
        "templateKey": _schedule_template_key(
            route["id"], service_type, departure_time
        ),
        "notes": _clean_text(
            payload.get("notes", existing.get("notes")),
            max_length=500,
        ),
        "updatedAt": datetime.now(timezone.utc),
        "updatedBy": actor,
    }

    try:
        result = schedule_templates_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": update_fields},
        )
    except DuplicateKeyError as error:
        raise ScheduleValidationError(
            "This route already has a timetable slot for the selected service type and departure time",
            field="departureTime",
            code="DUPLICATE_SCHEDULE_SLOT",
            status=409,
        ) from error

    if result.matched_count != 1:
        return None
    updated = schedule_templates_collection.find_one({"_id": existing["_id"]})
    return serialize_schedule_template(updated) if updated else None


def delete_schedule_template(identifier: str) -> bool:
    existing = _find_document(schedule_templates_collection, identifier)
    if not existing:
        return False

    linked_count = daily_services_collection.count_documents({
        "scheduleTemplateId": str(existing["_id"]),
    })
    if linked_count:
        raise ScheduleValidationError(
            "This timetable already has daily service records. Set it to inactive instead of deleting it.",
            code="SCHEDULE_HAS_DAILY_SERVICES",
            status=409,
        )

    return schedule_templates_collection.delete_one(
        {"_id": existing["_id"]}
    ).deleted_count == 1


def _bus_reference(bus_id: Any) -> tuple[dict[str, Any], str, str]:
    object_id = _object_id(bus_id, field="busId")
    bus = buses_collection.find_one({"_id": object_id})
    if not bus:
        raise ScheduleValidationError(
            "Bus not found",
            field="busId",
            code="BUS_NOT_FOUND",
            status=404,
        )
    if str(bus.get("recordStatus") or "active").lower() != "active":
        raise ScheduleValidationError(
            "Only an active bus can be assigned",
            field="busId",
            code="BUS_NOT_AVAILABLE",
            status=409,
        )

    operator_name = ""
    depot_name = ""
    operator_id = bus.get("operatorId")
    depot_id = bus.get("depotId")
    if operator_id:
        operator = operators_collection.find_one(
            {"_id": operator_id}, {"name": 1}
        )
        operator_name = str((operator or {}).get("name") or "")
    if depot_id:
        depot = depots_collection.find_one({"_id": depot_id}, {"name": 1})
        depot_name = str((depot or {}).get("name") or "")
    return bus, operator_name, depot_name


def _driver_reference(driver_id: Any, service_date: date) -> dict[str, Any]:
    object_id = _object_id(driver_id, field="driverId")
    driver = drivers_collection.find_one({"_id": object_id})
    if not driver:
        raise ScheduleValidationError(
            "Driver not found",
            field="driverId",
            code="DRIVER_NOT_FOUND",
            status=404,
        )

    verification_status = str(
        driver.get("verificationStatus") or "pending"
    ).strip().lower()
    if verification_status not in {"approved", "verified"}:
        raise ScheduleValidationError(
            "Only an approved driver can be assigned",
            field="driverId",
            code="DRIVER_NOT_APPROVED",
            status=409,
        )

    expiry = str(driver.get("drivingLicenseExpiry") or "").strip()
    if expiry:
        try:
            expiry_date = datetime.fromisoformat(expiry[:10]).date()
        except ValueError:
            expiry_date = None
        if expiry_date and expiry_date < service_date:
            raise ScheduleValidationError(
                "The driver's licence expires before this service date",
                field="driverId",
                code="DRIVER_LICENCE_EXPIRED",
                status=409,
            )
    return driver


def _daily_service_fields(
    payload: dict[str, Any],
    *,
    existing: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, str]]:
    existing = existing or {}
    schedule_id = str(
        payload.get(
            "scheduleTemplateId",
            existing.get("scheduleTemplateId"),
        )
        or ""
    ).strip()
    schedule_document = _find_document(
        schedule_templates_collection,
        schedule_id,
    )
    if not schedule_document:
        raise ScheduleValidationError(
            "Timetable slot not found",
            field="scheduleTemplateId",
            code="SCHEDULE_NOT_FOUND",
            status=404,
        )

    status = str(
        payload.get("status", existing.get("status") or "scheduled")
    ).strip().lower()
    if status not in EDITABLE_DAILY_SERVICE_STATUSES:
        raise ScheduleValidationError(
            "status must be scheduled or cancelled",
            field="status",
        )

    if (
        str(schedule_document.get("recordStatus") or "active") != "active"
        and status != "cancelled"
    ):
        raise ScheduleValidationError(
            "Only an active timetable slot can schedule a daily service",
            field="scheduleTemplateId",
            code="SCHEDULE_INACTIVE",
            status=409,
        )

    service_date_text, service_date = _normalize_date(
        payload.get("serviceDate", existing.get("serviceDate"))
    )
    day_name = OPERATING_DAYS[service_date.weekday()]
    if day_name not in list(schedule_document.get("operatingDays") or []):
        raise ScheduleValidationError(
            "The selected timetable does not operate on this day",
            field="serviceDate",
            code="SCHEDULE_NOT_OPERATING_ON_DATE",
            status=409,
        )

    bus_id = str(payload.get("busId", existing.get("busId")) or "").strip()
    driver_id = str(
        payload.get("driverId", existing.get("driverId")) or ""
    ).strip()
    bus, operator_name, bus_depot_name = _bus_reference(bus_id)
    driver = _driver_reference(driver_id, service_date)

    route_id = str(schedule_document.get("routeId") or "")
    service_type = str(schedule_document.get("serviceType") or "")
    departure_time = str(schedule_document.get("departureTime") or "")
    bus_registration = str(
        bus.get("vehicleRegistrationNumber") or bus.get("bus_id") or ""
    )
    driver_name = str(
        driver.get("fullName") or driver.get("name") or ""
    )

    fields: dict[str, Any] = {
        "scheduleTemplateId": str(schedule_document["_id"]),
        "serviceDate": service_date_text,
        "routeId": route_id,
        "routeNumber": str(schedule_document.get("routeNumber") or ""),
        "routeName": str(schedule_document.get("routeName") or ""),
        "origin": str(schedule_document.get("origin") or ""),
        "destination": str(schedule_document.get("destination") or ""),
        "depotName": str(schedule_document.get("depotName") or ""),
        "serviceType": service_type,
        "departureTime": departure_time,
        "busId": str(bus["_id"]),
        "busRegistration": bus_registration,
        "operatorName": operator_name,
        "busDepotName": bus_depot_name,
        "driverId": str(driver["_id"]),
        "driverName": driver_name,
        "driverNtcRegistrationNumber": str(
            driver.get("driverNtcRegistrationNumber") or ""
        ),
        "status": status,
        "dailyServiceKey": _daily_service_key(
            service_date_text,
            route_id,
            service_type,
            departure_time,
        ),
        "notes": _clean_text(
            payload.get("notes", existing.get("notes")),
            max_length=500,
        ),
    }

    unset_fields: dict[str, str] = {}
    if status == "scheduled":
        fields.update({
            "busAssignmentKey": _assignment_key(
                service_date_text,
                departure_time,
                str(bus["_id"]),
            ),
            "driverAssignmentKey": _assignment_key(
                service_date_text,
                departure_time,
                str(driver["_id"]),
            ),
        })
    else:
        unset_fields.update({
            "busAssignmentKey": "",
            "driverAssignmentKey": "",
        })

    return fields, unset_fields


def _raise_daily_duplicate(error: DuplicateKeyError) -> None:
    details = getattr(error, "details", {}) or {}
    pattern = details.get("keyPattern") or {}
    field = next(iter(pattern), "")
    messages = {
        "dailyServiceKey": (
            "A daily service already exists for this route, service type and departure time"
        ),
        "busAssignmentKey": (
            "This bus is already assigned to another service at the same date and time"
        ),
        "driverAssignmentKey": (
            "This driver is already assigned to another service at the same date and time"
        ),
    }
    raise ScheduleValidationError(
        messages.get(field, "This daily service conflicts with an existing assignment"),
        field=field,
        code="DAILY_SERVICE_CONFLICT",
        status=409,
    ) from error


def list_daily_services(
    *,
    service_date: str = "",
    status: str = "",
    query: str = "",
) -> list[dict[str, Any]]:
    mongo_query: dict[str, Any] = {}
    if service_date:
        normalized_date, _ = _normalize_date(service_date)
        mongo_query["serviceDate"] = normalized_date

    normalized_status = status.strip().lower()
    if normalized_status:
        if normalized_status not in DAILY_SERVICE_STATUSES:
            raise ScheduleValidationError(
                "Invalid daily service status",
                field="status",
            )
        mongo_query["status"] = normalized_status

    normalized_query = query.strip()
    if normalized_query:
        escaped = re.escape(normalized_query[:80])
        mongo_query["$or"] = [
            {"routeNumber": {"$regex": escaped, "$options": "i"}},
            {"routeName": {"$regex": escaped, "$options": "i"}},
            {"busRegistration": {"$regex": escaped, "$options": "i"}},
            {"driverName": {"$regex": escaped, "$options": "i"}},
            {"operatorName": {"$regex": escaped, "$options": "i"}},
        ]

    records = daily_services_collection.find(mongo_query).sort([
        ("serviceDate", 1),
        ("departureTime", 1),
        ("routeNumber", 1),
    ])
    return [serialize_daily_service(record) for record in records]


def create_daily_service(payload: Any, *, actor: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ScheduleValidationError("A JSON daily service payload is required")
    fields, unset_fields = _daily_service_fields(payload)
    now = datetime.now(timezone.utc)
    fields.update({
        "createdAt": now,
        "createdBy": actor,
        "updatedAt": now,
        "updatedBy": actor,
    })
    for field in unset_fields:
        fields.pop(field, None)

    try:
        result = daily_services_collection.insert_one(fields)
    except DuplicateKeyError as error:
        _raise_daily_duplicate(error)

    fields["_id"] = result.inserted_id
    return serialize_daily_service(fields)


def update_daily_service(
    identifier: str,
    payload: Any,
    *,
    actor: str,
) -> dict[str, Any] | None:
    existing = _find_document(daily_services_collection, identifier)
    if not existing:
        return None
    if str(existing.get("status") or "scheduled") in {"in_progress", "completed"}:
        raise ScheduleValidationError(
            "An in-progress or completed service cannot be edited from the roster",
            code="DAILY_SERVICE_LOCKED",
            status=409,
        )
    if not isinstance(payload, dict):
        raise ScheduleValidationError("A JSON daily service payload is required")

    fields, unset_fields = _daily_service_fields(payload, existing=existing)
    fields.update({
        "updatedAt": datetime.now(timezone.utc),
        "updatedBy": actor,
    })
    update_document: dict[str, Any] = {"$set": fields}
    if unset_fields:
        update_document["$unset"] = unset_fields

    try:
        result = daily_services_collection.update_one(
            {"_id": existing["_id"]},
            update_document,
        )
    except DuplicateKeyError as error:
        _raise_daily_duplicate(error)

    if result.matched_count != 1:
        return None
    updated = daily_services_collection.find_one({"_id": existing["_id"]})
    return serialize_daily_service(updated) if updated else None


def delete_daily_service(identifier: str) -> bool:
    existing = _find_document(daily_services_collection, identifier)
    if not existing:
        return False
    if existing.get("tripId") or str(existing.get("status") or "") in {
        "in_progress",
        "completed",
    }:
        raise ScheduleValidationError(
            "This service has trip activity and cannot be deleted",
            code="DAILY_SERVICE_HAS_TRIP",
            status=409,
        )
    return daily_services_collection.delete_one(
        {"_id": existing["_id"]}
    ).deleted_count == 1


def get_scheduling_references() -> dict[str, Any]:
    routes = [
        {
            "id": route["id"],
            "routeNumber": route["routeNumber"],
            "name": route["name"],
            "origin": route["origin"],
            "destination": route["destination"],
            "depotName": route.get("depotName", ""),
            "serviceCategories": [
                category
                for category in route.get("serviceCategories", [])
                if category in SERVICE_TYPES
            ],
        }
        for route in list_route_records(status="active")
    ]

    templates = list_schedule_templates()

    buses = list(
        buses_collection.find(
            {"recordStatus": "active"},
            {
                "vehicleRegistrationNumber": 1,
                "bus_id": 1,
                "operatorId": 1,
                "depotId": 1,
            },
        ).sort("vehicleRegistrationNumber", 1)
    )
    operator_ids = {bus.get("operatorId") for bus in buses if bus.get("operatorId")}
    depot_ids = {bus.get("depotId") for bus in buses if bus.get("depotId")}
    operator_names = {
        str(item["_id"]): str(item.get("name") or "")
        for item in operators_collection.find(
            {"_id": {"$in": list(operator_ids)}}, {"name": 1}
        )
    } if operator_ids else {}
    depot_names = {
        str(item["_id"]): str(item.get("name") or "")
        for item in depots_collection.find(
            {"_id": {"$in": list(depot_ids)}}, {"name": 1}
        )
    } if depot_ids else {}

    drivers = drivers_collection.find(
        {"verificationStatus": {"$in": ["approved", "verified"]}},
        {
            "fullName": 1,
            "name": 1,
            "driverNtcRegistrationNumber": 1,
            "drivingLicenseExpiry": 1,
        },
    ).sort("fullName", 1)

    return {
        "routes": routes,
        "templates": templates,
        "buses": [
            {
                "id": str(bus["_id"]),
                "registration": str(
                    bus.get("vehicleRegistrationNumber")
                    or bus.get("bus_id")
                    or ""
                ),
                "operatorName": operator_names.get(
                    str(bus.get("operatorId") or ""), ""
                ),
                "depotName": depot_names.get(
                    str(bus.get("depotId") or ""), ""
                ),
            }
            for bus in buses
        ],
        "drivers": [
            {
                "id": str(driver["_id"]),
                "fullName": str(
                    driver.get("fullName") or driver.get("name") or ""
                ),
                "driverNtcRegistrationNumber": str(
                    driver.get("driverNtcRegistrationNumber") or ""
                ),
                "drivingLicenseExpiry": str(
                    driver.get("drivingLicenseExpiry") or ""
                ),
            }
            for driver in drivers
        ],
        "operatingDays": list(OPERATING_DAYS),
        "serviceTypes": sorted(SERVICE_TYPES),
    }