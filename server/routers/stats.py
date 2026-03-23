from fastapi import APIRouter
import io
from fastapi.responses import StreamingResponse
import pandas as pd
from datetime import date
from motor.motor_asyncio import AsyncIOMotorClient


client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client["omni_guard"]
alerts_collection = db["alerts"]


router = APIRouter()

@router.get("/api/stats/summary")
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
        "totalAlerts": total_alerts,
        "todayAlerts": today_alerts,
        "totalCameras": total_cameras
    }


@router.get("/api/stats/hourly")
async def get_hourly(user_id: str):

    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        return []

    df = pd.DataFrame(alerts)
    df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour

    hourly = df.groupby("hour").size().reset_index(name="count")

    return hourly.to_dict(orient="records")


@router.get("/api/stats/daily")
async def get_daily(user_id: str):

    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        return []

    df = pd.DataFrame(alerts)
    df["date"] = pd.to_datetime(df["timestamp"]).dt.date.astype(str)

    daily = df.groupby("date").size().reset_index(name="count")

    return daily.to_dict(orient="records")

@router.get("/api/stats/cameras")
async def get_by_camera(user_id: str):

    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        return []

    df = pd.DataFrame(alerts)
    by_camera = df.groupby("cameraName").size().reset_index(name="count")

    return by_camera.to_dict(orient="records")


@router.get("/api/export/csv")
async def export_csv(user_id: str):

    alerts = await alerts_collection.find({"userId": user_id}, {"_id": 0}).to_list(1000)

    if not alerts:
        empty_csv = io.StringIO()
        empty_csv.write("totalAlerts,todayAlerts,totalCameras\n")
        empty_csv.seek(0)
        return StreamingResponse(empty_csv, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=alerts.csv"})

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