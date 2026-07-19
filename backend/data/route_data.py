import os
from typing import Any


_DEVELOPMENT_ROUTES: list[dict[str, Any]] = [
    {
        "routeNumber": "138",
        "name": "Kottawa - Pettah",
        "direction": "Inbound via Maharagama",
        "polyline": [
            {"latitude": 6.8161, "longitude": 79.8710},
            {"latitude": 6.8480, "longitude": 79.9265},
            {"latitude": 6.8649, "longitude": 79.8997},
            {"latitude": 6.9344, "longitude": 79.8580},
        ],
        "stops": [
            {
                "id": "kottawa",
                "name": "Kottawa",
                "latitude": 6.8161,
                "longitude": 79.8710,
                "sequence": 1,
            },
            {
                "id": "maharagama",
                "name": "Maharagama Stop",
                "latitude": 6.8480,
                "longitude": 79.9265,
                "sequence": 2,
            },
            {
                "id": "nugegoda",
                "name": "Nugegoda Junction",
                "latitude": 6.8649,
                "longitude": 79.8997,
                "sequence": 3,
            },
            {
                "id": "pettah",
                "name": "Pettah",
                "latitude": 6.9344,
                "longitude": 79.8580,
                "sequence": 4,
            },
        ],
    },
    {
        "routeNumber": "122",
        "name": "Avissawella - Pettah",
        "direction": "Inbound via Homagama",
        "polyline": [
            {"latitude": 6.9550, "longitude": 80.2110},
            {"latitude": 6.8440, "longitude": 80.0030},
            {"latitude": 6.8161, "longitude": 79.8710},
            {"latitude": 6.9344, "longitude": 79.8580},
        ],
        "stops": [
            {
                "id": "avissawella",
                "name": "Avissawella",
                "latitude": 6.9550,
                "longitude": 80.2110,
                "sequence": 1,
            },
            {
                "id": "homagama",
                "name": "Homagama Town",
                "latitude": 6.8440,
                "longitude": 80.0030,
                "sequence": 2,
            },
            {
                "id": "kottawa",
                "name": "Kottawa",
                "latitude": 6.8161,
                "longitude": 79.8710,
                "sequence": 3,
            },
            {
                "id": "pettah",
                "name": "Pettah",
                "latitude": 6.9344,
                "longitude": 79.8580,
                "sequence": 4,
            },
        ],
    },
    {
        "routeNumber": "123",
        "name": "Kuliyapitiya - Kurunegala",
        "direction": "outbound",
        "terminals": [
            {
                "id": "kuliyapitiya",
                "name": "Kuliyapitiya Bus Stand",
                "latitude": 7.4688,
                "longitude": 80.0401,
                "startRadiusMeters": 500,
            },
            {
                "id": "kurunegala",
                "name": "Kurunegala Bus Stand",
                "latitude": 7.4863,
                "longitude": 80.3647,
                "startRadiusMeters": 500,
            },
        ],
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
