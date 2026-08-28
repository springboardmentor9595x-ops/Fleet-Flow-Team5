"""
Maintenance & Fuel Logging Router.
"""
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.vehicle import Vehicle

router = APIRouter()


class MaintenanceCreate(BaseModel):
    vehicle_id: Optional[UUID] = None
    maintenance_type: str
    service_date: date
    next_service_date: Optional[date] = None
    cost: float
    remarks: Optional[str] = None
    status: Optional[str] = "Scheduled"


class MaintenanceUpdate(BaseModel):
    vehicle_id: Optional[UUID] = None
    maintenance_type: Optional[str] = None
    service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    cost: Optional[float] = None
    remarks: Optional[str] = None
    status: Optional[str] = None
    last_notified_date: Optional[date] = None


class MaintenanceOut(BaseModel):
    maintenance_id: UUID
    vehicle_id: Optional[UUID] = None
    registration_number: Optional[str] = None
    maintenance_type: str
    service_date: date
    next_service_date: Optional[date] = None
    cost: float
    remarks: Optional[str] = None
    status: str
    last_notified_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class FuelRecordCreate(BaseModel):
    vehicle_id: Optional[UUID] = None
    fuel_amount: float
    fuel_cost: float
    mileage: float
    refill_date: date


class FuelRecordOut(BaseModel):
    fuel_id: UUID
    vehicle_id: UUID
    registration_number: Optional[str] = None
    fuel_amount: float
    fuel_cost: float
    mileage: float
    refill_date: date

    model_config = ConfigDict(from_attributes=True)


@router.get("/alerts")
def get_maintenance_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns active maintenance alerts categorized into:
    - 5_DAYS_BEFORE (Due in 5 days)
    - 1_DAY_BEFORE (Due tomorrow)
    - DUE_OR_OVERDUE (Due today or past due, keeps triggering until Resolved)
    Records with status 'Resolved' are ignored.
    """
    today = date.today()
    query = db.query(VehicleMaintenance).filter(
        VehicleMaintenance.status.notin_(["Resolved", "resolved"])
    )
    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else current_user.user_id
        assigned_vehicles = db.query(Vehicle.vehicle_id).filter(Vehicle.assigned_driver == driver_id).all()
        vehicle_ids = [v[0] for v in assigned_vehicles]
        query = query.filter(VehicleMaintenance.vehicle_id.in_(vehicle_ids))

    records = query.all()
    alerts = []
    for r in records:
        target_date = r.service_date or r.next_service_date
        if not target_date:
            continue
        delta_days = (target_date - today).days

        alert_type = None
        if delta_days == 5:
            alert_type = "5_DAYS_BEFORE"
        elif delta_days == 1:
            alert_type = "1_DAY_BEFORE"
        elif delta_days == 0:
            alert_type = "DUE_TODAY"
        elif delta_days < 0:
            alert_type = "OVERDUE"

        if alert_type:
            reg = None
            if r.vehicle_id:
                v = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
                if v:
                    reg = v.registration_number
            alerts.append({
                "maintenance_id": str(r.maintenance_id),
                "vehicle_id": str(r.vehicle_id) if r.vehicle_id else None,
                "registration_number": reg,
                "maintenance_type": r.maintenance_type,
                "service_date": str(target_date),
                "days_diff": delta_days,
                "level": alert_type,
                "status": r.status,
                "cost": float(r.cost or 0),
                "remarks": r.remarks,
                "last_notified_date": str(r.last_notified_date) if r.last_notified_date else None,
            })

    return {
        "total_alerts": len(alerts),
        "alerts": alerts,
        "summary": {
            "five_day_alerts": len([a for a in alerts if a["level"] == "5_DAYS_BEFORE"]),
            "one_day_alerts": len([a for a in alerts if a["level"] == "1_DAY_BEFORE"]),
            "due_today_alerts": len([a for a in alerts if a["level"] == "DUE_TODAY"]),
            "overdue_alerts": len([a for a in alerts if a["level"] == "OVERDUE"]),
        }
    }


@router.post("/check-alerts")
def trigger_alert_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger maintenance alerts processor on demand. Admin & FleetManager only."""
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or FleetManager can trigger alert checks.",
        )
    from app.tasks.maintenance import process_maintenance_alerts
    triggered = process_maintenance_alerts(db)
    return {
        "status": "success",
        "triggered_count": len(triggered),
        "alerts": triggered
    }


@router.post("/{maintenance_id}/resolve", response_model=MaintenanceOut)
def resolve_maintenance(
    maintenance_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a maintenance record as Resolved. Admin & FleetManager only."""
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or FleetManager can resolve maintenance records.",
        )
    rec = db.query(VehicleMaintenance).filter(VehicleMaintenance.maintenance_id == maintenance_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")

    rec.status = "Resolved"
    db.commit()
    db.refresh(rec)

    reg = None
    if rec.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == rec.vehicle_id).first()
        if v:
            reg = v.registration_number

    return MaintenanceOut(
        maintenance_id=rec.maintenance_id,
        vehicle_id=rec.vehicle_id,
        registration_number=reg,
        maintenance_type=rec.maintenance_type,
        service_date=rec.service_date,
        next_service_date=rec.next_service_date,
        cost=float(rec.cost or 0),
        remarks=rec.remarks,
        status=rec.status,
        last_notified_date=rec.last_notified_date,
    )


@router.get("/", response_model=List[MaintenanceOut])
def list_maintenance(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List maintenance records.
    Admin, FleetManager, and Dispatcher see fleet records.
    Driver sees records for their assigned vehicle only.
    """
    query = db.query(VehicleMaintenance)
    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else current_user.user_id
        assigned_vehicles = db.query(Vehicle.vehicle_id).filter(Vehicle.assigned_driver == driver_id).all()
        vehicle_ids = [v[0] for v in assigned_vehicles]
        query = query.filter(VehicleMaintenance.vehicle_id.in_(vehicle_ids))

    recs = query.order_by(VehicleMaintenance.service_date.desc()).offset(skip).limit(limit).all()
    result = []
    for r in recs:
        reg = None
        if r.vehicle_id:
            v = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
            if v:
                reg = v.registration_number
        result.append(
            MaintenanceOut(
                maintenance_id=r.maintenance_id,
                vehicle_id=r.vehicle_id,
                registration_number=reg,
                maintenance_type=r.maintenance_type,
                service_date=r.service_date,
                next_service_date=r.next_service_date,
                cost=float(r.cost or 0),
                remarks=r.remarks,
                status=r.status or "Scheduled",
                last_notified_date=r.last_notified_date,
            )
        )
    return result


@router.post("/", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def create_maintenance(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule maintenance. Admin & FleetManager only."""
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or FleetManager can schedule maintenance.",
        )

    rec = VehicleMaintenance(**payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)

    reg = None
    if rec.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == rec.vehicle_id).first()
        if v:
            reg = v.registration_number

    return MaintenanceOut(
        maintenance_id=rec.maintenance_id,
        vehicle_id=rec.vehicle_id,
        registration_number=reg,
        maintenance_type=rec.maintenance_type,
        service_date=rec.service_date,
        next_service_date=rec.next_service_date,
        cost=float(rec.cost or 0),
        remarks=rec.remarks,
        status=rec.status or "Scheduled",
        last_notified_date=rec.last_notified_date,
    )


@router.put("/{maintenance_id}", response_model=MaintenanceOut)
def update_maintenance(
    maintenance_id: UUID,
    payload: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update maintenance record. Admin & FleetManager only."""
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or FleetManager can edit maintenance records.",
        )

    rec = db.query(VehicleMaintenance).filter(VehicleMaintenance.maintenance_id == maintenance_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(rec, field, val)

    db.commit()
    db.refresh(rec)

    reg = None
    if rec.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == rec.vehicle_id).first()
        if v:
            reg = v.registration_number

    return MaintenanceOut(
        maintenance_id=rec.maintenance_id,
        vehicle_id=rec.vehicle_id,
        registration_number=reg,
        maintenance_type=rec.maintenance_type,
        service_date=rec.service_date,
        next_service_date=rec.next_service_date,
        cost=float(rec.cost or 0),
        remarks=rec.remarks,
        status=rec.status or "Scheduled",
        last_notified_date=rec.last_notified_date,
    )



@router.delete("/{maintenance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_maintenance(
    maintenance_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete maintenance record outright. Admin only."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can delete maintenance records.",
        )

    rec = db.query(VehicleMaintenance).filter(VehicleMaintenance.maintenance_id == maintenance_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")

    db.delete(rec)
    db.commit()
    return None


@router.get("/fuel", response_model=List[FuelRecordOut])
def list_fuel_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List fuel records. Dispatcher has no access; Driver sees assigned vehicle only."""
    if current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dispatchers do not have access to fuel records.",
        )

    query = db.query(FuelRecord)
    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else current_user.user_id
        assigned_vehicles = db.query(Vehicle.vehicle_id).filter(Vehicle.assigned_driver == driver_id).all()
        vehicle_ids = [v[0] for v in assigned_vehicles]
        query = query.filter(FuelRecord.vehicle_id.in_(vehicle_ids))

    recs = query.order_by(FuelRecord.refill_date.desc()).offset(skip).limit(limit).all()
    result = []
    for r in recs:
        reg = None
        if r.vehicle_id:
            v = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
            if v:
                reg = v.registration_number
        result.append(
            FuelRecordOut(
                fuel_id=r.fuel_id,
                vehicle_id=r.vehicle_id,
                registration_number=reg,
                fuel_amount=float(r.fuel_amount or 0),
                fuel_cost=float(r.fuel_cost or 0),
                mileage=float(r.mileage or 0),
                refill_date=r.refill_date,
            )
        )
    return result


@router.post("/fuel", response_model=FuelRecordOut, status_code=status.HTTP_201_CREATED)
def create_fuel_record(
    payload: FuelRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a fuel record. Dispatcher blocked; Driver restricted to assigned vehicle."""
    if current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dispatchers cannot log fuel records.",
        )

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else current_user.user_id
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == payload.vehicle_id).first()
        if not v or v.assigned_driver != driver_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Drivers can only log fuel refills for their assigned vehicle.",
            )

    rec = FuelRecord(**payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)

    reg = None
    if rec.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == rec.vehicle_id).first()
        if v:
            reg = v.registration_number

    return FuelRecordOut(
        fuel_id=rec.fuel_id,
        vehicle_id=rec.vehicle_id,
        registration_number=reg,
        fuel_amount=float(rec.fuel_amount or 0),
        fuel_cost=float(rec.fuel_cost or 0),
        mileage=float(rec.mileage or 0),
        refill_date=rec.refill_date,
    )

