"""
rate_limit.py

Simple in-process sliding-window rate limiter for Gamana.lk backend.

Two strategies are provided:
  1. In-memory (default) – fast, no external dependencies, resets on restart.
     Suitable for single-process deployments behind a load balancer.
  2. Redis-backed (optional) – persistent across restarts, correct under
     multiple workers.  Activated automatically when REDIS_URL is set.

Usage (Flask)
-------------
  from middleware.rate_limit import apply_rate_limits
  apply_rate_limits(app)

The decorator ``@rate_limit(max_requests, window_seconds, key_fn)`` can also
be applied to individual route functions.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from functools import wraps
from threading import Lock
from typing import Callable

from flask import Flask, jsonify, request

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REDIS_URL = os.getenv("REDIS_URL")
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in {
    "1", "true", "yes", "on"
}

# Public (unauthenticated) endpoints
PUBLIC_LIMIT = int(os.getenv("PUBLIC_RATE_LIMIT", "120"))     # requests per window
PUBLIC_WINDOW = int(os.getenv("PUBLIC_RATE_WINDOW", "60"))    # seconds

# Authenticated driver/admin endpoints
AUTH_LIMIT = int(os.getenv("AUTH_RATE_LIMIT", "300"))
AUTH_WINDOW = int(os.getenv("AUTH_RATE_WINDOW", "60"))

# Location POST (high-frequency driver GPS updates)
LOCATION_LIMIT = int(os.getenv("LOCATION_RATE_LIMIT", "600"))
LOCATION_WINDOW = int(os.getenv("LOCATION_RATE_WINDOW", "60"))

# ETA predictions (moderate cost ML inference)
ETA_LIMIT = int(os.getenv("ETA_RATE_LIMIT", "60"))
ETA_WINDOW = int(os.getenv("ETA_RATE_WINDOW", "60"))


# ---------------------------------------------------------------------------
# In-memory backend
# ---------------------------------------------------------------------------

class _InMemoryStore:
    """Thread-safe sliding-window counter using deques."""

    def __init__(self) -> None:
        self._windows: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            dq = self._windows[key]
            # Evict expired timestamps
            while dq and dq[0] < cutoff:
                dq.popleft()

            if len(dq) >= max_requests:
                return False

            dq.append(now)
            return True


# ---------------------------------------------------------------------------
# Redis backend (optional)
# ---------------------------------------------------------------------------

class _RedisStore:
    """Sliding-window via a Redis sorted set (score = timestamp)."""

    def __init__(self, redis_url: str) -> None:
        import redis as redis_lib  # type: ignore[import]
        self._r = redis_lib.from_url(redis_url, decode_responses=True)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        cutoff = now - window_seconds
        pipeline = self._r.pipeline()
        pipeline.zremrangebyscore(key, "-inf", cutoff)
        pipeline.zadd(key, {f"{now}:{id(object())}": now})
        pipeline.zcard(key)
        pipeline.expire(key, window_seconds + 1)
        _, _, count, _ = pipeline.execute()
        return int(count) <= max_requests


# ---------------------------------------------------------------------------
# Singleton store
# ---------------------------------------------------------------------------

def _build_store():
    if REDIS_URL:
        try:
            store = _RedisStore(REDIS_URL)
            # Verify connection
            store._r.ping()  # type: ignore[union-attr]
            print("[RateLimit] Using Redis backend:", REDIS_URL)
            return store
        except Exception as exc:
            print(f"[RateLimit] Redis unavailable ({exc}), falling back to in-memory")
    return _InMemoryStore()


_store = _build_store()


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------

def _client_key() -> str:
    """Best-effort client identifier from X-Forwarded-For or remote address."""
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or "unknown"


def rate_limit(
    max_requests: int,
    window_seconds: int = 60,
    key_fn: Callable[[], str] | None = None,
):
    """
    Route decorator.  Returns 429 when the per-key rate is exceeded.

    Example::

        @app.route("/api/eta/predict", methods=["POST"])
        @rate_limit(60, 60)
        def predict_eta():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not RATE_LIMIT_ENABLED:
                return fn(*args, **kwargs)

            key = (key_fn() if key_fn else _client_key()) + ":" + fn.__name__
            if not _store.is_allowed(key, max_requests, window_seconds):
                return jsonify({
                    "error": "Too many requests. Please slow down.",
                    "retryAfterSeconds": window_seconds,
                }), 429

            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Flask integration
# ---------------------------------------------------------------------------

def apply_rate_limits(app: Flask) -> None:
    """
    Register a before-request hook that enforces rate limits based on the
    URL prefix.  More specific rules take priority (checked first).
    """
    if not RATE_LIMIT_ENABLED:
        return

    rules: list[tuple[str, int, int]] = [
        # (path_prefix, max_requests, window_seconds)
        ("/api/location",      LOCATION_LIMIT, LOCATION_WINDOW),
        ("/api/eta",           ETA_LIMIT,      ETA_WINDOW),
        ("/api/admin",         AUTH_LIMIT,     AUTH_WINDOW),
        ("/api/driver",        AUTH_LIMIT,     AUTH_WINDOW),
        ("/api/",              PUBLIC_LIMIT,   PUBLIC_WINDOW),
    ]

    @app.before_request
    def _check_rate_limit():
        if not RATE_LIMIT_ENABLED:
            return None

        path = request.path
        ip = _client_key()

        for prefix, max_req, window in rules:
            if path.startswith(prefix):
                key = f"{ip}:{prefix}"
                if not _store.is_allowed(key, max_req, window):
                    return jsonify({
                        "error": "Too many requests. Please slow down.",
                        "retryAfterSeconds": window,
                    }), 429
                return None  # allowed

        return None
