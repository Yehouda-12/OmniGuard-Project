from database import alerts_collection
from send_email import send_alert_email
from datetime import datetime
import base64
import os


def register_events(sio):

    @sio.event
    async def connect(sid, environ):
        print(f"✅ Client connected: {sid}")

    @sio.event
    async def disconnect(sid):
        print(f"❌ Client disconnected: {sid}")

    @sio.event
    async def alert(sid, data):
        """
        Receive alert from frontend
        data = {
            userId: str,
            image: str (base64),
            cameraName: str,
            timestamp: str
        }
        """
        print(f"📸 Alert received from camera: {data.get('cameraName')} at {data.get('timestamp')}")

        try:
            # 1. Save alert to MongoDB
            alert_doc = {
                "userId":     data.get("userId"),
                "cameraName": data.get("cameraName"),
                "image":      data.get("image"),
                "timestamp":  data.get("timestamp", datetime.utcnow().isoformat()),
                "type":       data.get("type", "unknownFace"),
            }
            result = await alerts_collection.insert_one(alert_doc)
            print(f"💾 Alert saved to MongoDB: {result.inserted_id}")

            # 2. Save image to captures folder
            captures_dir = os.path.join(os.path.dirname(__file__), "captures")
            os.makedirs(captures_dir, exist_ok=True)

            image_base64 = data.get("image", "")
            if image_base64:
                base64_data = image_base64.replace("data:image/jpeg;base64,", "")
                image_bytes = base64.b64decode(base64_data)
                filename = f"capture_{int(datetime.utcnow().timestamp())}.jpg"
                filepath = os.path.join(captures_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(image_bytes)
                print(f"📁 Image saved: {filename}")

            # 3. Send email alert (Israel handles send_email.py)
            await send_alert_email(
                image_base64=data.get("image"),
                camera_name=data.get("cameraName"),
                timestamp=data.get("timestamp"),
                user_id=data.get("userId")
            )

            # 4. Confirm to frontend
            await sio.emit("alert_received", {
                "success": True,
                "alertId": str(result.inserted_id)
            }, to=sid)

        except Exception as e:
            print(f"❌ Error handling alert: {e}")
            await sio.emit("alert_received", {
                "success": False,
                "error": str(e)
            }, to=sid)