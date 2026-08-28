"""
Trip Scheduling & Route Management Router.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.schemas.trip import (
    TripCreate,
    TripEndRequest,
    TripRecalculateRequest,
    TripOut,
)
from app.crud import trip as crud
from app.core.route_optimization import (
    geocode_address,
    calculate_route_options,
)

router = APIRouter()


@router.post("/", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def schedule_trip(
    data: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule a new trip. Admin & FleetManager only."""
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or FleetManager can schedule trips and select route modes.",
        )
    trip = crud.create_trip(db, data, current_user)
    return trip


@router.get("/", response_model=List[TripOut])
def list_trips(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List trips. Admin/FleetManager/Dispatcher see all; Driver sees assigned trips only."""
    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        from app.models.trip import Trip
        return db.query(Trip).filter(Trip.driver_id == driver.driver_id).order_by(Trip.created_at.desc()).offset(skip).limit(limit).all()

    return crud.list_trips(db, skip=skip, limit=limit)


@router.get("/{trip_id}", response_model=TripOut)
def get_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch details of a single trip."""
    t = crud.get_trip(db, trip_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found.")

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or t.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="You can only view your own trips.")

    return t


@router.post("/{trip_id}/start", response_model=TripOut)
def start_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a trip. Drivers start own trip; Admin & FleetManager can start/override."""
    t = crud.get_trip(db, trip_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found.")

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or t.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="You can only start your own assigned trip.")
    elif current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(status_code=403, detail="Dispatchers cannot start trips.")

    if t.status in ("In Progress", "Completed"):
        raise HTTPException(status_code=400, detail=f"Trip is already {t.status}.")

    started = crud.start_trip(db, t, current_user)
    return started


@router.post("/{trip_id}/end", response_model=TripOut)
def end_trip(
    trip_id: UUID,
    req: Optional[TripEndRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End a trip. Drivers end own trip; Admin & FleetManager can end/override."""
    t = crud.get_trip(db, trip_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found.")

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or t.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="You can only end your own assigned trip.")
    elif current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(status_code=403, detail="Dispatchers cannot end trips.")

    if t.status == "Completed":
        raise HTTPException(status_code=400, detail="Trip is already completed.")

    actual_dist = req.actual_distance_km if req else None
    ended = crud.end_trip(db, t, actual_dist, current_user)
    return ended



@router.post("/{trip_id}/recalculate", response_model=TripOut)
def recalculate_trip_route(
    trip_id: UUID,
    req: TripRecalculateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recalculate route mid-trip starting from current vehicle GPS coordinates."""
    t = crud.get_trip(db, trip_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found.")

    recalculated = crud.recalculate_trip_route(db, t, req.current_lat, req.current_lon)
    return recalculated


@router.get("/{trip_id}/route-options")
def get_trip_route_options(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all route options (Fastest, Shortest, Other) for a trip."""
    t = crud.get_trip(db, trip_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found.")

    s_lat, s_lon = geocode_address(t.start_location)
    d_lat, d_lon = geocode_address(t.destination)

    options = calculate_route_options(s_lat, s_lon, d_lat, d_lon)
    return {
        "trip_id": str(t.trip_id),
        "start_location": t.start_location,
        "destination": t.destination,
        "selected_route_type": t.planned_route_type,
        "route_options": options,
    }
