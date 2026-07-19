import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.geospatial_service import match_location_to_route


class RouteMapMatchingTests(unittest.TestCase):
    def setUp(self):
        self.polyline = [
            {"latitude": 7.4688, "longitude": 80.0401},
            {"latitude": 7.4863, "longitude": 80.3647},
        ]

    def test_nearby_raw_coordinate_is_preserved_and_display_is_snapped(self):
        result = match_location_to_route(
            7.4722,
            80.1000,
            self.polyline,
            snap_threshold_meters=75,
        )

        self.assertEqual(result["rawLatitude"], 7.4722)
        self.assertEqual(result["rawLongitude"], 80.1000)
        self.assertNotEqual(result["displayLatitude"], result["rawLatitude"])
        self.assertLessEqual(result["distanceFromRouteMeters"], 75)
        self.assertFalse(result["isRouteDeviationCandidate"])

    def test_far_coordinate_is_not_silently_snapped(self):
        result = match_location_to_route(
            7.30,
            80.20,
            self.polyline,
            snap_threshold_meters=75,
        )

        self.assertEqual(result["displayLatitude"], result["rawLatitude"])
        self.assertEqual(result["displayLongitude"], result["rawLongitude"])
        self.assertGreater(result["distanceFromRouteMeters"], 100)
        self.assertTrue(result["isRouteDeviationCandidate"])


if __name__ == "__main__":
    unittest.main()
