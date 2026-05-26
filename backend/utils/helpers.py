import re
from datetime import datetime


def validate_phone(phone):
    """Validate Sri Lankan phone numbers"""
    pattern = r"^\+94\d{9}$"
    return re.match(pattern, phone) is not None


def validate_email(email):
    """Basic email validation"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not True


def format_datetime(dt):
    """Format datetime to ISO string"""
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def sanitize_string(text):
    """Remove extra whitespace"""
    if text:
        return " ".join(text.strip().split())
    return ""


def normalize_phone(phone):
    """
    Normalize Sri Lankan phone numbers to consistent format (with +94 country code).
    Handles: 0712345678, 712345678, +94712345678, 94712345678
    Returns: +94712345678
    """
    if not phone:
        return ""
    
    # Remove all non-digit characters except +
    cleaned = re.sub(r'[^\d+]', '', phone.strip())
    
    # Remove leading 0 if present (after country code handling)
    if cleaned.startswith('+94'):
        # Already has +94 format
        return cleaned
    elif cleaned.startswith('94') and len(cleaned) >= 11:
        # Has 94 but no +
        return '+' + cleaned
    elif cleaned.startswith('0') and len(cleaned) >= 10:
        # Sri Lankan number with leading 0 (e.g., 0712345678)
        return '+94' + cleaned[1:]
    elif len(cleaned) == 9:
        # Without leading 0 and without country code (e.g., 712345678)
        return '+94' + cleaned
    
    # Return as is if can't normalize
    return phone.strip()
