"""
Drivers Router — CRUD for fleet drivers.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.driver import Driver

router = APIRouter()


class DriverCreate(BaseModel):
    user_id: Optional[UUID] = None
    license_number: str
    experience_years: Optional[int] = 0
    address: Optional[str] = None
    status: Optional[str] = "Active"


class DriverUpdate(BaseModel):
    user_id: Optional[UUID] = None
    license_number: Optional[str] = None
    experience_years: Optional[int] = None
    address: Optional[str] = None
    status: Optional[str] = None


class DriverOut(BaseModel):
    driver_id: UUID
    user_id: Optional[UUID] = None
    license_number: Optional[str] = None
    experience_years: Optional[int] = None
    address: Optional[str] = None
    status: str
    driver_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[DriverOut])
def list_drivers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all registered drivers with full name resolution."""
    drivers = db.query(Driver).order_by(Driver.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for d in drivers:
        name = "Driver"
        if d.user_id:
            u = db.query(User).filter(User.user_id == d.user_id).first()
            if u:
                name = u.full_name
        result.append(
            DriverOut(
                driver_id=d.driver_id,
                user_id=d.user_id,
                license_number=d.license_number,
                experience_years=d.experience_years,
                address=d.address,
                status=d.status,
                driver_name=name,
            )
        )
    return result


@router.post("/", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def create_driver(
    payload: DriverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new driver record."""
    existing = db.query(Driver).filter(Driver.license_number == payload.license_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="License number already registered.")

    driver = Driver(**payload.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)

    name = "Driver"
    if driver.user_id:
        u = db.query(User).filter(User.user_id == driver.user_id).first()
        if u:
            name = u.full_name

    return DriverOut(
        driver_id=driver.driver_id,
        user_id=driver.user_id,
        license_number=driver.license_number,
        experience_years=driver.experience_years,
        address=driver.address,
        status=driver.status,
        driver_name=name,
    )


@router.get("/{driver_id}", response_model=DriverOut)
def get_driver(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found.")
    name = "Driver"
    if d.user_id:
        u = db.query(User).filter(User.user_id == d.user_id).first()
        if u:
            name = u.full_name

    return DriverOut(
        driver_id=d.driver_id,
        user_id=d.user_id,
        license_number=d.license_number,
        experience_years=d.experience_years,
        address=d.address,
        status=d.status,
        driver_name=name,
    )


@router.put("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: UUID,
    payload: DriverUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found.")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(d, field, val)

    db.commit()
    db.refresh(d)

    name = "Driver"
    if d.user_id:
        u = db.query(User).filter(User.user_id == d.user_id).first()
        if u:
            name = u.full_name

    return DriverOut(
        driver_id=d.driver_id,
        user_id=d.user_id,
        license_number=d.license_number,
        experience_years=d.experience_years,
        address=d.address,
        status=d.status,
        driver_name=name,
    )


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found.")

    db.delete(d)
    db.commit()
    return None
