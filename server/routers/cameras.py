from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

try:
    from database import users_collection
    from models.user import AuthorizedFace, Camera
    from routers.auth import get_current_user
except ImportError:
    from server.database import users_collection
    from server.models.user import AuthorizedFace, Camera
    from server.routers.auth import get_current_user

router = APIRouter( tags=["cameras"])


class CameraUpdateRequest(BaseModel):
    name: str
    url: str
    authorizedFaces: List[AuthorizedFace] = Field(default_factory=list)


def serialize_camera(camera: dict) -> dict:
    return {
        "id": camera["id"],
        "name": camera["name"],
        "url": camera["url"],
        "authorizedFaces": camera.get("authorizedFaces", []),
    }


@router.get("")
async def get_cameras(current_user: dict = Depends(get_current_user)):
    return [serialize_camera(camera) for camera in current_user.get("cameras", [])]


@router.post("")
async def add_camera(camera: Camera, current_user: dict = Depends(get_current_user)):
    camera_document = camera.model_dump()
    camera_document["id"] = str(ObjectId())

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$push": {"cameras": camera_document}},
    )
    return serialize_camera(camera_document)


@router.put("/{id}")
async def update_camera(
    id: str,
    camera: CameraUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    cameras = current_user.get("cameras", [])
    existing_camera = next((cam for cam in cameras if cam.get("id") == id), None)
    if existing_camera is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )

    updated_camera = {
        "id": id,
        "name": camera.name,
        "url": camera.url,
        "authorizedFaces": [
            face.model_dump() if hasattr(face, "model_dump") else face
            for face in camera.authorizedFaces
        ],
    }

    await users_collection.update_one(
        {"_id": current_user["_id"], "cameras.id": id},
        {"$set": {"cameras.$": updated_camera}},
    )
    return serialize_camera(updated_camera)


@router.delete("/{id}")
async def delete_camera(id: str, current_user: dict = Depends(get_current_user)):
    cameras = current_user.get("cameras", [])
    filtered_cameras = [camera for camera in cameras if camera.get("id") != id]

    if len(filtered_cameras) == len(cameras):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"cameras": filtered_cameras}},
    )
    return {"message": "Camera deleted"}
