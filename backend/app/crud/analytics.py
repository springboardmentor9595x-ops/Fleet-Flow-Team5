from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, or_

from app.crud.attendance import get_driver_attendance_summary
from app.models.driver import Driver
from app.models.fuel_record import FuelRecord
from app.models.maintenance import Maintenance
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.analytics import (
    CostPerVehicleItem,
    DeliveryPerformanceResponse,
    DriverPerformanceItem,
    DriverPerformanceResponse,
    FleetUtilizationResponse,
    FuelEfficiencyItem,
    FuelEfficiencyResponse,
    MaintenanceAnalyticsResponse,
    MaintenanceFrequencyItem,
    OperationalSummaryResponse,
    ShipmentVolumeTrendItem,
    VehicleFuelTrendItem,
    VehicleFuelTrendResponse,
)


def compute_fleet_utilization(db: Session) -> FleetUtilizationResponse:
    all_vehicles = db.query(Vehicle).all()
    total = len(all_vehicles)

    counts = defaultdict(int)
    for v in all_vehicles:
        st = (v.status or "Available").strip()
        # Normalize casing / status names
        if st.lower() in ["available"]:
            counts["Available"] += 1
        elif st.lower() in ["in transit", "in_transit", "active"]:
            counts["In Transit"] += 1
        elif st.lower() in ["maintenance"]:
            counts["Maintenance"] += 1
        elif st.lower() in ["assigned"]:
            counts["Assigned"] += 1
        else:
            counts["Out of Service"] += 1

    percentages = {}
    for k in ["Available", "Assigned", "In Transit", "Maintenance", "Out of Service"]:
        cnt = counts[k]
        percentages[k] = round((cnt / total * 100.0), 1) if total > 0 else 0.0

    utilized_vehicles = counts["Assigned"] + counts["In Transit"]
    total_active_vehicles = counts["Available"] + counts["Assigned"] + counts["In Transit"]
    
    rate_pct = (
        round((utilized_vehicles / total_active_vehicles * 100.0), 1)
        if total_active_vehicles > 0
        else 0.0
    )

    return FleetUtilizationResponse(
        fleet_utilization_rate_pct=rate_pct,
        utilized_vehicles=utilized_vehicles,
        total_active_vehicles=total_active_vehicles,
        total_vehicles=total,
        status_counts=dict(counts),
        status_percentages=percentages,
    )


def compute_driver_performance(db: Session, target_driver_id: UUID | None = None) -> DriverPerformanceResponse:
    query = db.query(Driver, User).join(User, Driver.user_id == User.user_id).filter(User.role == "Driver")

    if target_driver_id:
        query = query.filter(
            or_(Driver.driver_id == target_driver_id, Driver.user_id == target_driver_id)
        )

    driver_pairs = query.all()
    results = []

    for driver, user in driver_pairs:
        # 1. Trips completed count
        trips_count = (
            db.query(Trip)
            .filter(
                or_(Trip.driver_id == driver.driver_id, Trip.driver_id == driver.user_id),
                Trip.status.ilike("%completed%"),
            )
            .count()
        )

        # 2. Shipments performance
        shipments = (
            db.query(Shipment)
            .filter(
                or_(Shipment.driver_id == driver.driver_id, Shipment.driver_id == driver.user_id)
            )
            .all()
        )

        total_delivered = sum(1 for s in shipments if (s.status or '').lower() == "delivered")
        delayed_count = sum(1 for s in shipments if (s.status or '').lower() == "delayed")
        
        # On-time delivery calculation
        on_time_count = 0
        for s in shipments:
            if (s.status or '').lower() == "delivered":
                if s.expected_delivery_time and s.actual_delivery_time:
                    if s.actual_delivery_time <= s.expected_delivery_time:
                        on_time_count += 1
                elif (s.status or '').lower() != "delayed":
                    on_time_count += 1

        on_time_rate = round((on_time_count / total_delivered * 100.0), 1) if total_delivered > 0 else None

        # 3. Attendance summary logic
        att_summary = get_driver_attendance_summary(db, driver.driver_id)
        att_dict = {
            "month": att_summary.month,
            "year": att_summary.year,
            "total_days": att_summary.total_days,
            "present_days": att_summary.present_days,
            "leave_days": att_summary.leave_days,
            "absent_days": att_summary.absent_days,
        }

        results.append(
            DriverPerformanceItem(
                driver_id=driver.driver_id,
                driver_name=user.full_name,
                email=user.email,
                license_number=driver.license_number,
                trips_completed=trips_count,
                total_delivered_shipments=total_delivered,
                on_time_deliveries=on_time_count,
                delayed_deliveries=delayed_count,
                on_time_rate_pct=on_time_rate,
                attendance_rate_pct=att_summary.attendance_rate_pct,
                attendance_summary=att_dict,
            )
        )

    return DriverPerformanceResponse(
        total_drivers=len(results),
        drivers=results,
    )


def compute_delivery_performance(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
) -> DeliveryPerformanceResponse:
    query = db.query(Shipment)

    if start_date:
        query = query.filter(func.date(Shipment.created_at) >= start_date)
    if end_date:
        query = query.filter(func.date(Shipment.created_at) <= end_date)

    shipments = query.all()
    total = len(shipments)

    delivered = [s for s in shipments if (s.status or '').lower() == "delivered"]
    delayed = [s for s in shipments if (s.status or '').lower() == "delayed"]
    in_transit = [s for s in shipments if (s.status or '').lower() in ["in transit", "in_transit"]]
    cancelled = [s for s in shipments if (s.status or '').lower() == "cancelled"]

    delivered_count = len(delivered)
    delayed_count = len(delayed)

    on_time_count = 0
    delivery_durations = []

    for s in delivered:
        # Check on-time constraint
        if s.expected_delivery_time and s.actual_delivery_time:
            if s.actual_delivery_time <= s.expected_delivery_time:
                on_time_count += 1
        elif (s.status or '').lower() != "delayed":
            on_time_count += 1

        # Calculate average delivery time from created_at to actual_delivery_time
        if s.actual_delivery_time and s.created_at:
            delta = (s.actual_delivery_time - s.created_at).total_seconds() / 3600.0
            if delta > 0:
                delivery_durations.append(delta)

    on_time_rate = round((on_time_count / delivered_count * 100.0), 1) if delivered_count > 0 else None
    delayed_rate = round((delayed_count / total * 100.0), 1) if total > 0 else None
    avg_hours = round(sum(delivery_durations) / len(delivery_durations), 1) if len(delivery_durations) > 0 else None

    return DeliveryPerformanceResponse(
        total_shipments=total,
        delivered_count=delivered_count,
        on_time_count=on_time_count,
        delayed_count=delayed_count,
        in_transit_count=len(in_transit),
        cancelled_count=len(cancelled),
        on_time_rate_pct=on_time_rate,
        delayed_rate_pct=delayed_rate,
        average_delivery_time_hours=avg_hours,
    )


def compute_maintenance_analytics(db: Session) -> MaintenanceAnalyticsResponse:
    records = db.query(Maintenance).join(Vehicle, Maintenance.vehicle_id == Vehicle.vehicle_id).all()
    total_records = len(records)
    total_cost = sum(r.cost for r in records)

    # Cost per vehicle
    veh_map = defaultdict(lambda: {"cost": 0.0, "count": 0, "reg": "", "brand_model": ""})
    for r in records:
        v = r.vehicle
        v_id = r.vehicle_id
        veh_map[v_id]["cost"] += r.cost
        veh_map[v_id]["count"] += 1
        veh_map[v_id]["reg"] = v.registration_number if v else "Unknown"
        veh_map[v_id]["brand_model"] = f"{v.brand or ''} {v.model or ''}".strip() if v else ""

    cost_per_vehicle = [
        CostPerVehicleItem(
            vehicle_id=v_id,
            registration_number=data["reg"],
            brand_model=data["brand_model"],
            total_maintenance_cost=round(data["cost"], 2),
            record_count=data["count"],
        )
        for v_id, data in veh_map.items()
    ]

    # Frequency by service type
    type_map = defaultdict(lambda: {"cost": 0.0, "count": 0})
    for r in records:
        stype = r.service_type or "General Inspection"
        type_map[stype]["cost"] += r.cost
        type_map[stype]["count"] += 1

    frequency_by_type = [
        MaintenanceFrequencyItem(
            service_type=stype,
            count=data["count"],
            total_cost=round(data["cost"], 2),
        )
        for stype, data in sorted(type_map.items(), key=lambda x: x[1]["count"], reverse=True)
    ]

    return MaintenanceAnalyticsResponse(
        total_maintenance_records=total_records,
        total_maintenance_cost=round(total_cost, 2),
        cost_per_vehicle=cost_per_vehicle,
        frequency_by_type=frequency_by_type,
    )


def compute_fuel_efficiency(db: Session, target_vehicle_id: UUID | None = None) -> FuelEfficiencyResponse:
    query = db.query(Vehicle)
    if target_vehicle_id:
        query = query.filter(Vehicle.vehicle_id == target_vehicle_id)

    vehicles = query.all()
    results = []

    for v in vehicles:
        # Distance traveled from completed/in-transit trips
        trips = db.query(Trip).filter(Trip.vehicle_id == v.vehicle_id).all()
        total_dist = sum(
            (t.actual_distance_km or t.planned_distance_km or 0.0)
            for t in trips
            if (t.status or '').lower() in ["completed", "in transit", "in_transit"]
        )

        # Fuel consumed from fuel records
        fuel_recs = db.query(FuelRecord).filter(FuelRecord.vehicle_id == v.vehicle_id).all()
        total_liters = sum(r.liters for r in fuel_recs)
        total_fuel_cost = sum(r.cost for r in fuel_recs)

        efficiency = round((total_dist / total_liters), 2) if total_liters > 0 else None

        d = (
            db.query(Driver)
            .filter(
                or_(
                    Driver.driver_id == v.assigned_driver,
                    Driver.user_id == v.assigned_driver,
                )
            )
            .first()
            if v.assigned_driver
            else None
        )
        d_user = d.user if d and hasattr(d, 'user') else None

        results.append(
            FuelEfficiencyItem(
                vehicle_id=v.vehicle_id,
                registration_number=v.registration_number,
                assigned_driver_name=d_user.full_name if d_user else None,
                total_distance_km=round(total_dist, 2),
                total_fuel_liters=round(total_liters, 2),
                total_fuel_cost=round(total_fuel_cost, 2),
                fuel_efficiency_km_per_liter=efficiency,
            )
        )

    valid_effs = [item.fuel_efficiency_km_per_liter for item in results if item.fuel_efficiency_km_per_liter is not None]
    fleet_avg = round(sum(valid_effs) / len(valid_effs), 2) if len(valid_effs) > 0 else None

    return FuelEfficiencyResponse(
        fleet_avg_km_per_liter=fleet_avg,
        vehicles=results,
    )


def compute_vehicle_fuel_trends(db: Session, vehicle_id: UUID) -> VehicleFuelTrendResponse:
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    records = (
        db.query(FuelRecord)
        .filter(FuelRecord.vehicle_id == vehicle_id)
        .order_by(FuelRecord.fuel_date.asc())
        .all()
    )

    total_liters = sum(r.liters for r in records)
    total_cost = sum(r.cost for r in records)
    avg_cost = round(total_cost / total_liters, 2) if total_liters > 0 else None

    monthly_data = defaultdict(lambda: {"liters": 0.0, "cost": 0.0, "count": 0})
    for r in records:
        m_key = r.fuel_date.strftime("%Y-%m") if r.fuel_date else "Unknown"
        monthly_data[m_key]["liters"] += r.liters
        monthly_data[m_key]["cost"] += r.cost
        monthly_data[m_key]["count"] += 1

    trends = [
        VehicleFuelTrendItem(
            month=m,
            liters=round(v["liters"], 2),
            cost=round(v["cost"], 2),
            record_count=v["count"],
        )
        for m, v in sorted(monthly_data.items())
    ]

    return VehicleFuelTrendResponse(
        vehicle_id=vehicle_id,
        registration_number=vehicle.registration_number if vehicle else None,
        total_liters=round(total_liters, 2),
        total_cost=round(total_cost, 2),
        avg_cost_per_liter=avg_cost,
        monthly_trends=trends,
    )


def compute_operational_summary(db: Session) -> OperationalSummaryResponse:
    total_shipments = db.query(Shipment).count()
    active_dispatches = db.query(Trip).filter(Trip.status.ilike("%in transit%")).count()
    delayed_shipments = db.query(Shipment).filter(Shipment.status.ilike("%delayed%")).count()

    utilization = compute_fleet_utilization(db)
    active_pct = utilization.fleet_utilization_rate_pct

    # Monthly volume trends
    shipments = db.query(Shipment).order_by(Shipment.created_at.asc()).all()
    monthly_counts = defaultdict(int)
    for s in shipments:
        m_key = s.created_at.strftime("%Y-%m") if s.created_at else "Unknown"
        monthly_counts[m_key] += 1

    volume_trend = [
        ShipmentVolumeTrendItem(period=m, count=cnt)
        for m, cnt in sorted(monthly_counts.items())
    ]

    return OperationalSummaryResponse(
        period_total_shipments=total_shipments,
        active_dispatches_count=active_dispatches,
        delayed_shipments_count=delayed_shipments,
        fleet_utilization_pct=round(active_pct, 1) if utilization.total_vehicles > 0 else None,
        shipment_volume_trend=volume_trend,
    )
