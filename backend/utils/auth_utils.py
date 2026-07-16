import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from uuid import uuid4

import jwt
from flask import g, jsonify, request


JWT_ALGORITHM = "HS256"


def get_jwt_secret():
    secret = os.getenv("JWT_SECRET", "").strip()

    if not secret:
        raise RuntimeError(
            "JWT_SECRET environment variable is not configured"
        )

    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError(
            "JWT_SECRET must contain at least 32 bytes"
        )

    return secret


def create_access_token(subject, role, expires_hours=24):
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(subject),
        "role": role,
        "tokenType": "access",
        "jti": str(uuid4()),
        "iat": now,
        "exp": now + timedelta(hours=expires_hours),
    }

    return jwt.encode(
        payload,
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )


def get_bearer_token():
    authorization = request.headers.get(
        "Authorization",
        "",
    ).strip()

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()

    return token or None


def jwt_required(view_function):
    @wraps(view_function)
    def wrapped_view(*args, **kwargs):
        token = get_bearer_token()

        if not token:
            return jsonify({
                "error": "Authentication token is required"
            }), 401

        try:
            payload = jwt.decode(
                token,
                get_jwt_secret(),
                algorithms=[JWT_ALGORITHM],
                options={
                    "require": [
                        "exp",
                        "iat",
                        "sub",
                        "role",
                        "tokenType",
                    ]
                },
            )
        except jwt.ExpiredSignatureError:
            return jsonify({
                "error": "Authentication token has expired"
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "error": "Invalid authentication token"
            }), 401

        if payload.get("tokenType") != "access":
            return jsonify({
                "error": "Invalid authentication token type"
            }), 401

        g.auth = payload

        return view_function(*args, **kwargs)

    return wrapped_view


def roles_required(*allowed_roles):
    def decorator(view_function):
        @wraps(view_function)
        def wrapped_view(*args, **kwargs):
            auth_payload = getattr(g, "auth", {})
            current_role = auth_payload.get("role")

            if current_role not in allowed_roles:
                return jsonify({
                    "error": (
                        "You do not have permission "
                        "to perform this action"
                    )
                }), 403

            return view_function(*args, **kwargs)

        return wrapped_view

    return decorator


def subject_matches_route_param(
    parameter_name="driver_id",
):
    def decorator(view_function):
        @wraps(view_function)
        def wrapped_view(*args, **kwargs):
            authenticated_subject = str(
                getattr(g, "auth", {}).get("sub", "")
            )

            requested_subject = str(
                kwargs.get(parameter_name, "")
            )

            if authenticated_subject != requested_subject:
                return jsonify({
                    "error": (
                        "You cannot access another "
                        "driver's information"
                    )
                }), 403

            return view_function(*args, **kwargs)

        return wrapped_view

    return decorator