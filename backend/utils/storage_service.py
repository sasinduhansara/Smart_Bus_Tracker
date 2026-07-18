import hashlib
import hmac
import uuid
from urllib.parse import quote

from storage3 import create_client

from config import (
    SUPABASE_BUCKET,
    SUPABASE_SERVICE_KEY,
    SUPABASE_URL,
)
from utils.auth_utils import get_jwt_secret


STORAGE_BUCKET = str(
    SUPABASE_BUCKET or ""
).strip()

_storage = None


def get_storage_url() -> str:
    """
    Return the Supabase Storage API URL.

    Expected result:
    https://PROJECT_REF.supabase.co/storage/v1/
    """

    supabase_url = str(
        SUPABASE_URL or ""
    ).strip().rstrip("/")

    if not supabase_url:
        raise RuntimeError(
            "SUPABASE_URL is not configured"
        )

    # Support accidentally supplied API-specific URLs.
    for suffix in (
        "/rest/v1",
        "/auth/v1",
        "/realtime/v1",
        "/storage/v1",
    ):
        if supabase_url.endswith(suffix):
            supabase_url = supabase_url[
                : -len(suffix)
            ]
            break

    return f"{supabase_url}/storage/v1/"


def get_storage_headers() -> dict[str, str]:
    """
    New sb_secret_ keys are API keys, not JWTs.

    Send the secret key using only the apikey header.
    Supabase's gateway will apply the service role.
    """

    supabase_key = str(
        SUPABASE_SERVICE_KEY or ""
    ).strip()

    if not supabase_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_KEY is not configured"
        )

    return {
        "apikey": supabase_key,
    }


def validate_storage_config() -> None:
    if not STORAGE_BUCKET:
        raise RuntimeError(
            "SUPABASE_BUCKET is not configured"
        )


def get_storage():
    global _storage

    validate_storage_config()

    if _storage is None:
        _storage = create_client(
            get_storage_url(),
            get_storage_headers(),
            is_async=False,
        )

    return _storage


def build_safe_folder(driver_mobile: str) -> str:
    """
    Build a stable opaque folder without exposing a driver's mobile number.
    """

    safe_mobile = "".join(
        character
        for character in str(driver_mobile or "")
        if character.isalnum()
    )

    if not safe_mobile:
        raise ValueError("A driver mobile number is required")

    folder_digest = hmac.new(
        get_jwt_secret().encode("utf-8"),
        safe_mobile.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:24]

    return f"driver-{folder_digest}"


def get_extension(
    filename: str,
    mime_type: str,
) -> str:
    extension_by_mime_type = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }

    detected_extension = extension_by_mime_type.get(
        str(mime_type or "").lower()
    )

    if detected_extension:
        return detected_extension

    if "." in str(filename or ""):
        return (
            str(filename)
            .rsplit(".", 1)[-1]
            .lower()
        )

    return "jpg"


def build_public_document_url(file_name: str) -> str:
    normalized_file_name = str(file_name or "").strip().lstrip("/")
    if not normalized_file_name:
        raise ValueError("Storage file name is required")

    validate_storage_config()
    storage_api_url = get_storage_url().rstrip("/")
    bucket = quote(STORAGE_BUCKET, safe="")
    encoded_path = quote(normalized_file_name, safe="/")

    return f"{storage_api_url}/object/public/{bucket}/{encoded_path}"


def upload_document(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    driver_mobile: str,
) -> dict:
    """
    Upload a document to Supabase Storage.
    """

    if not file_bytes:
        raise ValueError(
            "Cannot upload an empty document"
        )

    storage = get_storage()

    safe_folder = build_safe_folder(
        driver_mobile
    )

    extension = get_extension(
        filename,
        mime_type,
    )

    unique_name = (
        f"{safe_folder}/"
        f"{uuid.uuid4().hex}.{extension}"
    )

    storage.from_(STORAGE_BUCKET).upload(
        path=unique_name,
        file=file_bytes,
        file_options={
            "content-type": mime_type,
            "upsert": "false",
        },
    )

    public_url = build_public_document_url(unique_name)

    return {
        "fileName": unique_name,
        "url": public_url,
        "mimeType": mime_type,
    }


def delete_document(
    file_name: str,
) -> bool:
    """
    Delete a document from Supabase Storage.

    Errors are allowed to propagate so the route can
    log and return the correct server response.
    """

    normalized_file_name = str(
        file_name or ""
    ).strip()

    if not normalized_file_name:
        raise ValueError(
            "Storage file name is required"
        )

    storage = get_storage()

    storage.from_(STORAGE_BUCKET).remove([
        normalized_file_name,
    ])

    return True
