import os
from datetime import datetime, timezone

from bson.objectid import ObjectId
from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
)
from werkzeug.utils import secure_filename

from config import drivers_collection
from utils.auth_utils import (
    jwt_required,
    roles_required,
    subject_matches_route_param,
)
from utils.mobile_utils import normalize_mobile
from utils.storage_service import (
    delete_document,
    upload_document,
)


document_bp = Blueprint("document_bp", __name__)


DOCUMENT_TYPES = {
    "nicFront",
    "nicBack",
    "drivingLicenseFront",
    "drivingLicenseBack",
}

DOCUMENT_TYPE_ALIASES = {
    "nic_front": "nicFront",
    "nic_back": "nicBack",
    "driving_license": "drivingLicenseFront",
    "driving_license_front": "drivingLicenseFront",
    "driving_license_back": "drivingLicenseBack",
}

ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_FILE_SIZE = 5 * 1024 * 1024


def normalize_document_type(value):
    document_type = str(value or "").strip()

    return DOCUMENT_TYPE_ALIASES.get(
        document_type,
        document_type,
    )


def detect_image_mime_type(file_bytes):
    if file_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    if file_bytes.startswith(
        b"\x89PNG\r\n\x1a\n"
    ):
        return "image/png"

    if (
        len(file_bytes) >= 12
        and file_bytes[:4] == b"RIFF"
        and file_bytes[8:12] == b"WEBP"
    ):
        return "image/webp"

    return None


def read_and_validate_image(uploaded_file):
    if not uploaded_file:
        return (
            None,
            None,
            None,
            "No file was provided",
        )

    if not uploaded_file.filename:
        return (
            None,
            None,
            None,
            "The uploaded file has no filename",
        )

    file_bytes = uploaded_file.read()

    if not file_bytes:
        return (
            None,
            None,
            None,
            "Uploaded file is empty",
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        return (
            None,
            None,
            None,
            "File exceeds the 5 MB limit",
        )

    detected_mime_type = detect_image_mime_type(
        file_bytes
    )

    if detected_mime_type is None:
        return (
            None,
            None,
            None,
            (
                "Only valid JPEG, PNG, or WebP "
                "images are allowed"
            ),
        )

    declared_mime_type = str(
        uploaded_file.content_type or ""
    ).strip().lower()

    if (
        declared_mime_type
        and declared_mime_type
        != "application/octet-stream"
        and declared_mime_type
        not in ALLOWED_IMAGE_MIME_TYPES
    ):
        return (
            None,
            None,
            None,
            "Unsupported document image type",
        )

    safe_file_name = secure_filename(
        uploaded_file.filename
    )

    if not safe_file_name:
        extension_by_type = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
        }

        extension = extension_by_type[
            detected_mime_type
        ]

        safe_file_name = (
            f"document-{int(datetime.now().timestamp())}"
            f".{extension}"
        )

    return (
        file_bytes,
        safe_file_name,
        detected_mime_type,
        None,
    )


def validate_driver_id(driver_id):
    if not ObjectId.is_valid(driver_id):
        return None

    return ObjectId(driver_id)


def build_upload_response(
    document_type,
    result,
):
    return jsonify({
        "status": "uploaded",
        "docType": document_type,
        "url": result.get("url", ""),
        "fileName": result.get(
            "fileName",
            "",
        ),
        "mimeType": result.get(
            "mimeType",
            "",
        ),
        "document": result,
    })


def build_storage_error_response(
    error,
    message="Document upload failed",
):
    current_app.logger.exception(message)

    response = {
        "error": message,
    }

    # Show actual error only during development.
    if current_app.debug:
        response["details"] = str(error)

    return jsonify(response), 500


@document_bp.route(
    "/api/driver/register/documents/upload",
    methods=["POST"],
)
def upload_registration_document():
    """
    Upload a document before the driver account
    has been created.

    This endpoint cannot use a driver JWT yet
    because registration has not been completed.
    """

    if "file" not in request.files:
        return jsonify({
            "error": "No file provided",
        }), 400

    document_type = normalize_document_type(
        request.form.get("docType")
    )

    mobile = normalize_mobile(
        request.form.get(
            "mobile",
            "",
        ).strip()
    )

    if document_type not in DOCUMENT_TYPES:
        return jsonify({
            "error": (
                "Invalid docType. Allowed: "
                + ", ".join(
                    sorted(DOCUMENT_TYPES)
                )
            ),
        }), 400

    if not mobile:
        return jsonify({
            "error": (
                "Mobile number is required "
                "before document upload"
            ),
        }), 400

    (
        file_bytes,
        safe_file_name,
        mime_type,
        validation_error,
    ) = read_and_validate_image(
        request.files["file"]
    )

    if validation_error:
        return jsonify({
            "error": validation_error,
        }), 400

    try:
        result = upload_document(
            file_bytes,
            safe_file_name,
            mime_type,
            mobile,
        )
    except Exception as error:
        return build_storage_error_response(
            error,
            "Registration document upload failed",
        )

    return build_upload_response(
        document_type,
        result,
    )


@document_bp.route(
    "/api/driver/<driver_id>/documents/upload",
    methods=["POST"],
)
@jwt_required
@roles_required("driver")
@subject_matches_route_param("driver_id")
def upload_driver_document(driver_id):
    driver_object_id = validate_driver_id(driver_id)

    if driver_object_id is None:
        return jsonify({
            "error": "Invalid driver id",
        }), 400

    driver = drivers_collection.find_one({
        "_id": driver_object_id,
    })

    if not driver:
        return jsonify({
            "error": "Driver not found",
        }), 404

    if "file" not in request.files:
        return jsonify({
            "error": "No file provided",
        }), 400

    document_type = normalize_document_type(
        request.form.get("docType")
    )

    if document_type not in DOCUMENT_TYPES:
        return jsonify({
            "error": (
                "Invalid docType. Allowed: "
                + ", ".join(sorted(DOCUMENT_TYPES))
            ),
        }), 400

    (
        file_bytes,
        safe_file_name,
        mime_type,
        validation_error,
    ) = read_and_validate_image(
        request.files["file"]
    )

    if validation_error:
        return jsonify({
            "error": validation_error,
        }), 400

    mobile = str(
        driver.get("mobile", driver_id)
    ).strip()

    try:
        result = upload_document(
            file_bytes,
            safe_file_name,
            mime_type,
            mobile,
        )
    except Exception as error:
        return build_storage_error_response(
            error,
            "Driver document upload failed",
        )

    now = datetime.now(timezone.utc)
    document_field = f"documents.{document_type}"

    drivers_collection.update_one(
        {
            "_id": driver_object_id,
        },
        {
            "$set": {
                document_field: result,
                "updatedAt": now,
            },
        },
    )

    return build_upload_response(
        document_type,
        result,
    )

@document_bp.route(
    "/api/driver/<driver_id>/documents",
    methods=["GET"],
)
@jwt_required
@roles_required("driver")
@subject_matches_route_param("driver_id")
def get_driver_documents(driver_id):
    driver_object_id = validate_driver_id(
        driver_id
    )

    if driver_object_id is None:
        return jsonify({
            "error": "Invalid driver id",
        }), 400

    driver = drivers_collection.find_one(
        {
            "_id": driver_object_id,
        },
        {
            "documents": 1,
            "kycStatus": 1,
        },
    )

    if not driver:
        return jsonify({
            "error": "Driver not found",
        }), 404

    return jsonify({
        "documents": driver.get(
            "documents",
            {},
        ),
        "kycStatus": driver.get(
            "kycStatus",
            "NOT_SUBMITTED",
        ),
    })


@document_bp.route(
    (
        "/api/driver/<driver_id>/documents/"
        "<document_type>"
    ),
    methods=["DELETE"],
)
@jwt_required
@roles_required("driver")
@subject_matches_route_param("driver_id")
def delete_driver_document(
    driver_id,
    document_type,
):
    driver_object_id = validate_driver_id(
        driver_id
    )

    if driver_object_id is None:
        return jsonify({
            "error": "Invalid driver id",
        }), 400

    normalized_document_type = (
        normalize_document_type(
            document_type
        )
    )

    if (
        normalized_document_type
        not in DOCUMENT_TYPES
    ):
        return jsonify({
            "error": (
                "Invalid docType. Allowed: "
                + ", ".join(
                    sorted(DOCUMENT_TYPES)
                )
            ),
        }), 400

    driver = drivers_collection.find_one({
        "_id": driver_object_id,
    })

    if not driver:
        return jsonify({
            "error": "Driver not found",
        }), 404

    document_info = driver.get(
        "documents",
        {},
    ).get(normalized_document_type)

    if not document_info:
        return jsonify({
            "error": "Document not found",
        }), 404

    storage_file_name = str(
        document_info.get(
            "fileName",
            "",
        )
    ).strip()

    try:
        if storage_file_name:
            delete_document(
                storage_file_name
            )
    except Exception as error:
        return build_storage_error_response(
            error,
            "Could not delete document from storage",
        )

    document_field = (
        f"documents.{normalized_document_type}"
    )

    drivers_collection.update_one(
        {
            "_id": driver_object_id,
        },
        {
            "$unset": {
                document_field: "",
            },
            "$set": {
                "updatedAt": datetime.now(
                    timezone.utc
                ),
            },
        },
    )

    return jsonify({
        "status": "deleted",
        "docType": normalized_document_type,
    })