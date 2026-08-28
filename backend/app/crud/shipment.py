"""
Shipment CRUD Operations with Role Scoping and History Tracking.
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import or_

from fastapi import HTTPException

from app.models.shipment import Shipment, ShipmentHistory, ShipmentStatusEnum
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate
from app.core.route_optimization import geocode_address


def create_shipment(db: Session, data: ShipmentCreate, created_by: User) -> Shipment:
    """Create a new shipment with status set to Created."""
    shipment_dict = data.model_dump(exclude_unset=True)

    # Validate driver status if driver assigned
    if shipment_dict.get("driver_id"):
        drv = db.query(Driver).filter(Driver.driver_id == shipment_dict["driver_id"]).first()
        if drv and drv.status == "Inactive":
            d_name = "Driver"
            if drv.user_id:
                u = db.query(User).filter(User.user_id == drv.user_id).first()
                if u: d_name = u.full_name
            raise HTTPException(
                status_code=400,
                detail=f"Cannot assign job to '{d_name}'. The driver is currently Inactive / Off-Duty."
            )

    # Auto-resolve coordinates if not provided
    if not shipment_dict.get("source_lat") or not shipment_dict.get("source_lon"):
        s_lat, s_lon = geocode_address(data.source)
        shipment_dict["source_lat"] = s_lat
        shipment_dict["source_lon"] = s_lon

    if not shipment_dict.get("destination_lat") or not shipment_dict.get("destination_lon"):
        d_lat, d_lon = geocode_address(data.destination)
        shipment_dict["destination_lat"] = d_lat
        shipment_dict["destination_lon"] = d_lon

    # Set default expected delivery if unsupplied (24h from now)
    if not shipment_dict.get("expected_delivery"):
        shipment_dict["expected_delivery"] = datetime.utcnow() + timedelta(days=1)

    shipment = Shipment(
        **shipment_dict,
        status=ShipmentStatusEnum.Created,
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    # Log creation in ShipmentHistory
    history = ShipmentHistory(
        shipment_id=shipment.shipment_id,
        status=ShipmentStatusEnum.Created.value,
        note="Shipment created",
        changed_by_user_id=created_by.user_id,
        changed_by_name=created_by.full_name,
    )
    db.add(history)
    db.commit()

    return shipment


def get_shipment(db: Session, shipment_id: UUID) -> Optional[Shipment]:
    return db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()


def get_shipment_by_tracking(db: Session, tracking_number: str) -> Optional[Shipment]:
    return (
        db.query(Shipment)
        .filter(Shipment.tracking_number == tracking_number)
        .first()
    )


def get_all_shipments(
    db: Session, user: User, skip: int = 0, limit: int = 100
) -> List[Shipment]:
    """
    Role-scoped query:
    - Admin, FleetManager, Dispatcher see all shipments.
    - Driver sees only shipments assigned to their driver profile.
    """
    if user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
        if not driver:
            return []
        return (
            db.query(Shipment)
            .filter(Shipment.driver_id == driver.driver_id)
            .order_by(Shipment.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    return (
        db.query(Shipment)
        .order_by(Shipment.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_shipments_by_customer(db: Session, customer_name: str) -> List[Shipment]:
    """Fetch shipments for a given customer name (case-insensitive search)."""
    return (
        db.query(Shipment)
        .filter(Shipment.customer_name.ilike(f"%{customer_name}%"))
        .order_by(Shipment.created_at.desc())
        .all()
    )


def get_shipments_by_vehicle(db: Session, vehicle_id: UUID) -> List[Shipment]:
    """Fetch shipment history for a vehicle."""
    return (
        db.query(Shipment)
        .filter(Shipment.vehicle_id == vehicle_id)
        .order_by(Shipment.created_at.desc())
        .all()
    )


def update_shipment(
    db: Session, shipment: Shipment, data: ShipmentUpdate, current_user: User
) -> Shipment:
    """Edit shipment details or reassign vehicle/driver."""
    update_data = data.model_dump(exclude_unset=True)

    # Validate driver status if updating assigned driver
    if update_data.get("driver_id"):
        drv = db.query(Driver).filter(Driver.driver_id == update_data["driver_id"]).first()
        if drv and drv.status == "Inactive":
            d_name = "Driver"
            if drv.user_id:
                u = db.query(User).filter(User.user_id == drv.user_id).first()
                if u: d_name = u.full_name
            raise HTTPException(
                status_code=400,
                detail=f"Cannot assign job to '{d_name}'. The driver is currently Inactive / Off-Duty."
            )

    # Re-geocode if source/destination updated
    if "source" in update_data and (not data.source_lat or not data.source_lon):
        s_lat, s_lon = geocode_address(data.source)
        update_data["source_lat"] = s_lat
        update_data["source_lon"] = s_lon

    if "destination" in update_data and (not data.destination_lat or not data.destination_lon):
        d_lat, d_lon = geocode_address(data.destination)
        update_data["destination_lat"] = d_lat
        update_data["destination_lon"] = d_lon

    # Auto transition to Assigned if vehicle or driver assigned for first time
    if (update_data.get("vehicle_id") or update_data.get("driver_id")) and shipment.status == ShipmentStatusEnum.Created:
        shipment.status = ShipmentStatusEnum.Assigned

    for field, val in update_data.items():
        setattr(shipment, field, val)

    shipment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(shipment)

    # Log update in history
    history = ShipmentHistory(
        shipment_id=shipment.shipment_id,
        status=shipment.status.value if isinstance(shipment.status, ShipmentStatusEnum) else str(shipment.status),
        note=f"Shipment details updated by {current_user.full_name}",
        changed_by_user_id=current_user.user_id,
        changed_by_name=current_user.full_name,
    )
    db.add(history)
    db.commit()

    return shipment


def update_shipment_status(
    db: Session,
    shipment: Shipment,
    new_status: ShipmentStatusEnum,
    note: Optional[str],
    current_user: User,
) -> Shipment:
    """Progress shipment through lifecycle stages."""
    shipment.status = new_status
    shipment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(shipment)

    history = ShipmentHistory(
        shipment_id=shipment.shipment_id,
        status=new_status.value,
        note=note or f"Status changed to {new_status.value}",
        changed_by_user_id=current_user.user_id,
        changed_by_name=current_user.full_name,
    )
    db.add(history)
    db.commit()

    return shipment


def get_shipment_history(db: Session, shipment_id: UUID) -> List[dict]:
    """Retrieve full status-change timeline for a shipment."""
    records = (
        db.query(ShipmentHistory)
        .filter(ShipmentHistory.shipment_id == shipment_id)
        .order_by(ShipmentHistory.changed_at.asc())
        .all()
    )

    result = []
    for r in records:
        user_name = r.changed_by_name
        if not user_name and r.changed_by_user_id:
            u = db.query(User).filter(User.user_id == r.changed_by_user_id).first()
            if u:
                user_name = u.full_name
        if not user_name:
            user_name = "System"

        result.append({
            "history_id": r.history_id,
            "shipment_id": r.shipment_id,
            "status": r.status,
            "note": r.note,
            "changed_by_name": user_name,
            "changed_at": r.changed_at,
        })
    return result


def flag_overdue_shipments(db: Session):
    """Automatically flag active shipments past expected delivery date as Delayed."""
    now = datetime.utcnow()
    overdue = (
        db.query(Shipment)
        .filter(
            Shipment.expected_delivery.isnot(None),
            Shipment.expected_delivery < now,
            Shipment.status.in_([ShipmentStatusEnum.Created, ShipmentStatusEnum.Assigned, ShipmentStatusEnum.InTransit]),
        )
        .all()
    )

    for s in overdue:
        s.status = ShipmentStatusEnum.Delayed
        history = ShipmentHistory(
            shipment_id=s.shipment_id,
            status=ShipmentStatusEnum.Delayed.value,
            note="Automatically flagged as Delayed (past expected delivery window)",
            changed_by_user_id=None,
            changed_by_name="System",
        )
        db.add(history)

    if overdue:
        db.commit()


def get_delayed_shipments(db: Session) -> List[Shipment]:
    """Return shipments that are delayed or past expected delivery window."""
    now = datetime.utcnow()
    return (
        db.query(Shipment)
        .filter(
            or_(
                Shipment.status == ShipmentStatusEnum.Delayed,
                (
                    Shipment.expected_delivery.isnot(None)
                    & (Shipment.expected_delivery < now)
                    & Shipment.status.notin_([ShipmentStatusEnum.Delivered, ShipmentStatusEnum.Cancelled])
                ),
            )
        )
        .order_by(Shipment.expected_delivery.asc())
        .all()
    )


def cancel_shipment(db: Session, shipment: Shipment, current_user: User) -> Shipment:
    """Soft delete: update shipment status to Cancelled."""
    return update_shipment_status(
        db, shipment, ShipmentStatusEnum.Cancelled, "Shipment cancelled", current_user
    )


def delete_shipment(db: Session, shipment: Shipment):
    """Hard delete record permanently."""
    db.delete(shipment)
    db.commit()
