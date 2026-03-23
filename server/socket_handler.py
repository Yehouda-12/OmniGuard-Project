from database import users_collection, alerts_collection
from send_email import send_alert_email
from datetime import datetime
from bson import ObjectId
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
        print(f"📸 Alert received from camera: {data.get('cameraName')} at {data.get('timestamp')}")

        try:
            # 1. Sauvegarder image dans /captures
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

            # 2. Sauvegarder dans MongoDB
            try:
                alert_doc = {
                    "userId":     data.get("userId"),
                    "cameraName": data.get("cameraName"),
                    "image":      data.get("image"),
                    "timestamp":  data.get("timestamp", datetime.utcnow().isoformat()),
                    "type":       data.get("type", "unknownFace"),
                }
                result = await alerts_collection.insert_one(alert_doc)
                print(f"💾 Alert saved to MongoDB: {result.inserted_id}")
            except Exception as db_error:
                print(f"⚠️ MongoDB error: {db_error}")

            # 3. Récupérer l'email de l'user et envoyer
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

            # 4. Confirmer au frontend
            await sio.emit("alert_received", {"success": True}, to=sid)

        except Exception as e:
            print(f"❌ Error handling alert: {e}")
            await sio.emit("alert_received", {"success": False, "error": str(e)}, to=sid)