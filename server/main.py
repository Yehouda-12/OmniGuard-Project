import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import httpx
import os

load_dotenv()

# ─── Setup FastAPI + Socket.io ────────────────────────────────────────────────
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI()
socket_app = socketio.ASGIApp(sio, app)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Import routers (Israel + Danny) ─────────────────────────────────────────
from routers import auth, alerts, cameras, stats
app.include_router(auth.router,    prefix="/api/auth",    tags=["auth"])
app.include_router(alerts.router,  prefix="/api/alerts",  tags=["alerts"])
app.include_router(cameras.router, prefix="/api/cameras", tags=["cameras"])
app.include_router(stats.router,   prefix="/api/stats",   tags=["stats"])

# ─── Import socket handler (Yehouda) ─────────────────────────────────────────
from socket_handler import register_events
register_events(sio)

# ─── Route : relay IP camera stream (fixes CORS) ──────────────────────────────
@app.get("/stream")
async def stream(url: str):
    async def generate():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("GET", url) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "OmniGuard server running ✅"}