from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.gps_tracking import GPSTracking
from app.models.vehicle import Vehicle
from app.schemas.gps import GPSPing


def record_gps_ping(db: Session, ping: GPSPing) -> GPSTracking:
    """Saves a GPS ping to the database."""
    tracking = GPSTracking(
        vehicle_id=ping.vehicle_id,
        latitude=ping.latitude,
        longitude=ping.longitude,
        speed=ping.speed or 0.0,
        heading=ping.heading or 0.0,
        recorded_time=datetime.now(timezone.utc),
    )
    db.add(tracking)
    db.commit()
    db.refresh(tracking)
    return tracking


def get_latest_locations_for_all_vehicles(db: Session) -> list[dict]:
    """Get the most recent GPS coordinate for all active vehicles."""
    vehicles = db.query(Vehicle).all()
    results = []

    for v in vehicles:
        latest = (
            db.query(GPSTracking)
            .filter(GPSTracking.vehicle_id == v.vehicle_id)
            .order_by(GPSTracking.recorded_time.desc())
            .first()
        )
        if latest:
            results.append({
                "vehicle_id": str(v.vehicle_id),
                "registration_number": v.registration_number,
                "status": v.status,
                "latitude": latest.latitude,
                "longitude": latest.longitude,
                "speed": latest.speed,
                "heading": latest.heading,
                "recorded_time": latest.recorded_time.isoformat() if latest.recorded_time else None,
            })
    return results


def get_vehicle_location_history(db: Session, vehicle_id: UUID, limit: int = 50) -> list[GPSTracking]:
    """Get recent GPS trace coordinates for a vehicle."""
    return (
        db.query(GPSTracking)
        .filter(GPSTracking.vehicle_id == vehicle_id)
        .order_by(GPSTracking.recorded_time.desc())
        .limit(limit)
        .all()
    )
