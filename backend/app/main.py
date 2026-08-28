from typing import Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, shipments, trips, vehicles, drivers, gps, maintenance, notifications, reports, dashboard
from app.websockets.tracking import handle_tracking_websocket

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

# Register REST Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard Metrics"])
app.include_router(shipments.router, prefix="/shipments", tags=["Shipments"])
app.include_router(trips.router, prefix="/trips", tags=["Trips & Route Optimization"])
app.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
app.include_router(drivers.router, prefix="/drivers", tags=["Drivers"])
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
