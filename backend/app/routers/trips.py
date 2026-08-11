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

MANAGEMENT_ROLES = {RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher}


def _require_management(user: User):
    if user.role not in MANAGEMENT_ROLES and user.role != RoleEnum.Driver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized access required.",
        )


@router.post("/", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def schedule_trip(
    data: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule a new trip for a shipment, vehicle, and driver."""
    _require_management(current_user)
    trip = crud.create_trip(db, data, current_user)
    return trip


@router.get("/", response_model=List[TripOut])
def list_trips(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all scheduled and active trips."""
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
    return t


@router.post("/{trip_id}/start", response_model=TripOut)
def start_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a trip (sets trip & shipment status to In Transit, locks vehicle & driver)."""
    t = crud.get_trip(db, trip_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found.")
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
    """End a trip (records actual distance/time, updates shipment to Delivered, frees vehicle)."""
    t = crud.get_trip(db, trip_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found.")
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
    """Return all 4 route options (Fastest, Shortest, Traffic Avoidance, Fuel-Efficient) for a trip."""
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
