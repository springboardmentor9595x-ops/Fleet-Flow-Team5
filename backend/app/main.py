from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.analytics import router as analytics_router
from app.routers.attendance import router as attendance_router
from app.routers.auth import router as auth_router
from app.routers.drivers import router as drivers_router
from app.routers.fuel import router as fuel_router
from app.routers.leave_requests import router as leave_requests_router
from app.routers.maintenance import router as maintenance_router
from app.routers.notifications import router as notifications_router
from app.routers.realtime import router as realtime_router
from app.routers.reports import router as reports_router
from app.routers.shipments import router as shipments_router
from app.routers.trips import router as trips_router
from app.routers.users import router as users_router
from app.routers.vehicles import router as vehicles_router
from app.utils.ws_manager import manager


from app.config import settings
from app.core.deps import get_db
from sqlalchemy.orm import Session
from sqlalchemy import text

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

cors_origins = [
    "https://frontend-iota-eight-u24vucvutw.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(users_router, prefix="/users")
app.include_router(vehicles_router, prefix="/vehicles")
app.include_router(drivers_router, prefix="/drivers")
app.include_router(shipments_router, prefix="/shipments")
app.include_router(trips_router, prefix="/trips")
app.include_router(realtime_router, prefix="/realtime")
app.include_router(maintenance_router, prefix="/maintenance")
app.include_router(fuel_router, prefix="/fuel")
app.include_router(fuel_router, prefix="/fuel-records")
app.include_router(attendance_router, prefix="/attendance")
app.include_router(leave_requests_router)
app.include_router(reports_router)
app.include_router(analytics_router, prefix="/analytics")
app.include_router(notifications_router, prefix="/notifications")


@app.get("/")
async def root() -> dict:
    return {
        "message": "FleetFlow API is running"
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}

