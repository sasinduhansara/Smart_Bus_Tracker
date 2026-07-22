import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from bson.objectid import ObjectId


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import notification_service


class NotificationContractTests(unittest.TestCase):
    def test_retention_limit_is_twenty(self):
        self.assertEqual(notification_service.DRIVER_NOTIFICATION_LIMIT, 20)

    def test_pruning_deletes_records_after_the_newest_twenty(self):
        stale_ids = [ObjectId(), ObjectId()]
        cursor = MagicMock()
        cursor.sort.return_value = cursor
        cursor.skip.return_value = [
            {"_id": notification_id}
            for notification_id in stale_ids
        ]

        with (
            patch.object(
                notification_service.notifications_collection,
                "find",
                return_value=cursor,
            ),
            patch.object(
                notification_service.notifications_collection,
                "delete_many",
                return_value=MagicMock(deleted_count=2),
            ) as delete_many,
        ):
            deleted = notification_service.prune_driver_notifications(
                str(ObjectId())
            )

        cursor.skip.assert_called_once_with(20)
        delete_many.assert_called_once_with({"_id": {"$in": stale_ids}})
        self.assertEqual(deleted, 2)

    def test_insert_persists_unread_notification_then_prunes(self):
        driver_id = str(ObjectId())
        notification_id = ObjectId()
        inserted_result = MagicMock(inserted_id=notification_id)

        with (
            patch.object(
                notification_service.notifications_collection,
                "insert_one",
                return_value=inserted_result,
            ) as insert_one,
            patch.object(
                notification_service,
                "prune_driver_notifications",
                return_value=0,
            ) as prune,
        ):
            inserted_id = notification_service.insert_driver_notification(
                driver_id,
                title="Route updated",
                message="Your assigned route changed.",
                notification_type="route_updated",
                created_at=MagicMock(),
            )

        inserted_document = insert_one.call_args.args[0]
        self.assertEqual(inserted_document["driverId"], driver_id)
        self.assertFalse(inserted_document["read"])
        prune.assert_called_once_with(driver_id)
        self.assertEqual(inserted_id, str(notification_id))

    def test_driver_read_endpoints_exist(self):
        source = (BACKEND_DIR / "routes" / "auth_routes.py").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            "/api/driver/notifications/<notification_id>/read",
            source,
        )
        self.assertIn("/api/driver/notifications/read-all", source)

    def test_resolving_issue_creates_driver_notification(self):
        source = (BACKEND_DIR / "routes" / "admin_routes.py").read_text(
            encoding="utf-8"
        )

        self.assertIn('notification_type="issue_resolved"', source)
        self.assertIn('"notificationSent": notification_sent', source)
        self.assertIn('{"$in": ["open", "in_review"]}', source)


if __name__ == "__main__":
    unittest.main()
