import io
from datetime import date

import pandas as pd
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

try:
    from database import alerts_collection
except ImportError:
    from server.database import alerts_collection

router = APIRouter(tags=["stats"])


@router.get("/summary")
async def get_summary(user_id: str):
    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        return {"totalAlerts": 0, "todayAlerts": 0, "totalCameras": 0}

    df = pd.DataFrame(alerts)
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    today = date.today()
    total_alerts = len(df)
    today_alerts = len(df[df["timestamp"].dt.date == today])
    total_cameras = df["cameraName"].nunique()

    return {
        "totalAlerts": int(total_alerts),
        "todayAlerts": int(today_alerts),
        "totalCameras": int(total_cameras),
    }


@router.get("/hourly")
async def get_hourly(user_id: str):
    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        return []

    df = pd.DataFrame(alerts)
    df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour
    hourly = df.groupby("hour").size().reset_index(name="count")

    return hourly.to_dict(orient="records")


@router.get("/daily")
async def get_daily(user_id: str):
    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        return []

    df = pd.DataFrame(alerts)
    df["date"] = pd.to_datetime(df["timestamp"]).dt.date.astype(str)
    daily = df.groupby("date").size().reset_index(name="count")

    return daily.to_dict(orient="records")


@router.get("/cameras")
async def get_by_camera(user_id: str):
    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        return []

    df = pd.DataFrame(alerts)
    by_camera = df.groupby("cameraName").size().reset_index(name="count")

    return by_camera.to_dict(orient="records")


@router.get("/csv")
async def export_csv(user_id: str):
    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        stream = io.StringIO()
        stream.write("userId,cameraName,timestamp,type\n")
        stream.seek(0)
        return StreamingResponse(
            stream,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=alerts.csv"}
        )

    df = pd.DataFrame(alerts)

    if "image" in df.columns:
        df = df.drop(columns=["image"])

    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=alerts.csv"}
    )
