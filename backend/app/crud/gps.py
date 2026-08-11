"""
GPS Tracking CRUD operations.
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.gps_tracking import GPSTracking
from app.schemas.gps import GPSPingIn


def create_gps_ping(db: Session, vehicle_id: UUID, ping_data: GPSPingIn) -> GPSTracking:
    """Record a location ping in the DB."""
    record = GPSTracking(
        vehicle_id=vehicle_id,
        latitude=ping_data.latitude,
        longitude=ping_data.longitude,
        speed=ping_data.speed,
        heading=ping_data.heading,
        altitude=ping_data.altitude,
        accuracy=ping_data.accuracy,
        recorded_time=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_latest_position(db: Session, vehicle_id: UUID) -> Optional[GPSTracking]:
    """Retrieve the most recent GPS record for a vehicle."""
    return (
        db.query(GPSTracking)
        .filter(GPSTracking.vehicle_id == vehicle_id)
        .order_by(GPSTracking.recorded_time.desc())
        .first()
    )


def get_position_history(db: Session, vehicle_id: UUID, limit: int = 100) -> List[GPSTracking]:
    """Retrieve position trail history for a vehicle."""
    return (
        db.query(GPSTracking)
        .filter(GPSTracking.vehicle_id == vehicle_id)
        .order_by(GPSTracking.recorded_time.asc())
        .limit(limit)
        .all()
    )
