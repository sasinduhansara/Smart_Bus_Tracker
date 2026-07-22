"""
eta_storage_service.py

Stores ETA predictions for later accuracy evaluation and model retraining.

Each prediction record persists:
  - The request context (bus, route, destination stop)
  - The model prediction (etaMinutes, features used)
  - The actual arrival time when captured (populated externally by
    the arrival-capture endpoint called from the driver app)

Accuracy evaluation uses the `actual_arrival_at` field to compute
  absolute error for each stored prediction.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson.objectid import ObjectId
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError

from config import eta_predictions_collection


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def store_prediction(
    *,
    bus_id: str,
    route_id: str,
    route_number: str,
    trip_id: str | None,
    destination_stop_id: str,
    destination_stop_name: str,
    remaining_distance_km: float,
    eta_minutes: float,
    estimated_arrival_at: str,
    model_version: str,
    feature_snapshot: dict[str, Any],
) -> str | None:
    """Persist a single ETA prediction. Returns the inserted document id or None."""
    doc: dict[str, Any] = {
        "busId": bus_id,
        "routeId": route_id,
        "routeNumber": route_number,
        "tripId": trip_id,
        "stopId": destination_stop_id,
        "stopName": destination_stop_name,
        "remainingDistanceKm": remaining_distance_km,
        "predictedEtaMinutes": eta_minutes,
        "estimatedArrivalAt": estimated_arrival_at,
        "modelVersion": model_version,
        "featureSnapshot": feature_snapshot,
        "actualArrivalAt": None,
        "absoluteErrorMinutes": None,
        "generatedAt": _utc_now(),
    }

    try:
        result = eta_predictions_collection.insert_one(doc)
        return str(result.inserted_id)
    except PyMongoError:
        return None


def record_actual_arrival(
    prediction_id: str,
    actual_arrival_at: datetime,
) -> bool:
    """
    Mark a stored prediction with the real arrival time and compute error.

    Called by the driver app when the bus is within the arrival geofence
    for the destination stop.

    Returns True when the update succeeded.
    """
    if not ObjectId.is_valid(prediction_id):
        return False

    try:
        prediction = eta_predictions_collection.find_one(
            {"_id": ObjectId(prediction_id)},
            {"estimatedArrivalAt": 1, "actualArrivalAt": 1},
        )
    except PyMongoError:
        return False

    if prediction is None or prediction.get("actualArrivalAt") is not None:
        # Already recorded — idempotent, treat as success.
        return True

    try:
        estimated_raw = prediction.get("estimatedArrivalAt")
        if isinstance(estimated_raw, str):
            estimated_at = datetime.fromisoformat(
                estimated_raw.replace("Z", "+00:00")
            )
        elif isinstance(estimated_raw, datetime):
            estimated_at = estimated_raw
        else:
            estimated_at = None

        error_minutes: float | None = None
        if estimated_at is not None:
            if estimated_at.tzinfo is None:
                estimated_at = estimated_at.replace(tzinfo=timezone.utc)
            if actual_arrival_at.tzinfo is None:
                actual_arrival_at = actual_arrival_at.replace(tzinfo=timezone.utc)
            error_minutes = round(
                abs(
                    (actual_arrival_at - estimated_at).total_seconds() / 60
                ),
                2,
            )
    except (ValueError, TypeError):
        error_minutes = None

    try:
        eta_predictions_collection.update_one(
            {"_id": ObjectId(prediction_id)},
            {
                "$set": {
                    "actualArrivalAt": actual_arrival_at,
                    "absoluteErrorMinutes": error_minutes,
                }
            },
        )
        return True
    except PyMongoError:
        return False


def get_recent_predictions(
    *,
    bus_id: str | None = None,
    route_id: str | None = None,
    limit: int = 100,
    only_evaluated: bool = False,
) -> list[dict[str, Any]]:
    """Retrieve recent predictions for analytics or evaluation pipeline."""
    query: dict[str, Any] = {}

    if bus_id:
        query["busId"] = bus_id
    if route_id:
        query["routeId"] = route_id
    if only_evaluated:
        query["actualArrivalAt"] = {"$ne": None}

    limit = max(1, min(limit, 1000))

    try:
        cursor = (
            eta_predictions_collection.find(query)
            .sort([("generatedAt", DESCENDING)])
            .limit(limit)
        )
        results: list[dict[str, Any]] = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("generatedAt"), datetime):
                doc["generatedAt"] = doc["generatedAt"].isoformat()
            if isinstance(doc.get("actualArrivalAt"), datetime):
                doc["actualArrivalAt"] = doc["actualArrivalAt"].isoformat()
            results.append(doc)
        return results
    except PyMongoError:
        return []


def get_model_accuracy_summary(
    model_version: str | None = None,
) -> dict[str, Any]:
    """Compute mean absolute error and coverage from evaluated predictions."""
    match_stage: dict[str, Any] = {
        "absoluteErrorMinutes": {"$ne": None},
    }
    if model_version:
        match_stage["modelVersion"] = model_version

    pipeline = [
        {"$match": match_stage},
        {
            "$group": {
                "_id": "$modelVersion",
                "count": {"$sum": 1},
                "meanAbsoluteErrorMinutes": {"$avg": "$absoluteErrorMinutes"},
                "maxErrorMinutes": {"$max": "$absoluteErrorMinutes"},
                "minErrorMinutes": {"$min": "$absoluteErrorMinutes"},
            }
        },
        {"$sort": {"_id": ASCENDING}},
    ]

    try:
        results = list(eta_predictions_collection.aggregate(pipeline))
        return {
            "status": "success",
            "models": [
                {
                    "modelVersion": r["_id"],
                    "evaluatedCount": r["count"],
                    "meanAbsoluteErrorMinutes": round(
                        r["meanAbsoluteErrorMinutes"], 2
                    ),
                    "maxErrorMinutes": round(r["maxErrorMinutes"], 2),
                    "minErrorMinutes": round(r["minErrorMinutes"], 2),
                }
                for r in results
            ],
        }
    except PyMongoError as exc:
        return {"status": "error", "error": str(exc)}
