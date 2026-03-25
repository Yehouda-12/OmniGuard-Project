from database import users_collection, alerts_collection
from send_email import send_alert_email
from datetime import datetime
from bson import ObjectId
import base64
import os

def register_events(sio):
    """Registers Socket.io event handlers for real-time security events."""
    
    @sio.event
    async def connect(sid, environ):
        """Handles new socket client connections."""
        print(f"✅ Client connected: {sid}")

    @sio.event
    async def disconnect(sid):
        """Handles socket client disconnections."""
        print(f"❌ Client disconnected: {sid}")

    @sio.event
    async def alert(sid, data):
        """Handles incoming real-time alert frames from camera clients."""
        print(f"📸 Alert received from camera: {data.get('cameraName')} at {data.get('timestamp')}")
     
        try:
            # Persist captured frame to local file system
            captures_dir = os.path.join(os.path.dirname(__file__), "captures")
            os.makedirs(captures_dir, exist_ok=True)

            image_base64 = data.get("image", "")
            if image_base64:
                base64_data = image_base64.replace("data:image/jpeg;base64,", "")
                image_bytes = base64.b64decode(base64_data)
                filename = f"capture_{int(datetime.utcnow().timestamp())}.jpg"
                with open(os.path.join(captures_dir, filename), "wb") as f:
                    f.write(image_bytes)
                print(f"📁 Image saved: {filename}")

            # Persist alert metadata and descriptors to MongoDB
            try:
                alert_doc = {
                    "userId":     data.get("userId"),
                    "cameraName": data.get("cameraName"),
                    "image":      data.get("image"),
                    "timestamp":  data.get("timestamp", datetime.utcnow().isoformat()),
                    "type":       data.get("type", "unknownFace"),
                     "descriptor": data.get("descriptor"),   
    "cameraId":   data.get("cameraId"), 
                }
                result = await alerts_collection.insert_one(alert_doc)
                print(f"💾 Alert saved to MongoDB: {result.inserted_id}")
            except Exception as db_error:
                print(f"⚠️ MongoDB error: {db_error}")

            # Trigger SMTP notification exclusively for intruder detection
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
                    
            # Acknowledge event processing to the originating client
            await sio.emit("alert_received", {
    "success":    True,
    "descriptor": data.get("descriptor"),
    "cameraId":   data.get("cameraId"),
    "image":      data.get("image"),
    "cameraName": data.get("cameraName"),
    "timestamp":  data.get("timestamp"),
    "type":       data.get("type"),
}, to=sid)

        except Exception as e:
            print(f"❌ Error handling alert: {e}")
            await sio.emit("alert_received", {"success": False, "error": str(e)}, to=sid)