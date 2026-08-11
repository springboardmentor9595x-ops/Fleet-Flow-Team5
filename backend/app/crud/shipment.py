import random
import string
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.shipment import Shipment
from app.models.user import User
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate


def generate_tracking_number() -> str:
    """Generate a unique tracking number like TRK-8F2A-99B1."""
    part1 = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    part2 = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"TRK-{part1}-{part2}"


def create_shipment(db: Session, shipment_in: ShipmentCreate) -> Shipment:
    tracking_number = shipment_in.tracking_number or generate_tracking_number()
    # Ensure uniqueness
    while db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first():
        tracking_number = generate_tracking_number()

    status = "Assigned" if (shipment_in.vehicle_id or shipment_in.driver_id) else "Created"

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
        vehicle_id=shipment_in.vehicle_id,
        driver_id=shipment_in.driver_id,
        status=status,
        expected_delivery_time=shipment_in.expected_delivery_time,
        notes=shipment_in.notes,
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
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
        # Find driver record
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

    update_data = shipment_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shipment, field, value)

    # Auto-adjust status if assigning first time
    if (shipment.vehicle_id or shipment.driver_id) and shipment.status == "Created":
        shipment.status = "Assigned"

    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


def update_shipment_status(
    db: Session, shipment_id: UUID, new_status: str, notes: str | None = None
) -> Shipment | None:
    shipment = get_shipment_by_id(db, shipment_id)
    if not shipment:
        return None

    shipment.status = new_status
    if notes:
        shipment.notes = f"{shipment.notes or ''}\n[{new_status}]: {notes}".strip()

    if new_status == "Delivered" and not shipment.actual_delivery_time:
        shipment.actual_delivery_time = datetime.now(timezone.utc)

    db.add(shipment)
    db.commit()
    db.refresh(shipment)
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
            # Ensure timezone awareness
            if exp_time.tzinfo is None:
                exp_time = exp_time.replace(tzinfo=timezone.utc)
            
            diff_hours = (now - exp_time).total_seconds() / 3600.0
            if diff_hours > 0:
                # Past delivery window
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
                # Approaching within 2 hours
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
