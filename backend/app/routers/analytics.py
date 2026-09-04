from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin, require_roles
from app.crud import analytics as analytics_crud
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.analytics import (
    DeliveryPerformanceResponse,
    DriverPerformanceResponse,
    FleetUtilizationResponse,
    FuelEfficiencyResponse,
    MaintenanceAnalyticsResponse,
    OperationalSummaryResponse,
    VehicleFuelTrendResponse,
)

router = APIRouter(tags=["analytics"])


@router.get(
    "/fleet-utilization",
    response_model=FleetUtilizationResponse,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def get_fleet_utilization_analytics(
    db: Session = Depends(get_db),
) -> FleetUtilizationResponse:
    """Compute fleet utilization percentages and status distribution. Restricted to Admin and FleetManager."""
    return analytics_crud.compute_fleet_utilization(db)


@router.get("/driver-performance", response_model=DriverPerformanceResponse)
def get_driver_performance_analytics(
    driver_id: UUID | None = Query(None, description="Optional driver ID filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DriverPerformanceResponse:
    """
    Compute driver performance metrics (trips completed, on-time delivery rate, attendance rate).
    - Admin & FleetManager view all drivers (or filter by driver_id).
    - Drivers view only their own performance metrics.
    """
    target_id = driver_id

    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        own_driver_id = driver.driver_id if driver else current_user.user_id

        if driver_id and driver_id != own_driver_id and driver_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Drivers can only view their own performance metrics.",
            )
        target_id = own_driver_id

    return analytics_crud.compute_driver_performance(db, target_driver_id=target_id)


@router.get(
    "/delivery-performance",
    response_model=DeliveryPerformanceResponse,
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
def get_delivery_performance_analytics(
    start_date: date | None = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date filter (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
) -> DeliveryPerformanceResponse:
    """
    Compute shipment/delivery performance metrics (on-time rate, delayed rate, avg delivery time).
    Allowed for Admin, FleetManager, and Dispatcher.
    """
    return analytics_crud.compute_delivery_performance(db, start_date=start_date, end_date=end_date)


@router.get(
    "/maintenance",
    response_model=MaintenanceAnalyticsResponse,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def get_maintenance_analytics(
    db: Session = Depends(get_db),
) -> MaintenanceAnalyticsResponse:
    """
    Compute maintenance cost per vehicle and frequency grouped by service type.
    Restricted to Admin and FleetManager.
    """
    return analytics_crud.compute_maintenance_analytics(db)


@router.get("/fuel-efficiency", response_model=FuelEfficiencyResponse)
def get_fuel_efficiency_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelEfficiencyResponse:
    """
    Compute fuel efficiency metrics (distance traveled per trip / fuel consumed).
    - Admin & FleetManager view fleet-wide fuel efficiency.
    - Drivers view fuel efficiency for their own assigned vehicle only.
    """
    target_vehicle_id = None
    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        veh = db.query(Vehicle).filter(
            or_(
                Vehicle.assigned_driver == (driver.driver_id if driver else None),
                Vehicle.assigned_driver == current_user.user_id,
            )
        ).first()

        if not veh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No assigned vehicle found for driver.",
            )
        target_vehicle_id = veh.vehicle_id

    return analytics_crud.compute_fuel_efficiency(db, target_vehicle_id=target_vehicle_id)


@router.get("/fuel-trends/{vehicle_id}", response_model=VehicleFuelTrendResponse)
def get_vehicle_fuel_trends_endpoint(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VehicleFuelTrendResponse:
    """
    Get fuel cost and consumption trend over time for a specific vehicle.
    - Admin & FleetManager can view any vehicle.
    - Drivers can only view their assigned vehicle.
    """
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle with ID {vehicle_id} not found.",
        )

    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        is_assigned = (
            (driver and vehicle.assigned_driver == driver.driver_id)
            or vehicle.assigned_driver == current_user.user_id
        )
        if not is_assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Drivers can only view fuel trends for their assigned vehicle.",
            )

    return analytics_crud.compute_vehicle_fuel_trends(db, vehicle_id=vehicle_id)


@router.get(
    "/operational-summary",
    response_model=OperationalSummaryResponse,
    dependencies=[Depends(require_admin)],
)
def get_operational_summary_endpoint(
    db: Session = Depends(get_db),
) -> OperationalSummaryResponse:
    """
    General operational summary combining shipment counts, utilization, active dispatches, and volume trend.
    Restricted to Admin only.
    """
    return analytics_crud.compute_operational_summary(db)
