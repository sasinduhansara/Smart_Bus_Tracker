import requests
import secrets

from config import TEXTLK_API_TOKEN, TEXTLK_SENDER_ID


def send_sms(mobile, message):
    """Sends an SMS using the text.lk Bearer token API."""
    url = "https://app.text.lk/api/v3/sms/send"
    headers = {
        "Authorization": f"Bearer {TEXTLK_API_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "recipient": mobile,
        "sender_id": TEXTLK_SENDER_ID,
        "type": "plain",
        "message": message,
    }
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        response_payload = response.json()
        provider_status = str(
            response_payload.get("status", "")
            if isinstance(response_payload, dict)
            else ""
        ).strip().lower()

        if provider_status in {"error", "failed", "failure"}:
            return {"ok": False}

        return {"ok": True}
    except (requests.RequestException, ValueError):
        # Do not return provider internals or configuration details to clients.
        return {"ok": False}


def generate_otp():
    return str(100000 + secrets.randbelow(900000))
