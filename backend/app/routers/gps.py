"""
GPS REST Endpoints — latest position, historical track, and GPS ping submission.
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.gps_tracking import GPSTracking
from app.models.vehicle import Vehicle
from app.schemas.gps import GPSPingIn, GPSPingOut
from app.crud.gps import get_latest_position, get_position_history

router = APIRouter()


@router.get("/all-vehicles/latest")
def get_all_vehicles_latest(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the latest GPS position for every vehicle that has a GPS ping.
    Used by TrackingMap to show fleet-wide live positions.
    """
    vehicles = db.query(Vehicle).all()
    results = []
    for v in vehicles:
        pos = get_latest_position(db, v.vehicle_id)
        if pos:
            results.append({
                "vehicle_id": str(v.vehicle_id),
                "registration_number": v.registration_number,
                "vehicle_type": v.vehicle_type,
                "status": v.status,
                "latitude": float(pos.latitude),
                "longitude": float(pos.longitude),
                "speed": float(pos.speed) if pos.speed else None,
                "heading": float(pos.heading) if pos.heading else None,
                "recorded_time": pos.recorded_time.isoformat(),
            })
    return results


@router.post("/{vehicle_id}/ping", response_model=GPSPingOut, status_code=201)
def push_gps_ping(
    vehicle_id: UUID,
    ping: GPSPingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a GPS coordinate for a vehicle (used for simulation and driver apps).
    Creates a new GPS tracking record and broadcasts via WebSocket.
    """
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    record = GPSTracking(
        vehicle_id=vehicle_id,
        latitude=ping.latitude,
        longitude=ping.longitude,
        speed=ping.speed,
        heading=ping.heading,
        altitude=ping.altitude,
        accuracy=ping.accuracy,
        recorded_time=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{vehicle_id}/latest", response_model=GPSPingOut)
def get_latest_gps(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the most recent GPS position for a vehicle."""
    rec = get_latest_position(db, vehicle_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No GPS data found for this vehicle.")
    return rec


@router.get("/{vehicle_id}/track", response_model=List[GPSPingOut])
def get_gps_track(
    vehicle_id: UUID,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get historical GPS trail for a vehicle."""
    return get_position_history(db, vehicle_id, limit=limit)
