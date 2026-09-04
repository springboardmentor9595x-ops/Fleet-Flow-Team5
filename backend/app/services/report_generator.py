from datetime import date, datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.crud.analytics import (
    compute_fleet_utilization,
    compute_driver_performance,
    compute_delivery_performance,
    compute_maintenance_analytics,
    compute_fuel_efficiency,
)
from app.models.driver import Driver
from app.models.fuel_record import FuelRecord
from app.models.maintenance import Maintenance
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.models.user import User
from app.models.vehicle import Vehicle


def generate_fleet_utilization_report(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    util = compute_fleet_utilization(db)
    
    vehicles = db.query(Vehicle).all()

    summary = [
        {"label": "Total Fleet Vehicles", "value": str(util.total_vehicles)},
        {"label": "Available Vehicles", "value": f"{util.status_counts.get('Available', 0)} ({util.status_percentages.get('Available', 0.0)}%)"},
        {"label": "In Transit Vehicles", "value": f"{util.status_counts.get('In Transit', 0)} ({util.status_percentages.get('In Transit', 0.0)}%)"},
        {"label": "Assigned Vehicles", "value": f"{util.status_counts.get('Assigned', 0)} ({util.status_percentages.get('Assigned', 0.0)}%)"},
        {"label": "Maintenance Vehicles", "value": f"{util.status_counts.get('Maintenance', 0)} ({util.status_percentages.get('Maintenance', 0.0)}%)"},
        {"label": "Out of Service", "value": f"{util.status_counts.get('Out of Service', 0)} ({util.status_percentages.get('Out of Service', 0.0)}%)"},
    ]

    rows = []
    for v in vehicles:
        assigned_driver_name = "Unassigned"
        if v.assigned_driver:
            d = db.query(Driver).filter(or_(Driver.driver_id == v.assigned_driver, Driver.user_id == v.assigned_driver)).first()
            if d:
                u = db.query(User).filter(User.user_id == d.user_id).first()
                if u:
                    assigned_driver_name = u.full_name

        rows.append([
            str(v.vehicle_id)[:8] + "...",
            v.registration_number,
            f"{v.brand or ''} {v.model or ''}".strip() or "N/A",
            v.status or "Available",
            f"{v.capacity} Units" if v.capacity else (v.vehicle_type or "N/A"),
            assigned_driver_name,
        ])

    return {
        "report_type": "fleet_utilization",
        "title": "Fleet Utilization & Inventory Report",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "period": {
            "start_date": str(start_date) if start_date else "All Time",
            "end_date": str(end_date) if end_date else "Present",
        },
        "summary": summary,
        "columns": ["Vehicle ID", "Registration", "Brand & Model", "Status", "Capacity", "Assigned Driver"],
        "rows": rows,
    }


def generate_fuel_consumption_report(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    vehicle_id: UUID | None = None,
) -> dict:
    query = db.query(FuelRecord).join(Vehicle, FuelRecord.vehicle_id == Vehicle.vehicle_id)

    if start_date:
        query = query.filter(func.date(FuelRecord.fuel_date) >= start_date)
    if end_date:
        query = query.filter(func.date(FuelRecord.fuel_date) <= end_date)
    if vehicle_id:
        query = query.filter(FuelRecord.vehicle_id == vehicle_id)

    records = query.order_by(FuelRecord.fuel_date.desc()).all()

    total_liters = sum(r.liters for r in records)
    total_cost = sum(r.cost for r in records)
    avg_cost_per_liter = round(total_cost / total_liters, 2) if total_liters > 0 else 0.0

    summary = [
        {"label": "Total Fuel Logs", "value": str(len(records))},
        {"label": "Total Liters Consumed", "value": f"{round(total_liters, 2)} L"},
        {"label": "Total Fuel Expense", "value": f"${round(total_cost, 2):,}"},
        {"label": "Avg Cost / Liter", "value": f"${avg_cost_per_liter}/L" if avg_cost_per_liter else "N/A"},
    ]

    rows = []
    for r in records:
        v_reg = r.vehicle.registration_number if r.vehicle else "Unknown"
        c_per_l = round(r.cost / r.liters, 2) if r.liters > 0 else 0.0
        station_info = f"{r.fuel_station or ''} ({r.fuel_type or 'Fuel'})".strip() or "N/A"
        rows.append([
            r.fuel_date.strftime("%Y-%m-%d") if r.fuel_date else "N/A",
            v_reg,
            f"{r.liters:.2f} L",
            f"${r.cost:.2f}",
            f"${c_per_l:.2f}",
            station_info,
        ])

    return {
        "report_type": "fuel_consumption",
        "title": "Fuel Consumption & Expense Report",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "period": {
            "start_date": str(start_date) if start_date else "All Time",
            "end_date": str(end_date) if end_date else "Present",
        },
        "summary": summary,
        "columns": ["Fuel Date", "Vehicle Reg", "Liters (L)", "Total Cost ($)", "Cost/Liter ($)", "Station & Type"],
        "rows": rows,
    }


def generate_driver_performance_report(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    driver_id: UUID | None = None,
) -> dict:
    perf_data = compute_driver_performance(db, target_driver_id=driver_id)
    
    total_trips = sum(d.trips_completed for d in perf_data.drivers)
    total_delivered = sum(d.total_delivered_shipments for d in perf_data.drivers)
    valid_rates = [d.on_time_rate_pct for d in perf_data.drivers if d.on_time_rate_pct is not None]
    avg_on_time = round(sum(valid_rates) / len(valid_rates), 1) if len(valid_rates) > 0 else None

    summary = [
        {"label": "Drivers Evaluated", "value": str(len(perf_data.drivers))},
        {"label": "Total Completed Trips", "value": str(total_trips)},
        {"label": "Total Delivered Shipments", "value": str(total_delivered)},
        {"label": "Avg Fleet On-Time Rate", "value": f"{avg_on_time}%" if avg_on_time is not None else "No data yet"},
    ]

    rows = []
    for d in perf_data.drivers:
        on_time_str = f"{d.on_time_rate_pct}%" if d.on_time_rate_pct is not None else "No data yet"
        att_str = f"{d.attendance_rate_pct}%" if d.attendance_rate_pct is not None else "No data yet"
        rows.append([
            d.driver_name,
            d.email,
            d.license_number or "N/A",
            str(d.trips_completed),
            str(d.total_delivered_shipments),
            on_time_str,
            att_str,
        ])

    return {
        "report_type": "driver_performance",
        "title": "Driver Performance & Delivery Summary Report",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "period": {
            "start_date": str(start_date) if start_date else "All Time",
            "end_date": str(end_date) if end_date else "Present",
        },
        "summary": summary,
        "columns": ["Driver Name", "Email", "License No", "Completed Trips", "Delivered Shipments", "On-Time Rate", "Attendance Rate"],
        "rows": rows,
    }


def generate_delivery_performance_report(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    deliv_perf = compute_delivery_performance(db, start_date, end_date)

    query = db.query(Shipment)
    if start_date:
        query = query.filter(func.date(Shipment.created_at) >= start_date)
    if end_date:
        query = query.filter(func.date(Shipment.created_at) <= end_date)

    shipments = query.order_by(Shipment.created_at.desc()).all()

    on_time_str = f"{deliv_perf.on_time_rate_pct}%" if deliv_perf.on_time_rate_pct is not None else "No data yet"
    delayed_str = f"{deliv_perf.delayed_rate_pct}%" if deliv_perf.delayed_rate_pct is not None else "No data yet"
    avg_hrs_str = f"{deliv_perf.average_delivery_time_hours} hrs" if deliv_perf.average_delivery_time_hours is not None else "No data yet"

    summary = [
        {"label": "Total Shipments", "value": str(deliv_perf.total_shipments)},
        {"label": "Delivered Count", "value": str(deliv_perf.delivered_count)},
        {"label": "On-Time Rate", "value": on_time_str},
        {"label": "Delayed Rate", "value": delayed_str},
        {"label": "Avg Delivery Time", "value": avg_hrs_str},
        {"label": "In Transit Count", "value": str(deliv_perf.in_transit_count)},
    ]

    rows = []
    for s in shipments:
        created_str = s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "N/A"
        expected_str = s.expected_delivery_time.strftime("%Y-%m-%d %H:%M") if s.expected_delivery_time else "N/A"
        actual_str = s.actual_delivery_time.strftime("%Y-%m-%d %H:%M") if s.actual_delivery_time else "N/A"

        rows.append([
            s.tracking_number,
            s.source or "N/A",
            s.destination or "N/A",
            s.status or "Created",
            created_str,
            expected_str,
            actual_str,
        ])

    return {
        "report_type": "delivery_performance",
        "title": "Logistics & Delivery Performance Report",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "period": {
            "start_date": str(start_date) if start_date else "All Time",
            "end_date": str(end_date) if end_date else "Present",
        },
        "summary": summary,
        "columns": ["Tracking No", "Origin", "Destination", "Status", "Created At", "Expected Delivery", "Actual Delivery"],
        "rows": rows,
    }


def generate_maintenance_report(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    query = db.query(Maintenance).join(Vehicle, Maintenance.vehicle_id == Vehicle.vehicle_id)

    if start_date:
        query = query.filter(func.date(Maintenance.service_date) >= start_date)
    if end_date:
        query = query.filter(func.date(Maintenance.service_date) <= end_date)

    records = query.order_by(Maintenance.service_date.desc()).all()

    total_cost = sum(r.cost for r in records)
    avg_cost = round(total_cost / len(records), 2) if len(records) > 0 else 0.0
    unique_vehicles = len(set(r.vehicle_id for r in records))

    summary = [
        {"label": "Total Maintenance Records", "value": str(len(records))},
        {"label": "Total Service Expense", "value": f"${round(total_cost, 2):,}"},
        {"label": "Average Cost / Service", "value": f"${avg_cost:,.2f}" if avg_cost else "N/A"},
        {"label": "Vehicles Serviced", "value": str(unique_vehicles)},
    ]

    rows = []
    for r in records:
        v_reg = r.vehicle.registration_number if r.vehicle else "Unknown"
        s_date = r.service_date.strftime("%Y-%m-%d") if r.service_date else "N/A"
        rows.append([
            str(r.maintenance_id)[:8] + "...",
            v_reg,
            r.service_type or "General Inspection",
            s_date,
            f"${r.cost:.2f}",
            r.status or "Scheduled",
            r.description or "N/A",
        ])

    return {
        "report_type": "maintenance",
        "title": "Fleet Maintenance & Repair Expense Report",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "period": {
            "start_date": str(start_date) if start_date else "All Time",
            "end_date": str(end_date) if end_date else "Present",
        },
        "summary": summary,
        "columns": ["Service ID", "Vehicle Reg", "Service Type", "Service Date", "Cost ($)", "Status", "Description"],
        "rows": rows,
    }
