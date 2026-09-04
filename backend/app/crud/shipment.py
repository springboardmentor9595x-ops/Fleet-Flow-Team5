import random
import string
from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.crud.notification import notify_shipment_delivered, notify_shipment_status_change
from app.models.driver import Driver
from app.models.gps_tracking import GPSTracking
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.shipment import (
    DriverSummary,
    GPSTrackingSummary,
    ShipmentCreate,
    ShipmentRead,
    ShipmentTrackingDetail,
    ShipmentUpdate,
    TripSummary,
    VehicleSummary,
)
from app.services.routing_service import compute_live_eta


def generate_tracking_number() -> str:
    """Generate a unique tracking number like TRK-8F2A-99B1."""
    part1 = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    part2 = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"TRK-{part1}-{part2}"


def validate_driver_for_assignment(db: Session, driver_id: UUID | None) -> Driver:
    """Validate that driver_id exists, has role Driver, is active, and is eligible for assignment."""
    if not driver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a driver.",
        )

    driver = db.query(Driver).filter((Driver.driver_id == driver_id) | (Driver.user_id == driver_id)).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected driver is invalid or ineligible for assignment.",
        )

    user = db.query(User).filter(User.user_id == driver.user_id).first()
    if not user or user.role != "Driver" or (driver.status and driver.status.lower() not in ["active", "available"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected driver is invalid or ineligible for assignment.",
        )

    return driver


def build_shipment_read(db: Session, shipment: Shipment) -> ShipmentRead:
    """Build ShipmentRead schema with resolved driver_name."""
    driver_name = None
    if shipment.driver_id:
        driver = db.query(Driver).filter((Driver.driver_id == shipment.driver_id) | (Driver.user_id == shipment.driver_id)).first()
        user = db.query(User).filter(User.user_id == (driver.user_id if driver else shipment.driver_id)).first()
        if user:
            driver_name = user.full_name

    return ShipmentRead(
        shipment_id=shipment.shipment_id,
        tracking_number=shipment.tracking_number,
        source=shipment.source,
        destination=shipment.destination,
        source_lat=shipment.source_lat,
        source_lng=shipment.source_lng,
        dest_lat=shipment.dest_lat,
        dest_lng=shipment.dest_lng,
        customer_name=shipment.customer_name,
        customer_phone=shipment.customer_phone,
        customer_email=shipment.customer_email,
        shipment_weight=shipment.shipment_weight,
        vehicle_id=shipment.vehicle_id,
        driver_id=shipment.driver_id,
        driver_name=driver_name,
        status=shipment.status,
        expected_delivery_time=shipment.expected_delivery_time,
        actual_delivery_time=shipment.actual_delivery_time,
        notes=shipment.notes,
        created_at=shipment.created_at,
        updated_at=shipment.updated_at,
    )


def create_shipment(db: Session, shipment_in: ShipmentCreate) -> Shipment:
    target_driver = validate_driver_for_assignment(db, shipment_in.driver_id)

    # Auto-link driver's assigned vehicle if vehicle_id not explicitly set
    vehicle_id = shipment_in.vehicle_id
    if not vehicle_id:
        assigned_veh = db.query(Vehicle).filter(Vehicle.assigned_driver == target_driver.driver_id).first()
        if assigned_veh:
            vehicle_id = assigned_veh.vehicle_id

    tracking_number = shipment_in.tracking_number or generate_tracking_number()
    # Ensure uniqueness
    while db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first():
        tracking_number = generate_tracking_number()

    shipment = Shipment(
        tracking_number=tracking_number,
        source=shipment_in.source,
        destination=shipment_in.destination,
        source_lat=shipment_in.source_lat,
        source_lng=shipment_in.source_lng,
        dest_lat=shipment_in.dest_lat,
        dest_lng=shipment_in.dest_lng,
        customer_name=shipment_in.customer_name,
        customer_phone=shipment_in.customer_phone,
        customer_email=shipment_in.customer_email,
        shipment_weight=shipment_in.shipment_weight,
        vehicle_id=vehicle_id,
        driver_id=target_driver.driver_id,
        status="Assigned",
        expected_delivery_time=shipment_in.expected_delivery_time,
        notes=shipment_in.notes,
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    # In-App Notification to assigned driver
    from app.crud.notification import notify_shipment_assigned
    if shipment.driver_id:
        notify_shipment_assigned(db, shipment, shipment.driver_id)

    return shipment


def get_shipments(
    db: Session,
    current_user: User | None = None,
    status_filter: str | None = None,
    customer_filter: str | None = None,
    vehicle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Shipment]:
    query = db.query(Shipment)

    # Role Scoping: Drivers only see their own assigned shipments
    if current_user and current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if driver:
            query = query.filter(or_(Shipment.driver_id == driver.driver_id, Shipment.driver_id == current_user.user_id))
        else:
            query = query.filter(Shipment.driver_id == current_user.user_id)

    if status_filter:
        query = query.filter(Shipment.status == status_filter)
    if customer_filter:
        query = query.filter(Shipment.customer_name.ilike(f"%{customer_filter}%"))
    if vehicle_id:
        query = query.filter(Shipment.vehicle_id == vehicle_id)

    return query.order_by(Shipment.created_at.desc()).offset(skip).limit(limit).all()


def get_shipment_by_id(db: Session, shipment_id: UUID) -> Shipment | None:
    return db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()


def get_shipment_by_tracking(db: Session, tracking_number: str) -> Shipment | None:
    return db.query(Shipment).filter(Shipment.tracking_number == tracking_number.strip().upper()).first()


def update_shipment(db: Session, shipment_id: UUID, shipment_in: ShipmentUpdate) -> Shipment | None:
    shipment = get_shipment_by_id(db, shipment_id)
    if not shipment:
        return None

    old_status = shipment.status
    update_data = shipment_in.model_dump(exclude_unset=True)

    if "driver_id" in update_data and update_data["driver_id"] is not None:
        target_driver = validate_driver_for_assignment(db, update_data["driver_id"])
        update_data["driver_id"] = target_driver.driver_id
        # Auto-link driver's assigned vehicle if shipment has no vehicle
        if not update_data.get("vehicle_id") and not shipment.vehicle_id:
            assigned_veh = db.query(Vehicle).filter(Vehicle.assigned_driver == target_driver.driver_id).first()
            if assigned_veh:
                update_data["vehicle_id"] = assigned_veh.vehicle_id

    for field, value in update_data.items():
        setattr(shipment, field, value)

    # Auto-adjust status if assigning first time
    if (shipment.vehicle_id or shipment.driver_id) and shipment.status == "Created":
        shipment.status = "Assigned"

    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    if old_status != shipment.status:
        if shipment.status == "Delivered":
            notify_shipment_delivered(db, shipment)
        elif shipment.status in ["Delayed", "Cancelled"]:
            notify_shipment_status_change(db, shipment, shipment.status)

    return shipment


def update_shipment_status(
    db: Session, shipment_id: UUID, new_status: str, notes: str | None = None
) -> Shipment | None:
    shipment = get_shipment_by_id(db, shipment_id)
    if not shipment:
        return None

    old_status = shipment.status
    shipment.status = new_status
    if notes:
        shipment.notes = f"{shipment.notes or ''}\n[{new_status}]: {notes}".strip()

    if new_status == "Delivered" and not shipment.actual_delivery_time:
        shipment.actual_delivery_time = datetime.now(timezone.utc)

    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    if old_status != new_status:
        if new_status == "Delivered":
            notify_shipment_delivered(db, shipment)
        elif new_status in ["Delayed", "Cancelled"]:
            notify_shipment_status_change(db, shipment, new_status)

    return shipment


def cancel_shipment(db: Session, shipment_id: UUID) -> Shipment | None:
    """Cancels a shipment without deleting the row."""
    return update_shipment_status(db, shipment_id, "Cancelled", "Shipment cancelled by operator.")


def get_delayed_shipments(db: Session) -> list[dict]:
    """Flag shipments approaching or past their expected delivery window."""
    now = datetime.now(timezone.utc)
    active_shipments = (
        db.query(Shipment)
        .filter(Shipment.status.in_(["Created", "Assigned", "In Transit", "Delayed"]))
        .all()
    )

    alerts = []
    for s in active_shipments:
        if s.expected_delivery_time:
            exp_time = s.expected_delivery_time
            if exp_time.tzinfo is None:
                exp_time = exp_time.replace(tzinfo=timezone.utc)
            
            diff_hours = (now - exp_time).total_seconds() / 3600.0
            if diff_hours > 0:
                if s.status != "Delayed":
                    s.status = "Delayed"
                    db.add(s)
                alerts.append({
                    "shipment_id": s.shipment_id,
                    "tracking_number": s.tracking_number,
                    "customer_name": s.customer_name,
                    "status": "Delayed",
                    "expected_delivery_time": s.expected_delivery_time,
                    "is_delayed": True,
                    "delay_hours": round(diff_hours, 1),
                    "message": f"Shipment {s.tracking_number} is overdue by {round(diff_hours, 1)} hours.",
                })
            elif diff_hours > -2.0:
                alerts.append({
                    "shipment_id": s.shipment_id,
                    "tracking_number": s.tracking_number,
                    "customer_name": s.customer_name,
                    "status": s.status,
                    "expected_delivery_time": s.expected_delivery_time,
                    "is_delayed": False,
                    "delay_hours": round(diff_hours, 1),
                    "message": f"Shipment {s.tracking_number} expected delivery window in {round(abs(diff_hours), 1)} hours.",
                })

    db.commit()
    return alerts


def get_shipment_tracking_detail(db: Session, shipment_id: UUID) -> ShipmentTrackingDetail | None:
    shipment = get_shipment_by_id(db, shipment_id)
    if not shipment:
        return None

    shipment_read = build_shipment_read(db, shipment)

    # 1. Resolve Driver
    driver_summary = None
    if shipment.driver_id:
        driver = db.query(Driver).filter((Driver.driver_id == shipment.driver_id) | (Driver.user_id == shipment.driver_id)).first()
        user = db.query(User).filter(User.user_id == (driver.user_id if driver else shipment.driver_id)).first()
        if driver or user:
            driver_summary = DriverSummary(
                driver_id=driver.driver_id if driver else shipment.driver_id,
                full_name=user.full_name if user else None,
                email=user.email if user else None,
                phone=user.phone if user else None,
                license_number=driver.license_number if driver else None,
                status=driver.status if driver else "Active",
            )

    # 2. Resolve Vehicle
    vehicle_summary = None
    target_vehicle_id = shipment.vehicle_id
    if not target_vehicle_id and driver_summary:
        driver_obj = db.query(Driver).filter(Driver.driver_id == driver_summary.driver_id).first()
        if driver_obj:
            assigned_veh = db.query(Vehicle).filter(Vehicle.assigned_driver == driver_obj.driver_id).first()
            if assigned_veh:
                target_vehicle_id = assigned_veh.vehicle_id

    if target_vehicle_id:
        veh = db.query(Vehicle).filter(Vehicle.vehicle_id == target_vehicle_id).first()
        if veh:
            vehicle_summary = VehicleSummary(
                vehicle_id=veh.vehicle_id,
                registration_number=veh.registration_number,
                brand=veh.brand,
                model=veh.model,
                vehicle_type=veh.vehicle_type,
                status=veh.status,
            )

    # 3. Resolve Trip
    trip_summary = None
    trip = db.query(Trip).filter(Trip.shipment_id == shipment.shipment_id).order_by(Trip.created_at.desc()).first()
    if not trip and shipment.vehicle_id:
        trip = db.query(Trip).filter(Trip.vehicle_id == shipment.vehicle_id).order_by(Trip.created_at.desc()).first()
    if trip:
        trip_summary = TripSummary(
            trip_id=trip.trip_id,
            shipment_id=trip.shipment_id,
            vehicle_id=trip.vehicle_id,
            driver_id=trip.driver_id,
            start_location=trip.start_location,
            destination=trip.destination,
            route_type=trip.route_type,
            planned_distance_km=trip.planned_distance_km,
            planned_duration_min=trip.planned_duration_min,
            route_geometry=trip.route_geometry,
            status=trip.status,
        )

    # 4. Resolve Live GPS Tracking
    tracking_summary = None
    remaining_distance_km = None
    remaining_duration_min = None
    remaining_eta_text = None

    target_vehicle_id = shipment.vehicle_id or (trip.vehicle_id if trip else None)
    if target_vehicle_id:
        gps = db.query(GPSTracking).filter(GPSTracking.vehicle_id == target_vehicle_id).order_by(GPSTracking.recorded_time.desc()).first()
        if gps:
            tracking_summary = GPSTrackingSummary(
                latitude=gps.latitude,
                longitude=gps.longitude,
                speed=gps.speed or 0.0,
                heading=gps.heading or 0.0,
                recorded_time=gps.recorded_time,
            )

            # Destination coordinates
            dest_lat = shipment.dest_lat or (trip.dest_lat if trip else None)
            dest_lng = shipment.dest_lng or (trip.dest_lng if trip else None)
            if dest_lat and dest_lng:
                eta_data = compute_live_eta(
                    gps.latitude, gps.longitude, dest_lat, dest_lng, gps.speed or 0.0
                )
                remaining_distance_km = eta_data.get("remaining_distance_km")
                remaining_duration_min = eta_data.get("remaining_duration_min")
                if remaining_duration_min is not None:
                    mins = int(round(remaining_duration_min))
                    if mins <= 0:
                        remaining_eta_text = "Arriving now"
                    elif mins < 60:
                        remaining_eta_text = f"{mins}m"
                    else:
                        hours = mins // 60
                        rem = mins % 60
                        remaining_eta_text = f"{hours}h {rem:02d}m" if rem > 0 else f"{hours}h"

    # 5. Determine Authoritative Tracking State and Message
    status_lower = shipment.status.lower()
    if status_lower == "delivered":
        tracking_state = "completed"
        message = "Live tracking is unavailable for this shipment status (Delivered)."
    elif status_lower == "cancelled":
        tracking_state = "cancelled"
        message = "Live tracking is unavailable for this shipment status (Cancelled)."
    elif not driver_summary or not vehicle_summary:
        tracking_state = "unassigned"
        message = "Tracking unavailable — assign a driver and vehicle to this shipment."
    elif vehicle_summary and not tracking_summary:
        tracking_state = "waiting_for_gps"
        message = f"Waiting for GPS signal for vehicle {vehicle_summary.registration_number}."
    else:
        tracking_state = "live_tracking_active"
        message = "Live Tracking Active"

    return ShipmentTrackingDetail(
        shipment=shipment_read,
        driver=driver_summary,
        vehicle=vehicle_summary,
        trip=trip_summary,
        tracking=tracking_summary,
        remaining_distance_km=remaining_distance_km,
        remaining_duration_min=remaining_duration_min,
        remaining_eta_text=remaining_eta_text,
        tracking_state=tracking_state,
        message=message,
    )

