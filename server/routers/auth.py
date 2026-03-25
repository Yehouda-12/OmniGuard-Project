import os
from datetime import datetime, timedelta, timezone

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

try:
    from database import users_collection
    from models.user import User
except ImportError:
    from server.database import users_collection
    from server.models.user import User

router = APIRouter( tags=["auth"])
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "omniguard_secret")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


class LoginRequest(BaseModel):
    """Pydantic model for login credentials."""
    email: str
    password: str


def create_access_token(user_id: str, email: str) -> str:
    """Generates a JWT access token for the authenticated user."""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def serialize_user(user: dict) -> dict:
    """Serializes a MongoDB user document for API response."""
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "alertEmail": user.get("alertEmail"),
        "cameras": user.get("cameras", []),
        "alertSettings": user.get("alertSettings", {}),
        "faceDescriptor": user.get("faceDescriptor"),
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Dependency to retrieve the current user from the JWT bearer token."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


@router.post("/register")
async def register(user: User):
    """Registers a new user account with hashed password."""
    existing_user = await users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_document = user.model_dump()
    user_document["_id"] = ObjectId()
    user_document["password"] = bcrypt.hashpw(
        user.password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    await users_collection.insert_one(user_document)
    token = create_access_token(str(user_document["_id"]), user.email)

    return {"jwt": token, "user": serialize_user(user_document)}


@router.post("/login")
async def login(credentials: LoginRequest):
    """Authenticates a user and returns a JWT."""
    user = await users_collection.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    password_matches = bcrypt.checkpw(
        credentials.password.encode("utf-8"),
        user["password"].encode("utf-8"),
    )
    if not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user["_id"]), user["email"])
    return {"jwt": token, "user": serialize_user(user)}
