from datetime import date, datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.deps import get_current_user, get_db, require_roles
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.export_excel import generate_excel_report
from app.services.export_pdf import generate_pdf_report
from app.services.report_generator import (
    generate_delivery_performance_report,
    generate_driver_performance_report,
    generate_fleet_utilization_report,
    generate_fuel_consumption_report,
    generate_maintenance_report,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse_date_param(val: str | date | None) -> date | None:
    if not val:
        return None
    if isinstance(val, date):
        return val
    s = str(val).strip()
    if not s:
        return None

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid date format '{s}'. Please use YYYY-MM-DD format.",
    )


def _validate_date_range(start_date: date | None, end_date: date | None):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date cannot be after end date.",
        )


def _build_formatted_response(report_data: dict, format: str):
    fmt = (format or "json").lower().strip()
    report_type = report_data.get("report_type", "report")
    date_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if fmt == "pdf":
        pdf_bytes = generate_pdf_report(report_data)
        filename = f"{report_type}_report_{date_stamp}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif fmt in ["excel", "xlsx"]:
        excel_bytes = generate_excel_report(report_data)
        filename = f"{report_type}_report_{date_stamp}.xlsx"
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return report_data


@router.get("/fleet-utilization")
def get_fleet_utilization_report_endpoint(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    format: str = Query("json", pattern="^(json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager")),
):
    p_start = _parse_date_param(start_date)
    p_end = _parse_date_param(end_date)
    _validate_date_range(p_start, p_end)

    report_data = generate_fleet_utilization_report(db, p_start, p_end)
    return _build_formatted_response(report_data, format)


@router.get("/fuel-consumption")
def get_fuel_consumption_report_endpoint(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    vehicle_id: UUID | None = Query(None),
    format: str = Query("json", pattern="^(json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Driver")),
):
    p_start = _parse_date_param(start_date)
    p_end = _parse_date_param(end_date)
    _validate_date_range(p_start, p_end)

    # Driver scoping check
    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            report_data = {
                "report_type": "fuel_consumption",
                "title": "My Vehicle Fuel Expense Report",
                "period": {"start_date": str(p_start or "All Time"), "end_date": str(p_end or "All Time")},
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "summary": [
                    {"label": "Assigned Vehicle", "value": "None"},
                    {"label": "Total Refill Cost ($)", "value": "0.00"},
                    {"label": "Total Fuel Volume (L)", "value": "0.00"},
                ],
                "columns": ["Date", "Registration", "Driver", "Volume (L)", "Cost ($)", "Station"],
                "rows": [],
            }
            return _build_formatted_response(report_data, format)

        assigned_veh = db.query(Vehicle).filter(
            or_(Vehicle.assigned_driver == driver.driver_id, Vehicle.assigned_driver == driver.user_id)
        ).first()

        if not assigned_veh:
            report_data = {
                "report_type": "fuel_consumption",
                "title": "My Vehicle Fuel Expense Report",
                "period": {"start_date": str(p_start or "All Time"), "end_date": str(p_end or "All Time")},
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "summary": [
                    {"label": "Assigned Vehicle", "value": "None"},
                    {"label": "Total Refill Cost ($)", "value": "0.00"},
                    {"label": "Total Fuel Volume (L)", "value": "0.00"},
                ],
                "columns": ["Date", "Registration", "Driver", "Volume (L)", "Cost ($)", "Station"],
                "rows": [],
            }
            return _build_formatted_response(report_data, format)

        if vehicle_id and vehicle_id != assigned_veh.vehicle_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Drivers can only view fuel reports for their assigned vehicle",
            )
        
        vehicle_id = assigned_veh.vehicle_id

    report_data = generate_fuel_consumption_report(db, p_start, p_end, vehicle_id)
    return _build_formatted_response(report_data, format)


@router.get("/driver-performance")
def get_driver_performance_report_endpoint(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    driver_id: UUID | None = Query(None),
    format: str = Query("json", pattern="^(json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Driver")),
):
    p_start = _parse_date_param(start_date)
    p_end = _parse_date_param(end_date)
    _validate_date_range(p_start, p_end)

    # Driver scoping check
    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            report_data = {
                "report_type": "driver_performance",
                "title": "My Performance Report",
                "period": {"start_date": str(p_start or "All Time"), "end_date": str(p_end or "All Time")},
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "summary": [
                    {"label": "Driver Profile", "value": "Not Found"},
                    {"label": "Completed Trips", "value": "0"},
                ],
                "columns": ["Driver Name", "Trips Completed", "On-Time Rate (%)"],
                "rows": [],
            }
            return _build_formatted_response(report_data, format)

        if driver_id and (driver_id != driver.driver_id and driver_id != driver.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Drivers can only view their own performance report",
            )

        driver_id = driver.driver_id

    report_data = generate_driver_performance_report(db, p_start, p_end, driver_id)
    return _build_formatted_response(report_data, format)


@router.get("/delivery-performance")
def get_delivery_performance_report_endpoint(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    format: str = Query("json", pattern="^(json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Dispatcher")),
):
    p_start = _parse_date_param(start_date)
    p_end = _parse_date_param(end_date)
    _validate_date_range(p_start, p_end)

    report_data = generate_delivery_performance_report(db, p_start, p_end)
    return _build_formatted_response(report_data, format)


@router.get("/maintenance")
def get_maintenance_report_endpoint(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    format: str = Query("json", pattern="^(json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager")),
):
    p_start = _parse_date_param(start_date)
    p_end = _parse_date_param(end_date)
    _validate_date_range(p_start, p_end)

    report_data = generate_maintenance_report(db, p_start, p_end)
    return _build_formatted_response(report_data, format)

