from datetime import datetime
from typing import Any

from bson.objectid import ObjectId

from config import notifications_collection


DRIVER_NOTIFICATION_LIMIT = 20


def driver_notification_query(driver_id: Any) -> dict[str, Any]:
    normalized_id = str(driver_id or "").strip()
    references: list[Any] = [normalized_id]
    if ObjectId.is_valid(normalized_id):
        references.append(ObjectId(normalized_id))

    return {
        "$or": [
            {"driverId": {"$in": references}},
            {"driver_id": {"$in": references}},
        ]
    }


def prune_driver_notifications(
    driver_id: Any,
    *,
    keep: int = DRIVER_NOTIFICATION_LIMIT,
) -> int:
    keep = max(int(keep), 0)
    stale_ids = [
        notification["_id"]
        for notification in notifications_collection.find(
            driver_notification_query(driver_id),
            {"_id": 1},
        )
        .sort([("createdAt", -1), ("_id", -1)])
        .skip(keep)
    ]
    if not stale_ids:
        return 0

    return notifications_collection.delete_many({
        "_id": {"$in": stale_ids},
    }).deleted_count


def insert_driver_notification(
    driver_id: Any,
    *,
    title: str,
    message: str,
    notification_type: str,
    created_at: datetime,
) -> str:
    result = notifications_collection.insert_one({
        "driverId": str(driver_id),
        "title": str(title or "Notification")[:200],
        "message": str(message or "")[:2000],
        "type": str(notification_type or "general")[:80],
        "read": False,
        "createdAt": created_at,
    })
    prune_driver_notifications(driver_id)
    return str(result.inserted_id)
