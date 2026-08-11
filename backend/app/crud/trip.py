from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.driver import Driver
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.trip import TripCreate


def create_trip(db: Session, trip_in: TripCreate) -> Trip:
    trip = Trip(
        shipment_id=trip_in.shipment_id,
        vehicle_id=trip_in.vehicle_id,
        driver_id=trip_in.driver_id,
        start_location=trip_in.start_location,
        destination=trip_in.destination,
        start_lat=trip_in.start_lat,
        start_lng=trip_in.start_lng,
        dest_lat=trip_in.dest_lat,
        dest_lng=trip_in.dest_lng,
        route_type=trip_in.route_type,
        planned_distance_km=trip_in.planned_distance_km,
        planned_duration_min=trip_in.planned_duration_min,
        route_geometry=trip_in.route_geometry,
        status="Scheduled",
    )
    db.add(trip)

    # Link shipment to vehicle and driver if not already set
    shipment = db.query(Shipment).filter(Shipment.shipment_id == trip_in.shipment_id).first()
    if shipment:
        shipment.vehicle_id = trip_in.vehicle_id
        if trip_in.driver_id:
            shipment.driver_id = trip_in.driver_id
        if shipment.status == "Created":
            shipment.status = "Assigned"
        db.add(shipment)

    db.commit()
    db.refresh(trip)
    return trip


def get_trips(
    db: Session,
    current_user: User | None = None,
    status_filter: str | None = None,
    vehicle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Trip]:
    query = db.query(Trip)

    if current_user and current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if driver:
            query = query.filter(or_(Trip.driver_id == driver.driver_id, Trip.driver_id == current_user.user_id))
        else:
            query = query.filter(Trip.driver_id == current_user.user_id)

    if status_filter:
        query = query.filter(Trip.status == status_filter)
    if vehicle_id:
        query = query.filter(Trip.vehicle_id == vehicle_id)

    return query.order_by(Trip.created_at.desc()).offset(skip).limit(limit).all()


def get_trip_by_id(db: Session, trip_id: UUID) -> Trip | None:
    return db.query(Trip).filter(Trip.trip_id == trip_id).first()


def start_trip(db: Session, trip_id: UUID) -> Trip | None:
    """Start trip: marks trip, vehicle, and shipment as 'In Transit'."""
    trip = get_trip_by_id(db, trip_id)
    if not trip:
        return None

    now = datetime.now(timezone.utc)
    trip.status = "In Transit"
    trip.start_time = now

    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "In Transit"
            db.add(vehicle)

    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            shipment.status = "In Transit"
            db.add(shipment)

    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def end_trip(db: Session, trip_id: UUID) -> Trip | None:
    """End trip: records end time/actuals, marks shipment Delivered, frees vehicle to Available."""
    trip = get_trip_by_id(db, trip_id)
    if not trip:
        return None

    now = datetime.now(timezone.utc)
    trip.status = "Completed"
    trip.end_time = now

    if trip.start_time:
        st = trip.start_time
        if st.tzinfo is None:
            st = st.replace(tzinfo=timezone.utc)
        duration_minutes = round((now - st).total_seconds() / 60.0, 1)
        trip.actual_duration_min = duration_minutes
    else:
        trip.actual_duration_min = trip.planned_duration_min

    trip.actual_distance_km = trip.planned_distance_km

    # Free vehicle
    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "Available"
            db.add(vehicle)

    # Deliver shipment
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            shipment.status = "Delivered"
            shipment.actual_delivery_time = now
            db.add(shipment)

    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def cancel_trip(db: Session, trip_id: UUID) -> Trip | None:
    """Cancels trip and resets vehicle status."""
    trip = get_trip_by_id(db, trip_id)
    if not trip:
        return None

    trip.status = "Cancelled"
    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "Available"
            db.add(vehicle)

    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment and shipment.status == "In Transit":
            shipment.status = "Assigned"
            db.add(shipment)

    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip
