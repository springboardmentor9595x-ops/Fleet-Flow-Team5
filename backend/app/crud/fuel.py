from collections import defaultdict
from datetime import datetime
from uuid import UUID
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.fuel_record import FuelRecord
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.fuel import FuelRecordCreate, FuelRecordRead, FuelStats, FuelTrendItem


def create_fuel_record(db: Session, fuel_in: FuelRecordCreate, current_user: User) -> FuelRecord:
    # If driver is submitting, resolve driver_id
    driver_id = fuel_in.driver_id
    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else None

    record = FuelRecord(
        vehicle_id=fuel_in.vehicle_id,
        driver_id=driver_id,
        liters=fuel_in.liters,
        cost=fuel_in.cost,
        odometer_km=fuel_in.odometer_km,
        fuel_type=fuel_in.fuel_type,
        fuel_station=fuel_in.fuel_station,
        receipt_number=fuel_in.receipt_number,
        fuel_date=fuel_in.fuel_date,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_fuel_records(
    db: Session,
    current_user: User,
    vehicle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[FuelRecordRead]:
    query = db.query(FuelRecord).join(Vehicle, FuelRecord.vehicle_id == Vehicle.vehicle_id)

    # Scoping: Drivers only see fuel logs for their own assigned vehicle or submissions
    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if driver:
            query = query.filter(
                or_(
                    FuelRecord.driver_id == driver.driver_id,
                    Vehicle.assigned_driver == driver.driver_id,
                    Vehicle.assigned_driver == current_user.user_id,
                )
            )
        else:
            query = query.filter(Vehicle.assigned_driver == current_user.user_id)

    if vehicle_id:
        query = query.filter(FuelRecord.vehicle_id == vehicle_id)

    records = query.order_by(FuelRecord.fuel_date.desc()).offset(skip).limit(limit).all()

    result = []
    for r in records:
        v = r.vehicle
        d = r.driver
        d_user = d.user if d and hasattr(d, 'user') else None
        result.append(
            FuelRecordRead(
                fuel_id=r.fuel_id,
                vehicle_id=r.vehicle_id,
                driver_id=r.driver_id,
                liters=r.liters,
                cost=r.cost,
                odometer_km=r.odometer_km,
                fuel_type=r.fuel_type,
                fuel_station=r.fuel_station,
                receipt_number=r.receipt_number,
                fuel_date=r.fuel_date,
                created_at=r.created_at,
                vehicle_registration=v.registration_number if v else None,
                driver_name=d_user.full_name if d_user else None,
            )
        )
    return result


def get_fuel_stats(db: Session) -> FuelStats:
    records = db.query(FuelRecord).order_by(FuelRecord.fuel_date.asc()).all()
    total_records = len(records)
    total_liters = sum(r.liters for r in records)
    total_cost = sum(r.cost for r in records)
    avg_cost_per_liter = (total_cost / total_liters) if total_liters > 0 else 0.0

    # Aggregate monthly trends
    monthly_data = defaultdict(lambda: {"liters": 0.0, "cost": 0.0, "count": 0})
    for r in records:
        m_key = r.fuel_date.strftime("%Y-%m") if r.fuel_date else "Unknown"
        monthly_data[m_key]["liters"] += r.liters
        monthly_data[m_key]["cost"] += r.cost
        monthly_data[m_key]["count"] += 1

    trends = [
        FuelTrendItem(
            month=m,
            total_liters=round(v["liters"], 2),
            total_cost=round(v["cost"], 2),
            record_count=v["count"],
        )
        for m, v in sorted(monthly_data.items())
    ]

    return FuelStats(
        total_fuel_records=total_records,
        total_liters_consumed=round(total_liters, 2),
        total_fuel_cost=round(total_cost, 2),
        average_cost_per_liter=round(avg_cost_per_liter, 2),
        monthly_trends=trends,
    )
