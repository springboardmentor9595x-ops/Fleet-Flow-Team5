"""
Vehicles Router — CRUD for fleet vehicles.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.vehicle import Vehicle

router = APIRouter()


class VehicleCreate(BaseModel):
    registration_number: str
    vehicle_type: str
    brand: Optional[str] = None
    model: Optional[str] = None
    manufacture_year: Optional[int] = None
    fuel_type: Optional[str] = None
    capacity: Optional[int] = None
    assigned_driver: Optional[UUID] = None
    status: Optional[str] = "Available"


class VehicleUpdate(BaseModel):
    registration_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    manufacture_year: Optional[int] = None
    fuel_type: Optional[str] = None
    capacity: Optional[int] = None
    assigned_driver: Optional[UUID] = None
    status: Optional[str] = None


class VehicleOut(BaseModel):
    vehicle_id: UUID
    registration_number: str
    vehicle_type: str
    brand: Optional[str] = None
    model: Optional[str] = None
    manufacture_year: Optional[int] = None
    fuel_type: Optional[str] = None
    capacity: Optional[int] = None
    assigned_driver: Optional[UUID] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[VehicleOut])
def list_vehicles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all registered fleet vehicles."""
    return db.query(Vehicle).order_by(Vehicle.registration_number.asc()).offset(skip).limit(limit).all()


@router.post("/", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new vehicle."""
    existing = db.query(Vehicle).filter(Vehicle.registration_number == payload.registration_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Registration number already registered.")
    
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return v


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(v, field, val)

    db.commit()
    db.refresh(v)
    return v


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    db.delete(v)
    db.commit()
    return None
