from typing import Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, shipments, trips, vehicles, drivers, gps, maintenance, notifications, reports, dashboard, attendance
from app.websockets.tracking import handle_tracking_websocket
from app.database import engine, Base, SessionLocal
import app.models
from app.models.user import User, RoleEnum
from app.core.security import hash_password
from fastapi import Request
from fastapi.responses import JSONResponse

app = FastAPI(
    title="FleetFlow API",
    description="Fleet Management & Logistics Tracking Platform — Milestone 2",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for dev server & WebSocket clients
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin if origin != "*" else "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

@app.on_event("startup")
def startup_db_init():
    """Auto-create tables and ensure default accounts exist on first boot."""
    try:
        print("[Startup] Ensuring all database tables exist...")
        Base.metadata.create_all(bind=engine)
        print("[Startup] Database tables verified.")
        
        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.email == "admin@fleetflow.com").first()
            if not admin:
                print("[Startup] Seeding initial clean accounts...")
                admin_user = User(
                    email="admin@fleetflow.com",
                    password=hash_password("admin123"),
                    full_name="System Administrator",
                    role=RoleEnum.Admin,
                    phone="+1-800-555-0101",
                    is_verified=True,
                )
                manager_user = User(
                    email="manager@fleetflow.com",
                    password=hash_password("admin123"),
                    full_name="Fleet Manager",
                    role=RoleEnum.FleetManager,
                    phone="+1-800-555-0102",
                    is_verified=True,
                )
                dispatcher_user = User(
                    email="dispatcher@fleetflow.com",
                    password=hash_password("admin123"),
                    full_name="Logistics Dispatcher",
                    role=RoleEnum.Dispatcher,
                    phone="+1-800-555-0103",
                    is_verified=True,
                )
                driver_user = User(
                    email="driver@fleetflow.com",
                    password=hash_password("admin123"),
                    full_name="John Driver",
                    role=RoleEnum.Driver,
                    phone="+1-800-555-0104",
                    is_verified=True,
                )
                db.add_all([admin_user, manager_user, dispatcher_user, driver_user])
                db.commit()
                print("[Startup] Initial role accounts seeded successfully.")
            
            # Ensure demo fleet (vehicles, drivers, shipments, trips, GPS) is populated
            from app.core.seed import seed_demo_fleet_data
            seed_demo_fleet_data(db)
        finally:
            db.close()
    except Exception as e:
        print(f"[Startup Warning] Database initialization: {e}")

# Register REST Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard Metrics"])
app.include_router(shipments.router, prefix="/shipments", tags=["Shipments"])
app.include_router(trips.router, prefix="/trips", tags=["Trips & Route Optimization"])
app.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
app.include_router(drivers.router, prefix="/drivers", tags=["Drivers"])
app.include_router(attendance.router, prefix="/attendance", tags=["Attendance & Leaves"])
app.include_router(gps.router, prefix="/gps", tags=["GPS Tracking"])
app.include_router(maintenance.router, prefix="/maintenance", tags=["Fleet Maintenance & Fuel"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
app.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics"])

# Register WebSockets for Live GPS Location Streaming
@app.websocket("/ws/tracking/{vehicle_id}")
async def websocket_tracking_vehicle(vehicle_id: str, websocket: WebSocket):
    await handle_tracking_websocket(vehicle_id, websocket)


@app.websocket("/ws/tracking")
async def websocket_tracking_global(websocket: WebSocket):
    await handle_tracking_websocket("global", websocket)


@app.get("/", summary="Root", description="Basic liveness check used to confirm the server booted correctly.")
def root() -> Dict[str, str]:
    return {"message": "FleetFlow API running - Milestone 2"}


@app.get("/health/db", summary="Database Health Check")
def health_db():
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            db_name = conn.execute(text("SELECT current_database();")).scalar()
            tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")).fetchall()
            table_names = [r[0] for r in tables]
        db = SessionLocal()
        user_count = db.query(User).count()
        db.close()
        return {
            "status": "connected",
            "database": db_name,
            "tables_count": len(table_names),
            "tables": table_names,
            "users_count": user_count
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/admin/seed-demo-fleet", summary="Seed Demo Fleet Data")
@app.post("/admin/seed-demo-fleet", summary="Seed Demo Fleet Data")
def seed_demo_fleet():
    db = SessionLocal()
    try:
        from app.core.seed import seed_demo_fleet_data
        result = seed_demo_fleet_data(db)
        return {"message": "Demo fleet data successfully processed", "result": result}
    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        db.close()
