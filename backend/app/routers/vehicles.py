from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles, require_admin
from app.crud import vehicle as vehicle_crud
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleStats, VehicleUpdate

router = APIRouter(tags=["vehicles"])


@router.get("/stats/summary", response_model=VehicleStats)
def get_vehicle_status_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VehicleStats:
    """Get aggregated counts of vehicles by status for monitoring dashboard."""
    stats = vehicle_crud.get_vehicle_stats(db)
    return VehicleStats(**stats)


@router.get("/", response_model=list[VehicleRead])
def list_vehicles(
    status_filter: str | None = Query(None, alias="status"),
    driver_id: UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[VehicleRead]:
    """List vehicles. Accessible to all authenticated roles for monitoring."""
    if status_filter:
        return vehicle_crud.get_vehicles_by_status(db, status_filter, skip=skip, limit=limit)
    if driver_id:
        return vehicle_crud.get_vehicles_by_driver(db, driver_id, skip=skip, limit=limit)
    return vehicle_crud.get_all_vehicles(db, skip=skip, limit=limit)


@router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VehicleRead:
    """Get vehicle by ID."""
    vehicle = vehicle_crud.get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    return vehicle


@router.post(
    "/",
    response_model=VehicleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_vehicle_endpoint(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db),
) -> VehicleRead:
    """Create a vehicle. Restricted strictly to Admin."""
    existing = vehicle_crud.get_vehicle_by_registration(db, vehicle_in.registration_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle with registration number '{vehicle_in.registration_number.upper()}' already exists.",
        )
    return vehicle_crud.create_vehicle(db, vehicle_in)


@router.put(
    "/{vehicle_id}",
    response_model=VehicleRead,
    dependencies=[Depends(require_admin)],
)
def update_vehicle_endpoint(
    vehicle_id: UUID,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db),
) -> VehicleRead:
    """Update a vehicle. Restricted strictly to Admin."""
    if vehicle_in.registration_number:
        existing = vehicle_crud.get_vehicle_by_registration(db, vehicle_in.registration_number)
        if existing and existing.vehicle_id != vehicle_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vehicle with registration number '{vehicle_in.registration_number.upper()}' already exists.",
            )
    vehicle = vehicle_crud.update_vehicle(db, vehicle_id, vehicle_in)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    return vehicle


@router.delete(
    "/{vehicle_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
def delete_vehicle_endpoint(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Delete a vehicle. Restricted strictly to Admin."""
    success = vehicle_crud.delete_vehicle(db, vehicle_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    return {"message": "Vehicle deleted successfully", "vehicle_id": str(vehicle_id)}


@router.post(
    "/{vehicle_id}/assign-driver",
    response_model=VehicleRead,
    dependencies=[Depends(require_admin)],
)
def assign_driver(
    vehicle_id: UUID,
    driver_id: UUID | None = None,
    db: Session = Depends(get_db),
) -> VehicleRead:
    """Assign or unassign a driver to a vehicle. Restricted strictly to Admin."""
    vehicle = vehicle_crud.assign_driver_to_vehicle(db, vehicle_id, driver_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    return vehicle

