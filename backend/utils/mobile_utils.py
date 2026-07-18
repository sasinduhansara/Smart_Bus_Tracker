def normalize_mobile(mobile):
    if not isinstance(mobile, str):
        return ""

    mobile = mobile.strip().replace(" ", "").replace("-", "")
    if not mobile:
        return ""

    if mobile.startswith("+94"):
        mobile = mobile[1:]
    elif mobile.startswith("0"):
        mobile = "94" + mobile[1:]
    elif not mobile.startswith("94"):
        mobile = "94" + mobile
    return mobile
