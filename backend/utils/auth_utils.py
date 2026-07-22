import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from uuid import uuid4

import jwt
from flask import g, has_request_context, jsonify, request


JWT_ALGORITHM = "HS256"


def get_jwt_secret():
    """
    Return the JWT secret stored in the environment.

    The secret must be configured and contain at least 32 bytes.
    """
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


def create_access_token(
    subject,
    role,
    expires_hours=24,
):
    """
    Create a signed JWT access token.

    Args:
        subject: Authenticated user or driver ID.
        role: Role assigned to the authenticated account.
        expires_hours: Token validity period in hours.

    Returns:
        Encoded JWT access token.
    """
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(subject),
        "role": str(role),
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
    """
    Extract the Bearer token from the Authorization header.

    Returns:
        JWT token string or None when the header is missing or invalid.
    """
    authorization = request.headers.get(
        "Authorization",
        "",
    ).strip()

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()

    return token or None


def jwt_required(view_function):
    """
    Require a valid JWT access token before executing a route.

    The decoded JWT payload is stored in Flask's request-local
    g.auth object.
    """

    @wraps(view_function)
    def wrapped_view(*args, **kwargs):
        token = get_bearer_token()

        if not token:
            return jsonify({
                "error": "Authentication token is required",
                "code": "AUTH_TOKEN_REQUIRED",
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
                    ],
                },
            )

        except jwt.ExpiredSignatureError:
            return jsonify({
                "error": "Authentication token has expired",
                "code": "AUTH_TOKEN_EXPIRED",
            }), 401

        except jwt.InvalidTokenError:
            return jsonify({
                "error": "Invalid authentication token",
                "code": "AUTH_TOKEN_INVALID",
            }), 401

        if payload.get("tokenType") != "access":
            return jsonify({
                "error": "Invalid authentication token type",
                "code": "AUTH_TOKEN_TYPE_INVALID",
            }), 401

        subject = str(
            payload.get("sub", "")
        ).strip()

        role = str(
            payload.get("role", "")
        ).strip()

        if not subject or not role:
            return jsonify({
                "error": "Authentication token is missing required claims",
                "code": "AUTH_TOKEN_CLAIMS_INVALID",
            }), 401

        g.auth = payload

        return view_function(
            *args,
            **kwargs,
        )

    return wrapped_view


def roles_required(*allowed_roles):
    """
    Require the authenticated account to have one of the supplied roles.

    This decorator must be placed below jwt_required so that g.auth
    is available before the role is checked.

    Example:

        @jwt_required
        @roles_required("admin")
        def admin_route():
            ...
    """
    normalized_roles = {
        str(role).strip()
        for role in allowed_roles
        if str(role).strip()
    }

    def decorator(view_function):
        @wraps(view_function)
        def wrapped_view(*args, **kwargs):
            auth_payload = getattr(
                g,
                "auth",
                {},
            )

            if not isinstance(
                auth_payload,
                dict,
            ):
                auth_payload = {}

            current_role = str(
                auth_payload.get(
                    "role",
                    "",
                )
            ).strip()

            if current_role not in normalized_roles:
                return jsonify({
                    "error": (
                        "You do not have permission "
                        "to perform this action"
                    ),
                    "code": "ROLE_NOT_ALLOWED",
                }), 403

            return view_function(
                *args,
                **kwargs,
            )

        return wrapped_view

    return decorator


def subject_matches_route_param(
    parameter_name="driver_id",
):
    """
    Ensure that the JWT subject matches a route parameter.

    This prevents one driver from accessing another driver's records.

    Example:

        @jwt_required
        @subject_matches_route_param("driver_id")
        def get_driver(driver_id):
            ...
    """

    def decorator(view_function):
        @wraps(view_function)
        def wrapped_view(*args, **kwargs):
            auth_payload = getattr(
                g,
                "auth",
                {},
            )

            if not isinstance(
                auth_payload,
                dict,
            ):
                auth_payload = {}

            authenticated_subject = str(
                auth_payload.get(
                    "sub",
                    "",
                )
            ).strip()

            requested_subject = str(
                kwargs.get(
                    parameter_name,
                    "",
                )
            ).strip()

            if (
                not authenticated_subject
                or authenticated_subject
                != requested_subject
            ):
                return jsonify({
                    "error": (
                        "You cannot access another "
                        "driver's information"
                    ),
                    "code": "SUBJECT_MISMATCH",
                }), 403

            return view_function(
                *args,
                **kwargs,
            )

        return wrapped_view

    return decorator


def get_jwt_identity():
    """
    Return the authenticated JWT subject.

    This compatibility helper allows routes written using
    Flask-JWT-Extended-style naming to work with this project's
    custom PyJWT authentication implementation.

    Returns:
        Authenticated subject as a string, or None when there is no
        active authenticated request.
    """
    if not has_request_context():
        return None

    auth_payload = getattr(
        g,
        "auth",
        None,
    )

    if not isinstance(
        auth_payload,
        dict,
    ):
        return None

    subject = auth_payload.get("sub")

    if subject is None:
        return None

    normalized_subject = str(
        subject
    ).strip()

    return normalized_subject or None


def get_jwt_claims():
    """
    Return a copy of the decoded JWT claims.

    This compatibility helper allows routes written using
    Flask-JWT-Extended-style naming to work with the custom
    jwt_required decorator.

    Returns:
        Dictionary containing the decoded JWT claims.
    """
    if not has_request_context():
        return {}

    auth_payload = getattr(
        g,
        "auth",
        None,
    )

    if not isinstance(
        auth_payload,
        dict,
    ):
        return {}

    return dict(auth_payload)