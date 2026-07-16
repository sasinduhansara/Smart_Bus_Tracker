import os
from typing import Any


_DEVELOPMENT_ROUTES: list[dict[str, Any]] = [
    {
        "routeNumber": "123",
        "name": "Kuliyapitiya - Kurunegala",
        "direction": "outbound",
        "polyline": [
            {"latitude": 7.4688, "longitude": 80.0401},
            {"latitude": 7.4745, "longitude": 80.0792},
            {"latitude": 7.489, "longitude": 80.118},
            {"latitude": 7.4612, "longitude": 80.1668},
            {"latitude": 7.4316, "longitude": 80.2106},
            {"latitude": 7.455, "longitude": 80.279},
            {"latitude": 7.4818, "longitude": 80.3558},
            {"latitude": 7.4863, "longitude": 80.3647},
        ],
        "stops": [
            {
                "id": "stop-1",
                "name": "Kuliyapitiya Bus Stand",
                "latitude": 7.4688,
                "longitude": 80.0401,
                "sequence": 1,
            },
            {
                "id": "stop-2",
                "name": "Dummalasuriya Junction",
                "latitude": 7.489,
                "longitude": 80.118,
                "sequence": 2,
            },
            {
                "id": "stop-3",
                "name": "Narammala",
                "latitude": 7.4316,
                "longitude": 80.2106,
                "sequence": 3,
            },
            {
                "id": "stop-4",
                "name": "Weerambugedara",
                "latitude": 7.455,
                "longitude": 80.279,
                "sequence": 4,
            },
            {
                "id": "stop-5",
                "name": "Maliyadeva Junction",
                "latitude": 7.4818,
                "longitude": 80.3558,
                "sequence": 5,
            },
            {
                "id": "stop-6",
                "name": "Kurunegala Bus Stand",
                "latitude": 7.4863,
                "longitude": 80.3647,
                "sequence": 6,
            },
        ],
    },
]

DEVELOPMENT_ROUTES: list[dict[str, Any]] = (
    _DEVELOPMENT_ROUTES
    if os.getenv("ENABLE_DEVELOPMENT_ROUTE_FALLBACK", "").strip().lower()
    in {"1", "true", "yes", "on"}
    else []
)
