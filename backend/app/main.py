from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.realtime import router as realtime_router
from app.routers.shipments import router as shipments_router
from app.routers.trips import router as trips_router
from app.routers.vehicles import router as vehicles_router
from app.utils.ws_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: attempt to initialize Redis pubsub
    await manager.init_redis()
    yield
    # Shutdown


app = FastAPI(
    title="FleetFlow Fleet Management API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Vite dev and any local host
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(vehicles_router, prefix="/vehicles")
app.include_router(shipments_router, prefix="/shipments")
app.include_router(trips_router, prefix="/trips")
app.include_router(realtime_router, prefix="/realtime")


@app.get("/")
async def root() -> dict:
    return {
        "message": "FleetFlow API is running"
    }
