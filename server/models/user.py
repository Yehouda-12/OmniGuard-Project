from pydantic import BaseModel
from typing import List, Optional

class AuthorizedFace(BaseModel):
    name: str
    descriptor: List[float]  # 128 numbers

class Camera(BaseModel):
    name: str
    url: str
    authorizedFaces: List[AuthorizedFace] = []

class User(BaseModel):
    name: str
    email: str
    password: str
    faceDescriptor: Optional[List[float]] = None
    alertEmail: Optional[str] = None
    cameras: List[Camera] = []
    alertSettings: dict = {
        "unknownFace": True,
        "motion": True,
        "multiplePeople": False
    }