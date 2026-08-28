"""
Trip CRUD Operations: Scheduling, Starting, Ending, and Mid-Trip Rerouting.
"""
import json
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.orm import Session
from fastapi import HTTPException


from app.models.trip import Trip
from app.models.shipment import Shipment, ShipmentStatusEnum
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.schemas.trip import TripCreate
from app.crud.shipment import update_shipment_status
from app.core.route_optimization import (
    geocode_address,
    calculate_route_options,
    fetch_osrm_route,
)


def create_trip(db: Session, data: TripCreate, current_user) -> Trip:
    """
    Schedule a trip for a shipment:
    - Assigns vehicle and driver.
    - Resolves coordinates and generates planned route polyline & route options.
    - Stores selected route type (fastest / shortest / traffic_avoidance / fuel_efficient).
    - Updates shipment status to Assigned.
    """
    if data.driver_id:
        drv = db.query(Driver).filter(Driver.driver_id == data.driver_id).first()
        if drv and drv.status == "Inactive":
            d_name = "Driver"
            if drv.user_id:
                u = db.query(User).filter(User.user_id == drv.user_id).first()
                if u: d_name = u.full_name
            raise HTTPException(
                status_code=400,
                detail=f"Cannot schedule trip for '{d_name}'. The driver is currently Inactive / Off-Duty."
            )
    shipment = db.query(Shipment).filter(Shipment.shipment_id == data.shipment_id).first() if data.shipment_id else None

    start_loc = data.start_location or (shipment.source if shipment else "Dispatch Hub")
    dest_loc = data.destination or (shipment.destination if shipment else "Destination Hub")

    # Geocode origin and destination
    s_lat = float(shipment.source_lat) if shipment and shipment.source_lat else None
    s_lon = float(shipment.source_lon) if shipment and shipment.source_lon else None
    if s_lat is None or s_lon is None:
        s_lat, s_lon = geocode_address(start_loc)

    d_lat = float(shipment.destination_lat) if shipment and shipment.destination_lat else None
    d_lon = float(shipment.destination_lon) if shipment and shipment.destination_lon else None
    if d_lat is None or d_lon is None:
        d_lat, d_lon = geocode_address(dest_loc)

    # Compute route options
    route_options = calculate_route_options(s_lat, s_lon, d_lat, d_lon)
    selected_mode = data.planned_route_type or "fastest"
    route_info = route_options.get(selected_mode, route_options["fastest"])

    trip = Trip(
        vehicle_id=data.vehicle_id,
        driver_id=data.driver_id,
        shipment_id=data.shipment_id,
        start_location=start_loc,
        destination=dest_loc,
        planned_route_type=selected_mode,
        distance=route_info["distance_km"],
        estimated_duration=route_info["duration_mins"],
        route_geometry=json.dumps(route_info["coordinates"]),
        status="Scheduled",
        created_at=datetime.utcnow(),
    )
    db.add(trip)

    # Assign vehicle and driver on shipment if linked
    if shipment:
        shipment.vehicle_id = data.vehicle_id
        shipment.driver_id = data.driver_id
        if shipment.status == ShipmentStatusEnum.Created:
            update_shipment_status(
                db, shipment, ShipmentStatusEnum.Assigned, "Trip scheduled & vehicle/driver assigned", current_user
            )

    db.commit()
    db.refresh(trip)
    return trip


def get_trip(db: Session, trip_id: UUID) -> Optional[Trip]:
    return db.query(Trip).filter(Trip.trip_id == trip_id).first()


def list_trips(db: Session, skip: int = 0, limit: int = 100) -> List[Trip]:
    return db.query(Trip).order_by(Trip.created_at.desc()).offset(skip).limit(limit).all()


def start_trip(db: Session, trip: Trip, current_user) -> Trip:
    """
    Start a trip:
    - Changes trip status to 'In Progress'.
    - Updates linked shipment status to 'In Transit'.
    - Updates vehicle status to 'In Use' and driver status to 'On Duty'.
    - Records start_time.
    """
    if trip.status in ("In Progress", "Completed"):
        raise HTTPException(status_code=400, detail=f"Trip is already {trip.status}.")
        
    trip.status = "In Progress"
    trip.start_time = datetime.utcnow()

    # Update linked vehicle status
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
    if vehicle:
        vehicle.status = "In Use"

    # Update linked driver status
    driver = db.query(Driver).filter(Driver.driver_id == trip.driver_id).first()
    if driver:
        driver.status = "On Duty"

    # Update linked shipment
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            update_shipment_status(
                db, shipment, ShipmentStatusEnum.InTransit, "Trip started — shipment in transit", current_user
            )

    db.commit()
    db.refresh(trip)
    return trip


def end_trip(db: Session, trip: Trip, actual_distance: Optional[float], current_user) -> Trip:
    """
    End a trip:
    - Records end_time and actual distance.
    - Sets trip status to 'Completed'.
    - Updates linked shipment status to 'Delivered'.
    - Frees vehicle status back to 'Available' and driver to 'Active'.
    """
    trip.status = "Completed"
    trip.end_time = datetime.utcnow()
    if actual_distance is not None:
        trip.distance = actual_distance

    # Free vehicle
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
    if vehicle:
        vehicle.status = "Available"

    # Free driver
    driver = db.query(Driver).filter(Driver.driver_id == trip.driver_id).first()
    if driver:
        driver.status = "Active"

    # Complete shipment
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            update_shipment_status(
                db, shipment, ShipmentStatusEnum.Delivered, "Trip completed — shipment delivered", current_user
            )

    db.commit()
    db.refresh(trip)
    return trip


def recalculate_trip_route(
    db: Session, trip: Trip, current_lat: float, current_lon: float
) -> Trip:
    """Recalculate trip route mid-transit starting from current GPS location."""
    d_lat, d_lon = geocode_address(trip.destination)
    new_route = fetch_osrm_route(current_lat, current_lon, d_lat, d_lon)

    trip.distance = new_route["distance_km"]
    trip.estimated_duration = new_route["duration_mins"]
    trip.route_geometry = json.dumps(new_route["coordinates"])

    db.commit()
    db.refresh(trip)
    return trip
