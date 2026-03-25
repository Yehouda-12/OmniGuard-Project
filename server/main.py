import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import httpx
import os

load_dotenv()

# ─── Setup FastAPI + Socket.io ────────────────────────────────────────────────
# On autorise tous les origins pour Socket.io pour faciliter le développement
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI()
socket_app = socketio.ASGIApp(sio, app)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # L'adresse de ton React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Import routers ──────────────────────────────────────────────────────────
from routers import auth, alerts, cameras, stats
app.include_router(auth.router,   prefix="/api/auth",    tags=["auth"])
app.include_router(alerts.router, prefix="/api/alerts",  tags=["alerts"])
app.include_router(cameras.router, prefix="/api/cameras", tags=["cameras"])
app.include_router(stats.router,   prefix="/api/stats",   tags=["stats"])

# ─── Import socket handler (Logique IA & Alertes) ─────────────────────────────
from socket_handler import register_events
register_events(sio)

# ─── NOUVEAU : Relais Flux Vidéo Python -> Dashboard ──────────────────────────
@sio.on("video_frame")
async def handle_video_frame(sid, data):
    """
    Reçoit la frame rapide du script Python Desktop 
    et la renvoie au Dashboard React en temps réel.
    """
    user_id = data.get("userId")
    if user_id:
        # On renvoie l'image uniquement à l'utilisateur concerné
        # (Assure-toi que ton React fait socket.emit('join', userId) au départ)
        await sio.emit("stream_to_dashboard", {"image": data.get("image")}, room=user_id)

# ─── Route : relay IP camera stream (Ancienne méthode, garde-la au cas où) ────
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

# Pour lancer avec : uvicorn main:socket_app --reload