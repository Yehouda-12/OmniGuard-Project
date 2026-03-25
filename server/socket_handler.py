import base64
import os
import tempfile
from datetime import datetime

from bson import ObjectId

try:
    from database import users_collection, alerts_collection
    from send_email import send_alert_email
except ImportError:
    from server.database import users_collection, alerts_collection
    from server.send_email import send_alert_email

def register_events(sio):

    @sio.event
    async def connect(sid, environ):
        print(f"✅ Client connected: {sid}")

    @sio.event
    async def disconnect(sid):
        print(f"❌ Client disconnected: {sid}")

    @sio.event
    async def alert(sid, data):
        print(f"📸 Alert received from camera: {data.get('cameraName')} at {data.get('timestamp')}")
     
        try:
            # 1. Save capture to a writable temp directory when possible.
            image_base64 = data.get("image", "")
            if image_base64:
                try:
                    captures_dir = os.path.join(tempfile.gettempdir(), "omniguard-captures")
                    os.makedirs(captures_dir, exist_ok=True)

                    base64_data = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
                    image_bytes = base64.b64decode(base64_data)
                    filename = f"capture_{int(datetime.utcnow().timestamp())}.jpg"
                    capture_path = os.path.join(captures_dir, filename)
                    with open(capture_path, "wb") as f:
                        f.write(image_bytes)
                    print(f"📁 Image saved: {capture_path}")
                except Exception as image_error:
                    print(f"⚠️ Capture save skipped: {image_error}")

            # 2. Save alert in MongoDB even if image persistence failed.
            try:
                alert_doc = {
                    "userId": data.get("userId"),
                    "cameraName": data.get("cameraName"),
                    "image": data.get("image"),
                    "timestamp": data.get("timestamp", datetime.utcnow().isoformat()),
                    "type": data.get("type", "unknownFace"),
                    "descriptor": data.get("descriptor"),
                    "cameraId": data.get("cameraId"),
                }
                result = await alerts_collection.insert_one(alert_doc)
                print(f"💾 Alert saved to MongoDB: {result.inserted_id}")
            except Exception as db_error:
                print(f"⚠️ MongoDB error: {db_error}")

            # 3. Only send email for unknown faces.
            if data.get("type") != "knownFace":
                try:
                    user = await users_collection.find_one({"_id": ObjectId(data.get("userId"))})
                    alert_email = user.get("alertEmail") if user else None
                    if alert_email:
                        send_alert_email(
                            image_base64=data.get("image"),
                            camera_name=data.get("cameraName"),
                            timestamp=data.get("timestamp"),
                            alert_email=alert_email
                        )
                except Exception as email_error:
                    print(f"⚠️ Email error: {email_error}")
            else:
                print(f"✅ Known face — no email sent")
                    
            # 4. Confirm back to the frontend client.
            await sio.emit("alert_received", {
                "success": True,
                "descriptor": data.get("descriptor"),
                "cameraId": data.get("cameraId"),
                "image": data.get("image"),
                "cameraName": data.get("cameraName"),
                "timestamp": data.get("timestamp"),
                "type": data.get("type"),
            }, to=sid)

        except Exception as e:
            print(f"❌ Error handling alert: {e}")
            await sio.emit("alert_received", {"success": False, "error": str(e)}, to=sid)
