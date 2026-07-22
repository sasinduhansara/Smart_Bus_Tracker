"""
test_geospatial.py – Unit tests for OSRM matching, GeoJSON snapping, and deviation detection.
"""

import unittest
from unittest.mock import patch, MagicMock

from services.geospatial_service import match_location_to_route
from services.osrm_service import snap_gps_to_route


class TestGeospatialService(unittest.TestCase):

    def setUp(self):
        self.sample_geojson = {
            "type": "LineString",
            "coordinates": [
                [80.0, 7.0],
                [80.1, 7.0],
                [80.2, 7.0],
            ]
        }
        self.sample_polyline = [
            {"latitude": 7.0, "longitude": 80.0},
            {"latitude": 7.0, "longitude": 80.1},
            {"latitude": 7.0, "longitude": 80.2},
        ]

    @patch("services.geospatial_service.snap_gps_to_route")
    def test_match_location_uses_geojson(self, mock_snap):
        mock_snap.return_value = {
            "snappedLat": 7.0,
            "snappedLng": 80.05,
            "distanceFromRouteMeters": 12.5,
            "isRouteDeviation": False,
        }

        result = match_location_to_route(
            latitude=7.0001,
            longitude=80.05,
            polyline=self.sample_polyline,
            geometry=self.sample_geojson,
        )

        mock_snap.assert_called_once_with(7.0001, 80.05, self.sample_geojson)
        self.assertEqual(result["displayLatitude"], 7.0)
        self.assertEqual(result["displayLongitude"], 80.05)
        self.assertAlmostEqual(result["distanceFromRouteMeters"], 12.5)
        self.assertFalse(result["isRouteDeviationCandidate"])

    def test_match_location_fallback_polyline(self):
        # Coordinates exactly on segment
        result = match_location_to_route(
            latitude=7.0,
            longitude=80.05,
            polyline=self.sample_polyline,
            geometry=None,
        )

        self.assertAlmostEqual(result["displayLatitude"], 7.0, places=3)
        self.assertAlmostEqual(result["displayLongitude"], 80.05, places=3)
        self.assertLess(result["distanceFromRouteMeters"], 5.0)

    @patch("requests.get")
    def test_osrm_snap_fallback_on_network_error(self, mock_get):
        mock_get.side_effect = Exception("OSRM server unreachable")

        result = snap_gps_to_route(7.0002, 80.05, self.sample_geojson)

        self.assertIn("snappedLat", result)
        self.assertIn("snappedLng", result)
        self.assertIn("distanceFromRouteMeters", result)
        self.assertIsInstance(result["distanceFromRouteMeters"], float)


if __name__ == "__main__":
    unittest.main()
