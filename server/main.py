from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from routers.alerts import router as alerts_router
    from routers.auth import router as auth_router
    from routers.cameras import router as cameras_router
except ImportError:
    from server.routers.alerts import router as alerts_router
    from server.routers.auth import router as auth_router
    from server.routers.cameras import router as cameras_router

app = FastAPI(title="OmniGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(alerts_router)
app.include_router(cameras_router)


@app.get("/")
async def root():
    return {"message": "OmniGuard backend is running"}
