from database import users_collection, alerts_collection
from send_email import send_alert_email
from datetime import datetime
from bson import ObjectId
import base64
import os
import numpy as np
import cv2

# ── OpenCV Face Detection setup ───────────────────────────────────────────────
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
)

def decode_image(image_base64: str):
    """Convert base64 image to numpy array"""
    base64_data = image_base64.replace("data:image/jpeg;base64,", "").replace("data:image/png;base64,", "")
    image_bytes = base64.b64decode(base64_data)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def get_face_descriptor(img, face_rect):
    x, y, w, h = face_rect
    face_img = img[y:y+h, x:x+w]
    if face_img.size == 0:
        return None
    # Change 32x32 → 8x16 = 128 numbers pour être compatible avec face-api.js
    face_resized = cv2.resize(face_img, (16, 8))
    face_gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
    descriptor = face_gray.flatten().astype(float)
    norm = np.linalg.norm(descriptor)
    if norm > 0:
        descriptor = descriptor / norm
    return descriptor.tolist()

def compare_descriptors(desc1, desc2, threshold=0.3):
    """Compare two face descriptors"""
    d1 = np.array(desc1)
    d2 = np.array(desc2)
    distance = np.linalg.norm(d1 - d2)
    return distance < threshold

def detect_faces(img):
    """Detect faces using OpenCV Haar Cascade"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30)
    )
    return faces if len(faces) > 0 else []


def register_events(sio):

    @sio.event
    async def connect(sid, environ):
        print(f"✅ Client connected: {sid}")

    @sio.event
    async def disconnect(sid):
        print(f"❌ Client disconnected: {sid}")

    # ─── NOUVEAU : Gestion des Rooms ──────────────────────────────────────────
    @sio.on("join")
    async def handle_join(sid, user_id):
        """Permet de lier un client (React ou Python) à une Room User"""
        if user_id:
            sio.enter_room(sid, str(user_id))
            print(f"🏠 SID {sid} a rejoint la room: {user_id}")

    @sio.event
    async def frame(sid, data):
        """Receive frame from frontend for server-side analysis"""
        try:
            image_base64 = data.get("image", "")
            user_id      = data.get("userId")
            camera_id    = data.get("cameraId")
            camera_name  = data.get("cameraName", "Camera")

            if not image_base64:
                return

            img = decode_image(image_base64)
            if img is None:
                return

            faces = detect_faces(img)
            face_count = len(faces)

            if face_count == 0:
                # Modifié : on envoie à la room au lieu de juste sid
                await sio.emit("detection_result", {
                    "faceCount": 0,
                    "isUnknown": False
                }, room=str(user_id))
                return

            # Get authorized faces from MongoDB
            authorized_faces = []
            user = None
            try:
                user = await users_collection.find_one({"_id": ObjectId(user_id)})
                if user:
                    cameras = user.get("cameras", [])
                    cam = next((c for c in cameras if c.get("id") == camera_id), None)
                    if cam:
                        authorized_faces = cam.get("authorizedFaces", [])
            except Exception:
                pass

            # Check each detected face
            is_unknown = False
            unknown_descriptor = None
            unknown_image = image_base64

            for face_rect in faces:
                descriptor = get_face_descriptor(img, face_rect)
                if descriptor is None:
                    continue

                # Compare with authorized faces
                match_found = False
                if authorized_faces:
                    for auth_face in authorized_faces:
                        auth_descriptor = auth_face.get("descriptor", [])
                        if auth_descriptor and compare_descriptors(descriptor, auth_descriptor):
                            match_found = True
                            print(f"✅ Known face: {auth_face.get('name')}")
                            break

                if not match_found:
                    is_unknown = True
                    unknown_descriptor = descriptor
                    print(f"🚨 Unknown face on {camera_name}")
                    break

            # Send result to frontend (Modifié : room=user_id)
            await sio.emit("detection_result", {
                "faceCount":  face_count,
                "isUnknown":  is_unknown,
                "descriptor": unknown_descriptor,
                "cameraId":   camera_id,
                "cameraName": camera_name,
                "image":      image_base64 if is_unknown else None,
                "timestamp":  data.get("timestamp"),
            }, room=str(user_id))

            # If unknown → save alert + email
            if is_unknown:
                captures_dir = os.path.join(os.path.dirname(__file__), "captures")
                os.makedirs(captures_dir, exist_ok=True)
                try:
                    base64_data = image_base64.replace("data:image/jpeg;base64,", "")
                    image_bytes = base64.b64decode(base64_data)
                    filename = f"capture_{int(datetime.utcnow().timestamp())}.jpg"
                    with open(os.path.join(captures_dir, filename), "wb") as f:
                        f.write(image_bytes)
                except Exception:
                    pass

                try:
                    alert_doc = {
                        "userId":     user_id,
                        "cameraName": camera_name,
                        "cameraId":   camera_id,
                        "image":      image_base64,
                        "timestamp":  data.get("timestamp", datetime.utcnow().isoformat()),
                        "type":       "unknownFace",
                        "descriptor": unknown_descriptor,
                    }
                    result = await alerts_collection.insert_one(alert_doc)
                    print(f"💾 Alert saved: {result.inserted_id}")
                except Exception as db_error:
                    print(f"⚠️ MongoDB error: {db_error}")

                try:
                    if user:
                        alert_email = user.get("alertEmail")
                        if alert_email:
                            send_alert_email(
                                image_base64=image_base64,
                                camera_name=camera_name,
                                timestamp=data.get("timestamp"),
                                alert_email=alert_email
                            )
                except Exception as email_error:
                    print(f"⚠️ Email error: {email_error}")

        except Exception as e:
            print(f"❌ Frame error: {e}")

    @sio.event
    async def alert(sid, data):
        """Legacy event — kept for compatibility"""
        print(f"📸 Legacy alert: {data.get('cameraName')}")
        user_id = data.get("userId")
        try:
            captures_dir = os.path.join(os.path.dirname(__file__), "captures")
            os.makedirs(captures_dir, exist_ok=True)

            image_base64 = data.get("image", "")
            if image_base64:
                base64_data = image_base64.replace("data:image/jpeg;base64,", "")
                image_bytes = base64.b64decode(base64_data)
                filename = f"capture_{int(datetime.utcnow().timestamp())}.jpg"
                with open(os.path.join(captures_dir, filename), "wb") as f:
                    f.write(image_bytes)

            try:
                alert_doc = {
                    "userId":     user_id,
                    "cameraName": data.get("cameraName"),
                    "cameraId":   data.get("cameraId"),
                    "image":      data.get("image"),
                    "timestamp":  data.get("timestamp", datetime.utcnow().isoformat()),
                    "type":       data.get("type", "unknownFace"),
                    "descriptor": data.get("descriptor"),
                }
                await alerts_collection.insert_one(alert_doc)
            except Exception as db_error:
                print(f"⚠️ MongoDB error: {db_error}")

            try:
                user = await users_collection.find_one({"_id": ObjectId(user_id)})
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

            # Modifié : on envoie à la room
            await sio.emit("alert_received", {
                "success":     True,
                "descriptor": data.get("descriptor"),
                "cameraId":   data.get("cameraId"),
                "image":      data.get("image"),
                "cameraName": data.get("cameraName"),
                "timestamp":  data.get("timestamp"),
                "type":       data.get("type"),
            }, room=str(user_id))

        except Exception as e:
            print(f"❌ Error: {e}")
            await sio.emit("alert_received", {"success": False}, room=str(user_id))