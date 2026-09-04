from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles
from app.crud import maintenance as maintenance_crud
from app.models.user import User
from app.schemas.maintenance import (
    MaintenanceCreate,
    MaintenanceRead,
    MaintenanceStats,
    MaintenanceStatusUpdate,
    MaintenanceUpdate,
)

router = APIRouter(tags=["maintenance"])


@router.get("/stats/summary", response_model=MaintenanceStats, dependencies=[Depends(require_roles("Admin", "FleetManager"))])
def get_maintenance_summary_stats(
    db: Session = Depends(get_db),
) -> MaintenanceStats:
    """Aggregate fleet maintenance metrics and costs. Restricted to Admin and FleetManager."""
    return maintenance_crud.get_maintenance_stats(db)


@router.get("/", response_model=list[MaintenanceRead])
def list_maintenance_records(
    status_filter: str | None = Query(None, alias="status"),
    due_filter: str | None = Query(None, alias="filter"),
    vehicle_id: UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MaintenanceRead]:
    """List maintenance records with status and due date filtering (upcoming/overdue)."""
    return maintenance_crud.get_maintenance_list(
        db=db,
        current_user=current_user,
        status_filter=status_filter,
        due_filter=due_filter,
        vehicle_id=vehicle_id,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/alerts/trigger",
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def trigger_maintenance_alerts(
    db: Session = Depends(get_db),
) -> dict:
    """Manually trigger the maintenance alert check task synchronously for testing."""
    from app.tasks.maintenance import check_maintenance_alerts_sync
    result = check_maintenance_alerts_sync(db)
    return {"message": "Maintenance alerts task executed successfully", "details": result}


@router.get("/{maintenance_id}", response_model=MaintenanceRead)
def get_single_maintenance_record(
    maintenance_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MaintenanceRead:
    """Get a single maintenance record by ID."""
    record = maintenance_crud.get_maintenance_by_id(db, maintenance_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance record not found",
        )
    v = record.vehicle
    return MaintenanceRead(
        maintenance_id=record.maintenance_id,
        vehicle_id=record.vehicle_id,
        service_type=record.service_type,
        description=record.description,
        cost=record.cost,
        service_date=record.service_date,
        next_service_date=record.next_service_date,
        status=record.status,
        service_center=record.service_center,
        performed_by=record.performed_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
        vehicle_registration=v.registration_number if v else None,
        vehicle_brand=v.brand if v else None,
        vehicle_model=v.model if v else None,
    )


@router.post(
    "/",
    response_model=MaintenanceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def schedule_maintenance(
    maintenance_in: MaintenanceCreate,
    db: Session = Depends(get_db),
) -> MaintenanceRead:
    """Schedule vehicle maintenance. Restricted to Admin and FleetManager."""
    record = maintenance_crud.create_maintenance(db, maintenance_in)
    v = record.vehicle
    return MaintenanceRead(
        maintenance_id=record.maintenance_id,
        vehicle_id=record.vehicle_id,
        service_type=record.service_type,
        description=record.description,
        cost=record.cost,
        service_date=record.service_date,
        next_service_date=record.next_service_date,
        status=record.status,
        service_center=record.service_center,
        performed_by=record.performed_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
        vehicle_registration=v.registration_number if v else None,
        vehicle_brand=v.brand if v else None,
        vehicle_model=v.model if v else None,
    )


@router.put(
    "/{maintenance_id}",
    response_model=MaintenanceRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def update_maintenance_record(
    maintenance_id: UUID,
    maintenance_in: MaintenanceUpdate,
    db: Session = Depends(get_db),
) -> MaintenanceRead:
    """Update maintenance service details. Restricted to Admin and FleetManager."""
    record = maintenance_crud.update_maintenance(db, maintenance_id, maintenance_in)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance record not found",
        )
    v = record.vehicle
    return MaintenanceRead(
        maintenance_id=record.maintenance_id,
        vehicle_id=record.vehicle_id,
        service_type=record.service_type,
        description=record.description,
        cost=record.cost,
        service_date=record.service_date,
        next_service_date=record.next_service_date,
        status=record.status,
        service_center=record.service_center,
        performed_by=record.performed_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
        vehicle_registration=v.registration_number if v else None,
        vehicle_brand=v.brand if v else None,
        vehicle_model=v.model if v else None,
    )


@router.patch(
    "/{maintenance_id}/status",
    response_model=MaintenanceRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def update_maintenance_status(
    maintenance_id: UUID,
    status_in: MaintenanceStatusUpdate,
    db: Session = Depends(get_db),
) -> MaintenanceRead:
    """Advance or update maintenance status. Restricted to Admin and FleetManager."""
    record = maintenance_crud.update_maintenance(
        db, maintenance_id, MaintenanceUpdate(status=status_in.status)
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance record not found",
        )
    v = record.vehicle
    return MaintenanceRead(
        maintenance_id=record.maintenance_id,
        vehicle_id=record.vehicle_id,
        service_type=record.service_type,
        description=record.description,
        cost=record.cost,
        service_date=record.service_date,
        next_service_date=record.next_service_date,
        status=record.status,
        service_center=record.service_center,
        performed_by=record.performed_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
        vehicle_registration=v.registration_number if v else None,
        vehicle_brand=v.brand if v else None,
        vehicle_model=v.model if v else None,
    )


@router.delete(
    "/{maintenance_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def delete_maintenance_record(
    maintenance_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Delete a maintenance record. Restricted to Admin and FleetManager."""
    success = maintenance_crud.delete_maintenance(db, maintenance_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance record not found",
        )
    return {"message": "Maintenance record deleted successfully", "maintenance_id": str(maintenance_id)}
