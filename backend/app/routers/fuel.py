from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles
from app.crud import fuel as fuel_crud
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.fuel import FuelRecordCreate, FuelRecordRead, FuelStats

router = APIRouter(tags=["fuel"])


@router.get(
    "/stats/trends",
    response_model=FuelStats,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def get_fuel_analytics_and_trends(
    db: Session = Depends(get_db),
) -> FuelStats:
    """Aggregated fuel consumption metrics, cost summaries, and monthly trends. Restricted to Admin and FleetManager."""
    return fuel_crud.get_fuel_stats(db)


@router.get(
    "/",
    response_model=list[FuelRecordRead],
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Driver"))],
)
def list_fuel_records(
    vehicle_id: UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FuelRecordRead]:
    """
    List fuel records.
    - Admin & FleetManager view all fleet fuel logs.
    - Drivers only view their own fuel logs.
    - Dispatchers are forbidden (403).
    """
    return fuel_crud.get_fuel_records(
        db=db,
        current_user=current_user,
        vehicle_id=vehicle_id,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/",
    response_model=FuelRecordRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Driver"))],
)
def log_fuel_entry(
    fuel_in: FuelRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelRecordRead:
    """
    Log a fuel record entry.
    - Admin & FleetManager can log for any vehicle.
    - Drivers can only log fuel for their own assigned vehicle.
    - Dispatchers are forbidden (403).
    """
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == fuel_in.vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )

    # Driver verification: Ensure vehicle is assigned to current driver
    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        is_assigned = (
            (driver and vehicle.assigned_driver == driver.driver_id)
            or vehicle.assigned_driver == current_user.user_id
        )
        if not is_assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Drivers can only log fuel for their own assigned vehicle.",
            )

    record = fuel_crud.create_fuel_record(db, fuel_in, current_user)
    v = record.vehicle
    d = record.driver
    d_user = d.user if d and hasattr(d, 'user') else None

    return FuelRecordRead(
        fuel_id=record.fuel_id,
        vehicle_id=record.vehicle_id,
        driver_id=record.driver_id,
        liters=record.liters,
        cost=record.cost,
        odometer_km=record.odometer_km,
        fuel_type=record.fuel_type,
        fuel_station=record.fuel_station,
        receipt_number=record.receipt_number,
        fuel_date=record.fuel_date,
        created_at=record.created_at,
        vehicle_registration=v.registration_number if v else None,
        driver_name=d_user.full_name if d_user else None,
    )
