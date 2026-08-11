"""
Shipment Router — full CRUD + status progression + history + alerts.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.shipment import ShipmentStatusEnum
from app.schemas.shipment import (
    ShipmentCreate,
    ShipmentUpdate,
    ShipmentOut,
    ShipmentHistoryOut,
    ShipmentStatusUpdate,
    ShipmentListResponse,
    RouteOptimizationRequest,
)
from app.crud import shipment as crud

router = APIRouter()

MANAGEMENT_ROLES = {RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher}


def _require_management(user: User):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin, FleetManager, or Dispatcher access required.",
        )


def _shipment_out(s) -> ShipmentOut:
    return ShipmentOut.from_orm_with_delay(s)


# ── Create ──────────────────────────────────────────────────────────────────

@router.post("/", response_model=ShipmentOut, status_code=status.HTTP_201_CREATED)
def create_shipment(
    data: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new shipment. Requires Admin / FleetManager / Dispatcher."""
    _require_management(current_user)

    # Only enforce duplicate check for explicitly-provided tracking numbers.
    # Auto-generated ones (FF-YYYY-XXXXXXXX) are cryptographically unique.
    if data.tracking_number and crud.get_shipment_by_tracking(db, data.tracking_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tracking number '{data.tracking_number}' already exists.",
        )

    shipment = crud.create_shipment(db, data, created_by=current_user)
    return _shipment_out(shipment)


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=ShipmentListResponse)
def list_shipments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List shipments scoped by role. Driver sees only their own."""
    # Auto-flag overdue before returning
    crud.flag_overdue_shipments(db)

    shipments = crud.get_all_shipments(db, current_user, skip=skip, limit=limit)
    delayed_count = sum(1 for s in shipments if s.status == ShipmentStatusEnum.Delayed)
    return ShipmentListResponse(
        shipments=[_shipment_out(s) for s in shipments],
        total=len(shipments),
        delayed_count=delayed_count,
    )


# ── Alerts ───────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=List[ShipmentOut])
def get_delayed_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all shipments past their expected delivery window."""
    crud.flag_overdue_shipments(db)
    return [_shipment_out(s) for s in crud.get_delayed_shipments(db)]


# ── By Customer ──────────────────────────────────────────────────────────────

@router.get("/customer/{customer_name}", response_model=List[ShipmentOut])
def get_by_customer(
    customer_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch shipment history for a customer (partial name match)."""
    return [_shipment_out(s) for s in crud.get_shipments_by_customer(db, customer_name)]


# ── By Vehicle ───────────────────────────────────────────────────────────────

@router.get("/vehicle/{vehicle_id}", response_model=List[ShipmentOut])
def get_by_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch shipment history for a vehicle."""
    return [_shipment_out(s) for s in crud.get_shipments_by_vehicle(db, vehicle_id)]


# ── Get Single ────────────────────────────────────────────────────────────────

@router.get("/{shipment_id}", response_model=ShipmentOut)
def get_shipment(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = crud.get_shipment(db, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found.")
    return _shipment_out(s)


# ── History / Timeline ────────────────────────────────────────────────────────

@router.get("/{shipment_id}/history", response_model=List[ShipmentHistoryOut])
def get_history(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full status-change timeline for a shipment."""
    s = crud.get_shipment(db, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found.")
    # crud returns list of dicts (with changed_by_name resolved) — validate each explicitly
    raw = crud.get_shipment_history(db, shipment_id)
    return [ShipmentHistoryOut.model_validate(item) for item in raw]



# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{shipment_id}", response_model=ShipmentOut)
def update_shipment(
    shipment_id: UUID,
    data: ShipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit shipment details or reassign vehicle/driver."""
    _require_management(current_user)
    s = crud.get_shipment(db, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    # Prevent duplicate tracking number collision
    if data.tracking_number and data.tracking_number != s.tracking_number:
        if crud.get_shipment_by_tracking(db, data.tracking_number):
            raise HTTPException(status_code=400, detail="Tracking number already in use.")

    updated = crud.update_shipment(db, s, data, current_user)
    return _shipment_out(updated)


# ── Status Update ─────────────────────────────────────────────────────────────

@router.patch("/{shipment_id}/status", response_model=ShipmentOut)
def update_status(
    shipment_id: UUID,
    data: ShipmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Progress a shipment through its delivery stages.
    Drivers can update status of their own shipments.
    Managers/Dispatchers can update any shipment.
    """
    s = crud.get_shipment(db, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    # Driver can only update their own shipment
    if current_user.role == RoleEnum.Driver:
        from app.models.driver import Driver
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or s.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="You can only update your own assigned shipments.")

    # Validate status transition (can't reopen a Delivered/Cancelled shipment)
    if s.status in (ShipmentStatusEnum.Delivered, ShipmentStatusEnum.Cancelled):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change status of a {s.status.value} shipment.",
        )

    updated = crud.update_shipment_status(db, s, data.status, data.note, current_user)
    return _shipment_out(updated)


# ── Cancel / Delete ───────────────────────────────────────────────────────────

@router.delete("/{shipment_id}", status_code=status.HTTP_200_OK)
def cancel_or_delete_shipment(
    shipment_id: UUID,
    hard_delete: bool = Query(False, description="If true, permanently delete; otherwise cancel."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel (soft) or permanently delete a shipment."""
    _require_management(current_user)
    s = crud.get_shipment(db, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    if hard_delete:
        if current_user.role != RoleEnum.Admin:
            raise HTTPException(status_code=403, detail="Only Admin can permanently delete shipments.")
        crud.delete_shipment(db, s)
        return {"message": "Shipment permanently deleted."}
    else:
        crud.cancel_shipment(db, s, current_user)
        return {"message": "Shipment cancelled.", "shipment_id": str(shipment_id)}


# ── Route Optimization & Dynamic ETA ─────────────────────────────────────────

@router.post("/optimize-route")
def optimize_shipment_route(
    req: RouteOptimizationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Optimize multi-stop delivery routes for selected shipments or an assigned vehicle.
    Uses 2-Opt Traveling Salesperson Problem (TSP) heuristic to minimize total distance & duration.
    """
    from app.core.route_optimization import optimize_multi_stop_route
    from app.models.shipment import Shipment, ShipmentStatusEnum
    from app.crud.gps import get_latest_position

    # 1. Gather target shipments
    if req.shipment_ids:
        shipments = db.query(Shipment).filter(Shipment.shipment_id.in_(req.shipment_ids)).all()
    elif req.vehicle_id:
        shipments = (
            db.query(Shipment)
            .filter(
                Shipment.vehicle_id == req.vehicle_id,
                Shipment.status.in_([ShipmentStatusEnum.Assigned, ShipmentStatusEnum.InTransit]),
            )
            .all()
        )
    else:
        shipments = (
            db.query(Shipment)
            .filter(Shipment.status.in_([ShipmentStatusEnum.Created, ShipmentStatusEnum.Assigned, ShipmentStatusEnum.InTransit]))
            .limit(10)
            .all()
        )

    if not shipments:
        raise HTTPException(status_code=404, detail="No active shipments found to optimize.")

    # 2. Determine origin coordinates (fallback to vehicle latest position or first shipment source)
    origin_lat, origin_lon = None, None
    origin_name = req.origin_name or "Dispatch Hub"

    if req.origin_lat is not None and req.origin_lon is not None:
        origin_lat, origin_lon = float(req.origin_lat), float(req.origin_lon)
    elif req.vehicle_id:
        pos = get_latest_position(db, req.vehicle_id)
        if pos:
            origin_lat, origin_lon = float(pos.latitude), float(pos.longitude)
            origin_name = f"Vehicle Position"

    if origin_lat is None or origin_lon is None:
        # Fallback to source of first shipment or Kollam Hub
        s0 = shipments[0]
        origin_lat = float(s0.source_lat) if s0.source_lat else 8.8932
        origin_lon = float(s0.source_lon) if s0.source_lon else 76.6141
        origin_name = s0.source or "Fleet Hub"

    origin = {"name": origin_name, "lat": origin_lat, "lon": origin_lon}

    # 3. Coordinate mapping helper for city names
    CITY_COORDS = {
        "kollam": (8.8932, 76.6141), "mumbai": (19.0760, 72.8777), "pune": (18.5204, 73.8567),
        "delhi": (28.6139, 77.2090), "bangalore": (12.9716, 77.5946), "chennai": (13.0827, 80.2707),
        "hyderabad": (17.3850, 78.4867), "kolkata": (22.5726, 88.3639),
    }

    def resolve_coords(dest_name, d_lat, d_lon):
        if d_lat is not None and d_lon is not None:
            return float(d_lat), float(d_lon)
        if dest_name:
            k = dest_name.strip().lower()
            for city, coords in CITY_COORDS.items():
                if city in k:
                    return coords
        # Default jitter around origin
        return origin_lat + 0.05, origin_lon + 0.05

    # 4. Prepare stops list
    stops = []
    for s in shipments:
        lat, lon = resolve_coords(s.destination, s.destination_lat, s.destination_lon)
        stops.append({
            "id": str(s.shipment_id),
            "tracking_number": s.tracking_number,
            "name": f"{s.destination} ({s.customer_name})",
            "lat": lat,
            "lon": lon,
            "customer_name": s.customer_name,
            "status": s.status.value,
        })

    # 5. Run TSP optimization engine
    from app.core.route_optimization import haversine_distance_km
    from datetime import datetime, timedelta

    result = optimize_multi_stop_route(origin, stops)

    # Calculate original distance
    original_distance_km = 0.0
    current_pt = origin
    for s in stops:
        original_distance_km += haversine_distance_km(current_pt["lat"], current_pt["lon"], s["lat"], s["lon"])
        current_pt = s
    original_distance_km = round(original_distance_km, 2)

    total_distance_km = result["total_distance_km"]
    distance_saved_km = max(0.0, round(original_distance_km - total_distance_km, 2))

    total_duration_minutes = round((total_distance_km / 45.0) * 60.0, 1)
    original_duration_minutes = round((original_distance_km / 45.0) * 60.0, 1)
    time_saved_minutes = max(0.0, round(original_duration_minutes - total_duration_minutes, 1))

    # Est fuel saved (e.g. heavy truck ~ 15L per 100km, so 0.15L per km)
    fuel_saved_liters = max(0.0, round(distance_saved_km * 0.15, 2))

    # Generate legs sequence for the timeline itinerary
    legs = []
    current_pt = origin
    current_time = datetime.utcnow()
    for idx, s in enumerate(result["ordered_stops"]):
        leg_dist = haversine_distance_km(current_pt["lat"], current_pt["lon"], s["lat"], s["lon"])
        leg_dur = round((leg_dist / 45.0) * 60.0, 1)
        current_time += timedelta(minutes=leg_dur)

        legs.append({
            "step": idx + 1,
            "from_name": current_pt.get("name", "Dispatch Hub"),
            "to_name": s["name"],
            "leg_distance_km": leg_dist,
            "leg_duration_minutes": leg_dur,
            "estimated_arrival": current_time.isoformat(),
            "tracking_number": s.get("tracking_number", ""),
        })
        current_pt = s

    return {
        "origin": origin,
        "ordered_stops": result["ordered_stops"],
        "original_distance_km": original_distance_km,
        "total_distance_km": total_distance_km,
        "distance_saved_km": distance_saved_km,
        "original_duration_minutes": original_duration_minutes,
        "total_duration_minutes": total_duration_minutes,
        "time_saved_minutes": time_saved_minutes,
        "fuel_saved_liters": fuel_saved_liters,
        "legs": legs,
        "stop_count": result["stop_count"],
        "optimization_algorithm": result["optimization_algorithm"],
    }



@router.get("/{shipment_id}/eta")
def get_shipment_dynamic_eta(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate dynamic ETA for a single shipment based on live assigned vehicle GPS position.
    """
    from app.core.route_optimization import calculate_dynamic_eta
    from app.crud.gps import get_latest_position

    s = crud.get_shipment(db, shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    if not s.vehicle_id:
        return {
            "shipment_id": str(shipment_id),
            "tracking_number": s.tracking_number,
            "status": s.status.value,
            "has_assigned_vehicle": False,
            "detail": "No vehicle assigned to this shipment.",
        }

    latest_pos = get_latest_position(db, s.vehicle_id)
    if not latest_pos:
        return {
            "shipment_id": str(shipment_id),
            "tracking_number": s.tracking_number,
            "status": s.status.value,
            "has_assigned_vehicle": True,
            "has_gps_data": False,
            "detail": "Vehicle assigned but no GPS pings received yet.",
        }

    # Resolve destination coordinates
    dest_lat = float(s.destination_lat) if s.destination_lat else 19.0760
    dest_lon = float(s.destination_lon) if s.destination_lon else 72.8777

    eta_info = calculate_dynamic_eta(
        current_lat=float(latest_pos.latitude),
        current_lon=float(latest_pos.longitude),
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        current_speed_kmh=float(latest_pos.speed) if latest_pos.speed else None,
        expected_delivery=s.expected_delivery,
    )

    return {
        "shipment_id": str(shipment_id),
        "tracking_number": s.tracking_number,
        "status": s.status.value,
        "has_assigned_vehicle": True,
        "has_gps_data": True,
        "vehicle_id": str(s.vehicle_id),
        "latest_ping_time": latest_pos.recorded_time.isoformat(),
        "expected_delivery": s.expected_delivery.isoformat() if s.expected_delivery else None,
        **eta_info,
    }

