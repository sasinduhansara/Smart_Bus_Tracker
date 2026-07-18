import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

test_config = ModuleType("config")
test_config.buses_collection = MagicMock()
test_config.routes_collection = MagicMock()
test_config.eta_model = None

original_config = sys.modules.get("config")
sys.modules["config"] = test_config
try:
    from services import eta_service
    from routes.eta_routes import eta_bp
finally:
    if original_config is None:
        sys.modules.pop("config", None)
    else:
        sys.modules["config"] = original_config


def route_details():
    return {
        "routeNumber": "138",
        "name": "Homagama - Pettah",
        "direction": "outbound",
        "polyline": [
            {"latitude": 6.8, "longitude": 79.9},
            {"latitude": 6.9, "longitude": 79.8},
        ],
        "stops": [
            {
                "id": "origin",
                "name": "Homagama",
                "latitude": 6.8,
                "longitude": 79.9,
                "sequence": 1,
            },
            {
                "id": "destination",
                "name": "Pettah",
                "latitude": 6.9,
                "longitude": 79.8,
                "sequence": 2,
            },
        ],
    }


def active_bus(**overrides):
    bus = {
        "bus_id": "NC-1234",
        "routeNumber": "138",
        "lat": 6.82,
        "lng": 79.88,
        "speed": 30,
        "updatedAt": datetime.now(timezone.utc),
        "operationalStatus": "active",
        "isActive": True,
    }
    bus.update(overrides)
    return bus


class EtaContractTests(unittest.TestCase):
    def setUp(self):
        self.model = SimpleNamespace(
            feature_names_in_=eta_service.FEATURE_ORDER,
            predict=MagicMock(return_value=[8.5]),
        )

    def request(self):
        return {
            "busId": "NC-1234",
            "routeNumber": "138",
            "destinationStopId": "destination",
        }

    def test_legacy_client_supplied_eta_endpoint_is_retired(self):
        app = Flask(__name__)
        app.testing = True
        app.register_blueprint(eta_bp)

        response = app.test_client().post(
            "/api/predict-eta",
            json={"distance_km": 1, "current_speed_kmh": 30},
        )

        self.assertEqual(response.status_code, 410)
        self.assertIn("retired", response.get_json()["error"])

    def test_required_fields_are_validated_before_model_availability(self):
        with patch.object(eta_service, "eta_model", None):
            with self.assertRaises(eta_service.EtaPredictionError) as context:
                eta_service.build_eta_prediction({})

        self.assertEqual(context.exception.status_code, 400)

    def test_paused_bus_does_not_return_a_current_eta(self):
        buses = MagicMock()
        buses.find_one.return_value = active_bus(
            operationalStatus="paused",
            isActive=False,
        )

        with (
            patch.object(eta_service, "eta_model", self.model),
            patch.object(eta_service, "buses_collection", buses),
            patch.object(eta_service, "get_route_details") as get_route,
        ):
            with self.assertRaises(eta_service.EtaPredictionError) as context:
                eta_service.build_eta_prediction(self.request())

        self.assertEqual(context.exception.status_code, 409)
        get_route.assert_not_called()

    def test_stale_bus_is_rejected(self):
        buses = MagicMock()
        buses.find_one.return_value = active_bus(
            updatedAt=datetime.now(timezone.utc) - timedelta(minutes=3),
        )

        with (
            patch.object(eta_service, "eta_model", self.model),
            patch.object(eta_service, "buses_collection", buses),
            patch.object(
                eta_service,
                "get_route_details",
                return_value=route_details(),
            ),
        ):
            with self.assertRaises(eta_service.EtaPredictionError) as context:
                eta_service.build_eta_prediction(self.request())

        self.assertEqual(context.exception.status_code, 409)

    def test_future_dated_bus_is_rejected(self):
        buses = MagicMock()
        buses.find_one.return_value = active_bus(
            updatedAt=datetime.now(timezone.utc) + timedelta(minutes=2),
        )

        with (
            patch.object(eta_service, "eta_model", self.model),
            patch.object(eta_service, "buses_collection", buses),
            patch.object(
                eta_service,
                "get_route_details",
                return_value=route_details(),
            ),
        ):
            with self.assertRaises(eta_service.EtaPredictionError) as context:
                eta_service.build_eta_prediction(self.request())

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("future", context.exception.message)

    def test_active_bus_returns_the_canonical_prediction_contract(self):
        buses = MagicMock()
        buses.find_one.return_value = active_bus()

        with (
            patch.object(eta_service, "eta_model", self.model),
            patch.object(eta_service, "buses_collection", buses),
            patch.object(
                eta_service,
                "get_route_details",
                return_value=route_details(),
            ),
        ):
            result = eta_service.build_eta_prediction(self.request())

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["busId"], "NC-1234")
        self.assertEqual(result["routeNumber"], "138")
        self.assertEqual(result["destinationStop"]["id"], "destination")
        self.assertIn("nextStop", result)
        self.assertEqual(result["etaMinutes"], 8.5)
        self.assertGreaterEqual(result["remainingDistanceKm"], 0)
        self.model.predict.assert_called_once()


if __name__ == "__main__":
    unittest.main()
