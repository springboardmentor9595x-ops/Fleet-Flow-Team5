from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles
from app.crud import shipment as shipment_crud
from app.models.user import User
from app.schemas.shipment import (
    ShipmentAlert,
    ShipmentCreate,
    ShipmentRead,
    ShipmentStatusUpdate,
    ShipmentTrackingDetail,
    ShipmentUpdate,
)
from app.services.routing_service import geocode_address

router = APIRouter(tags=["shipments"])


@router.get(
    "/alerts/delayed",
    response_model=list[ShipmentAlert],
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
def get_delayed_shipment_alerts(
    db: Session = Depends(get_db),
) -> list[ShipmentAlert]:
    """Flag shipments approaching or past their expected delivery window. Restricted to Admin, FleetManager, Dispatcher."""
    alerts = shipment_crud.get_delayed_shipments(db)
    return [ShipmentAlert(**a) for a in alerts]


@router.get(
    "/history",
    response_model=list[ShipmentRead],
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
def get_shipment_history(
    customer: str | None = None,
    vehicle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[ShipmentRead]:
    """Fetch shipment history filtered by customer name or vehicle ID. Restricted to Admin, FleetManager, Dispatcher."""
    shipments = shipment_crud.get_shipments(
        db=db,
        customer_filter=customer,
        vehicle_id=vehicle_id,
        skip=skip,
        limit=limit,
    )
    return [shipment_crud.build_shipment_read(db, s) for s in shipments]


@router.get("/tracking/{tracking_number}", response_model=ShipmentRead)
def track_shipment_by_number(
    tracking_number: str,
    db: Session = Depends(get_db),
) -> ShipmentRead:
    """Public / quick shipment tracking lookup."""
    shipment = shipment_crud.get_shipment_by_tracking(db, tracking_number)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipment with tracking number '{tracking_number}' not found.",
        )
    return shipment_crud.build_shipment_read(db, shipment)


@router.get("/", response_model=list[ShipmentRead])
def list_shipments(
    status_filter: str | None = Query(None, alias="status"),
    customer: str | None = None,
    vehicle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ShipmentRead]:
    """List shipments. Admin/FleetManager/Dispatcher see all; Driver sees only their own."""
    shipments = shipment_crud.get_shipments(
        db=db,
        current_user=current_user,
        status_filter=status_filter,
        customer_filter=customer,
        vehicle_id=vehicle_id,
        skip=skip,
        limit=limit,
    )
    return [shipment_crud.build_shipment_read(db, s) for s in shipments]


@router.get("/{shipment_id}/tracking", response_model=ShipmentTrackingDetail)
def get_shipment_tracking_endpoint(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShipmentTrackingDetail:
    """Authoritative shipment live tracking resolution endpoint."""
    detail = shipment_crud.get_shipment_tracking_detail(db, shipment_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found or tracking unavailable.",
        )
    return detail


@router.get("/{shipment_id}", response_model=ShipmentRead)
def get_shipment(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShipmentRead:
    """Get single shipment by ID."""
    shipment = shipment_crud.get_shipment_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found",
        )
    return shipment_crud.build_shipment_read(db, shipment)


@router.post(
    "/",
    response_model=ShipmentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
async def create_shipment_endpoint(
    shipment_in: ShipmentCreate,
    db: Session = Depends(get_db),
) -> ShipmentRead:
    """Create a new shipment. Restricted to Admin, FleetManager, Dispatcher."""
    if not shipment_in.driver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a driver.",
        )

    # Geocode source if coordinates not supplied
    if (shipment_in.source_lat is None or shipment_in.source_lng is None) and shipment_in.source:
        lat, lng = await geocode_address(shipment_in.source)
        shipment_in.source_lat = lat
        shipment_in.source_lng = lng

    # Geocode destination if coordinates not supplied
    if (shipment_in.dest_lat is None or shipment_in.dest_lng is None) and shipment_in.destination:
        lat, lng = await geocode_address(shipment_in.destination)
        shipment_in.dest_lat = lat
        shipment_in.dest_lng = lng

    shipment = shipment_crud.create_shipment(db, shipment_in)
    return shipment_crud.build_shipment_read(db, shipment)


@router.put(
    "/{shipment_id}",
    response_model=ShipmentRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
async def update_shipment_endpoint(
    shipment_id: UUID,
    shipment_in: ShipmentUpdate,
    db: Session = Depends(get_db),
) -> ShipmentRead:
    """Update shipment details, reassign vehicle/driver. Restricted to Admin, FleetManager, Dispatcher."""
    if shipment_in.source and (shipment_in.source_lat is None or shipment_in.source_lng is None):
        lat, lng = await geocode_address(shipment_in.source)
        shipment_in.source_lat = lat
        shipment_in.source_lng = lng

    if shipment_in.destination and (shipment_in.dest_lat is None or shipment_in.dest_lng is None):
        lat, lng = await geocode_address(shipment_in.destination)
        shipment_in.dest_lat = lat
        shipment_in.dest_lng = lng

    shipment = shipment_crud.update_shipment(db, shipment_id, shipment_in)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found",
        )
    return shipment_crud.build_shipment_read(db, shipment)


@router.patch(
    "/{shipment_id}/status",
    response_model=ShipmentRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
def update_status_endpoint(
    shipment_id: UUID,
    status_in: ShipmentStatusUpdate,
    db: Session = Depends(get_db),
) -> ShipmentRead:
    """Delivery status progression endpoint. Restricted to Admin, FleetManager, Dispatcher."""
    shipment = shipment_crud.update_shipment_status(db, shipment_id, status_in.status, status_in.notes)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found",
        )
    return shipment_crud.build_shipment_read(db, shipment)


@router.post(
    "/{shipment_id}/cancel",
    response_model=ShipmentRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
def cancel_shipment_endpoint(
    shipment_id: UUID,
    db: Session = Depends(get_db),
) -> ShipmentRead:
    """Cancel shipment. Restricted to Admin, FleetManager, Dispatcher."""
    shipment = shipment_crud.cancel_shipment(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found",
        )
    return shipment_crud.build_shipment_read(db, shipment)
