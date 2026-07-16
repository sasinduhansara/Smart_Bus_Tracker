import requests
import random
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
        return response.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}

def generate_otp():
    return str(random.randint(100000, 999999))
