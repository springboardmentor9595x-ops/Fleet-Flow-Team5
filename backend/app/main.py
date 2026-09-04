from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
import app.models  # Import all models to ensure metadata registration
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
from app.database import Base, SessionLocal, engine
from app.utils.repair_drivers import repair_missing_driver_profiles
from app.utils.ws_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database tables exist, repair missing driver profiles, and initialize Redis pubsub
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255);"))
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100);"))
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500);"))
        db.commit()
        repair_missing_driver_profiles(db)
    finally:
        db.close()
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(users_router, prefix="/users")
app.include_router(drivers_router, prefix="/drivers")
app.include_router(vehicles_router, prefix="/vehicles")
app.include_router(shipments_router, prefix="/shipments")
app.include_router(trips_router, prefix="/trips")
app.include_router(realtime_router, prefix="/realtime")
app.include_router(maintenance_router, prefix="/maintenance")
app.include_router(fuel_router, prefix="/fuel-records")
app.include_router(notifications_router, prefix="/notifications")
app.include_router(attendance_router, prefix="/attendance")
app.include_router(leave_requests_router)
app.include_router(analytics_router, prefix="/analytics")
app.include_router(reports_router)


@app.get("/")
async def root() -> dict:
    return {
        "message": "FleetFlow API is running"
    }
