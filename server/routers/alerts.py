from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

try:
    from database import alerts_collection
    from models.alert import Alert
    from routers.auth import get_current_user
    from send_email import send_alert_email
except ImportError:
    from server.database import alerts_collection
    from server.models.alert import Alert
    from server.routers.auth import get_current_user
    from server.send_email import send_alert_email

router = APIRouter(tags=["alerts"])


def serialize_alert(alert: dict) -> dict:
    return {
        "id": str(alert["_id"]),
        "userId": alert["userId"],
        "cameraName": alert["cameraName"],
        "image": alert["image"],
        "timestamp": alert["timestamp"],
        "type": alert["type"],
        "descriptor": alert.get("descriptor"),
        "cameraId": alert.get("cameraId"),
    }


@router.get("")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    alerts = await alerts_collection.find(
        {"userId": str(current_user["_id"])}
    ).to_list(None)
    return [serialize_alert(alert) for alert in alerts]


@router.get("/today")
async def get_today_alerts(current_user: dict = Depends(get_current_user)):
    today = datetime.now().date().isoformat()
    alerts = await alerts_collection.find(
        {
            "userId": str(current_user["_id"]),
            "timestamp": {"$regex": f"^{today}"},
        }
    ).to_list(None)
    return [serialize_alert(alert) for alert in alerts]


@router.delete("/{id}")
async def delete_alert(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid alert id",
        )

    result = await alerts_collection.delete_one(
        {"_id": ObjectId(id), "userId": str(current_user["_id"])}
    )
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    return {"message": "Alert deleted"}


@router.post("")
async def create_alert(alert: Alert, current_user: dict = Depends(get_current_user)):
    alert_document = alert.model_dump()
    alert_document["userId"] = str(current_user["_id"])

    result = await alerts_collection.insert_one(alert_document)
    created_alert = await alerts_collection.find_one({"_id": result.inserted_id})

    alert_email = current_user.get("alertEmail") or current_user.get("email")
    if alert_email:
        try:
            send_alert_email(
                image_base64=alert.image,
                camera_name=alert.cameraName,
                timestamp=alert.timestamp,
                alert_email=alert_email,
            )
        except Exception:
            pass

    return serialize_alert(created_alert)
