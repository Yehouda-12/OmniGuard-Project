import base64
import os
import tempfile

import yagmail


def send_alert_email(
    image_base64: str,
    camera_name: str,
    timestamp: str,
    alert_email: str,
):
    gmail_user = os.getenv("GMAIL_USER")
    gmail_pass = os.getenv("GMAIL_PASS")
    if not gmail_user or not gmail_pass or not alert_email:
        return

    yag = yagmail.SMTP(gmail_user, gmail_pass)

    image_payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
    image_data = base64.b64decode(image_payload)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_image:
        temp_image.write(image_data)
        image_path = temp_image.name

    try:
        yag.send(
            to=alert_email,
            subject="OmniGuard - Intruder detected!",
            contents=f"Camera: {camera_name}\nTime: {timestamp}",
            attachments=image_path,
        )
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)
