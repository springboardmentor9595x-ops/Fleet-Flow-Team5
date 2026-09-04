from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles, require_admin
from app.crud import trip as trip_crud
from app.crud.notification import notify_route_recalculated
from app.models.driver import Driver
from app.models.user import User
from app.schemas.trip import (
    RouteCalculateRequest,
    RouteCalculateResponse,
    RouteOption,
    TripActionResponse,
    TripCreate,
    TripRead,
    TripRecalculateRequest,
)
from app.services.routing_service import (
    calculate_all_route_options,
    compute_live_eta,
    geocode_address,
)

router = APIRouter(tags=["trips"])


@router.post("/calculate-routes", response_model=RouteCalculateResponse)
async def calculate_routes(
    req: RouteCalculateRequest,
    current_user: User = Depends(get_current_user),
) -> RouteCalculateResponse:
    """Calculate 4 route options (Fastest, Shortest, Traffic-Avoidance, Fuel-Efficient) via OSRM/Nominatim."""
    start_lat = req.start_lat
    start_lng = req.start_lng
    if start_lat is None or start_lng is None:
        start_lat, start_lng = await geocode_address(req.source)

    dest_lat = req.dest_lat
    dest_lng = req.dest_lng
    if dest_lat is None or dest_lng is None:
        dest_lat, dest_lng = await geocode_address(req.destination)

    raw_routes = await calculate_all_route_options(
        start_lat=start_lat,
        start_lng=start_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
        source_addr=req.source,
        dest_addr=req.destination,
    )

    route_options = [RouteOption(**r) for r in raw_routes]

    return RouteCalculateResponse(
        source_address=req.source,
        dest_address=req.destination,
        source_coords=[start_lat, start_lng],
        dest_coords=[dest_lat, dest_lng],
        routes=route_options,
    )


@router.get("/", response_model=list[TripRead])
def list_trips(
    status_filter: str | None = Query(None, alias="status"),
    vehicle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TripRead]:
    """List trips. Admin/FleetManager/Dispatcher see all; Driver sees only their assigned trips."""
    return trip_crud.get_trips(
        db=db,
        current_user=current_user,
        status_filter=status_filter,
        vehicle_id=vehicle_id,
        skip=skip,
        limit=limit,
    )


@router.get("/{trip_id}", response_model=TripRead)
def get_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TripRead:
    """Get trip by ID."""
    trip = trip_crud.get_trip_by_id(db, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )
    return trip


@router.post(
    "/",
    response_model=TripRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
async def create_trip_endpoint(
    trip_in: TripCreate,
    db: Session = Depends(get_db),
) -> TripRead:
    """Create/schedule a trip with route optimization. Allowed for Admin, FleetManager, Dispatcher."""
    if trip_in.start_lat is None or trip_in.start_lng is None:
        trip_in.start_lat, trip_in.start_lng = await geocode_address(trip_in.start_location)

    if trip_in.dest_lat is None or trip_in.dest_lng is None:
        trip_in.dest_lat, trip_in.dest_lng = await geocode_address(trip_in.destination)

    if not trip_in.route_geometry or trip_in.planned_distance_km is None:
        routes = await calculate_all_route_options(
            trip_in.start_lat, trip_in.start_lng, trip_in.dest_lat, trip_in.dest_lng
        )
        # Pick requested route type or first
        selected = next((r for r in routes if r["route_type"] == trip_in.route_type), routes[0])
        trip_in.planned_distance_km = selected["distance_km"]
        trip_in.planned_duration_min = selected["duration_min"]
        trip_in.route_geometry = selected["coordinates"]

    return trip_crud.create_trip(db, trip_in)


@router.post(
    "/{trip_id}/start",
    response_model=TripActionResponse,
)
def start_trip_endpoint(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Driver")),
) -> TripActionResponse:
    """Start trip: sets status In Transit, marks vehicle & driver unavailable. Allowed for Admin, FleetManager, or assigned Driver."""
    trip = trip_crud.get_trip_by_id(db, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        is_owner = (
            (driver and trip.driver_id == driver.driver_id)
            or trip.driver_id == current_user.user_id
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Drivers can only start their own assigned trips.",
            )

    trip = trip_crud.start_trip(db, trip_id)
    return TripActionResponse(
        trip_id=trip.trip_id,
        status=trip.status,
        message="Trip started successfully. Vehicle and shipment marked as 'In Transit'.",
        timestamp=datetime.now(timezone.utc),
    )


@router.post(
    "/{trip_id}/end",
    response_model=TripActionResponse,
)
def end_trip_endpoint(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Driver")),
) -> TripActionResponse:
    """End trip: records actual distance/time, sets shipment to Delivered, frees vehicle/driver. Allowed for Admin, FleetManager, or assigned Driver."""
    trip = trip_crud.get_trip_by_id(db, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        is_owner = (
            (driver and trip.driver_id == driver.driver_id)
            or trip.driver_id == current_user.user_id
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Drivers can only end their own assigned trips.",
            )

    trip = trip_crud.end_trip(db, trip_id)
    return TripActionResponse(
        trip_id=trip.trip_id,
        status=trip.status,
        message="Trip completed successfully. Shipment marked as 'Delivered' and vehicle is now 'Available'.",
        timestamp=datetime.now(timezone.utc),
    )


@router.post(
    "/{trip_id}/recalculate",
    response_model=TripRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
async def recalculate_route(
    trip_id: UUID,
    req: TripRecalculateRequest,
    db: Session = Depends(get_db),
) -> TripRead:
    """Trigger route recalculation from current live GPS coordinate to destination. Allowed for Admin, FleetManager, and Dispatcher."""
    trip = trip_crud.get_trip_by_id(db, trip_id)
    if not trip or not trip.dest_lat or not trip.dest_lng:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip or destination coordinates not found",
        )

    route_type = req.route_type or trip.route_type
    routes = await calculate_all_route_options(
        req.current_lat, req.current_lng, trip.dest_lat, trip.dest_lng
    )
    selected = next((r for r in routes if r["route_type"] == route_type), routes[0])

    trip.route_geometry = selected["coordinates"]
    trip.planned_distance_km = selected["distance_km"]
    trip.planned_duration_min = selected["duration_min"]
    trip.route_type = route_type
    db.add(trip)
    db.commit()
    db.refresh(trip)

    notify_route_recalculated(db, trip)

    return trip


@router.post(
    "/{trip_id}/cancel",
    response_model=TripActionResponse,
    dependencies=[Depends(require_admin)],
)
def cancel_trip_endpoint(
    trip_id: UUID,
    db: Session = Depends(get_db),
) -> TripActionResponse:
    """Cancel trip. Restricted strictly to Admin."""
    trip = trip_crud.cancel_trip(db, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )
    return TripActionResponse(
        trip_id=trip.trip_id,
        status=trip.status,
        message="Trip cancelled successfully.",
        timestamp=datetime.now(timezone.utc),
    )

