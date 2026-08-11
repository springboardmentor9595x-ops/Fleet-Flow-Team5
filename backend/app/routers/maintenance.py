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
from app.models.user import User
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.vehicle import Vehicle

router = APIRouter()


class MaintenanceCreate(BaseModel):
    vehicle_id: UUID
    maintenance_type: str
    service_date: date
    next_service_date: Optional[date] = None
    cost: float
    remarks: Optional[str] = None
    status: Optional[str] = "Completed"


class MaintenanceOut(BaseModel):
    maintenance_id: UUID
    vehicle_id: UUID
    registration_number: Optional[str] = None
    maintenance_type: str
    service_date: date
    next_service_date: Optional[date] = None
    cost: float
    remarks: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class FuelRecordCreate(BaseModel):
    vehicle_id: UUID
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


@router.get("/", response_model=List[MaintenanceOut])
def list_maintenance(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recs = db.query(VehicleMaintenance).order_by(VehicleMaintenance.service_date.desc()).offset(skip).limit(limit).all()
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
                status=r.status or "Completed",
            )
        )
    return result


@router.post("/", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def create_maintenance(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
        status=rec.status or "Completed",
    )


@router.get("/fuel", response_model=List[FuelRecordOut])
def list_fuel_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recs = db.query(FuelRecord).order_by(FuelRecord.refill_date.desc()).offset(skip).limit(limit).all()
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
