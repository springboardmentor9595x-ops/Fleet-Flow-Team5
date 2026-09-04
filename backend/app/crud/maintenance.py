from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.driver import Driver
from app.models.maintenance import Maintenance
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, MaintenanceRead, MaintenanceStats


def create_maintenance(db: Session, maintenance_in: MaintenanceCreate) -> Maintenance:
    record = Maintenance(
        vehicle_id=maintenance_in.vehicle_id,
        service_type=maintenance_in.service_type,
        description=maintenance_in.description,
        cost=maintenance_in.cost,
        service_date=maintenance_in.service_date,
        next_service_date=maintenance_in.next_service_date,
        status=maintenance_in.status,
        service_center=maintenance_in.service_center,
        performed_by=maintenance_in.performed_by,
    )
    db.add(record)
    
    # If status is In Progress, update vehicle status to Maintenance
    if record.status.lower() in ["in progress", "in_progress"]:
        db.query(Vehicle).filter(Vehicle.vehicle_id == record.vehicle_id).update({"status": "Maintenance"})
    
    db.commit()
    db.refresh(record)

    try:
        from app.tasks.maintenance import check_maintenance_alerts_sync
        check_maintenance_alerts_sync(db)
    except Exception as e:
        pass

    return record


def get_maintenance_by_id(db: Session, maintenance_id: UUID) -> Maintenance | None:
    return db.query(Maintenance).filter(Maintenance.maintenance_id == maintenance_id).first()


def get_maintenance_list(
    db: Session,
    current_user: User,
    status_filter: str | None = None,
    due_filter: str | None = None,
    vehicle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[MaintenanceRead]:
    query = db.query(Maintenance).join(Vehicle, Maintenance.vehicle_id == Vehicle.vehicle_id)

    # Scoping: Drivers view only their own assigned vehicle maintenance records
    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if driver:
            query = query.filter(
                or_(
                    Vehicle.assigned_driver == driver.driver_id,
                    Vehicle.assigned_driver == current_user.user_id,
                )
            )
        else:
            query = query.filter(Vehicle.assigned_driver == current_user.user_id)

    if vehicle_id:
        query = query.filter(Maintenance.vehicle_id == vehicle_id)

    if status_filter and status_filter.strip().upper() != "ALL":
        query = query.filter(Maintenance.status.ilike(f"%{status_filter.strip()}%"))

    now = datetime.now(timezone.utc)
    if due_filter:
        d_filt = due_filter.strip().lower()
        if d_filt == "upcoming":
            seven_days = now + timedelta(days=7)
            query = query.filter(
                Maintenance.next_service_date.isnot(None),
                Maintenance.next_service_date >= now,
                Maintenance.next_service_date <= seven_days,
                ~Maintenance.status.ilike("%completed%"),
                ~Maintenance.status.ilike("%cancelled%"),
            )
        elif d_filt == "overdue":
            query = query.filter(
                Maintenance.next_service_date.isnot(None),
                Maintenance.next_service_date < now,
                ~Maintenance.status.ilike("%completed%"),
                ~Maintenance.status.ilike("%cancelled%"),
            )

    records = query.order_by(Maintenance.service_date.desc()).offset(skip).limit(limit).all()

    result = []
    for r in records:
        v = r.vehicle
        item = MaintenanceRead(
            maintenance_id=r.maintenance_id,
            vehicle_id=r.vehicle_id,
            service_type=r.service_type,
            description=r.description,
            cost=r.cost,
            service_date=r.service_date,
            next_service_date=r.next_service_date,
            status=r.status,
            service_center=r.service_center,
            performed_by=r.performed_by,
            created_at=r.created_at,
            updated_at=r.updated_at,
            vehicle_registration=v.registration_number if v else None,
            vehicle_brand=v.brand if v else None,
            vehicle_model=v.model if v else None,
        )
        result.append(item)

    return result


def update_maintenance(
    db: Session, maintenance_id: UUID, maintenance_in: MaintenanceUpdate
) -> Maintenance | None:
    record = get_maintenance_by_id(db, maintenance_id)
    if not record:
        return None

    update_data = maintenance_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    # Sync vehicle status if maintenance status changed
    if "status" in update_data:
        st = update_data["status"].lower()
        if st in ["in progress", "in_progress"]:
            db.query(Vehicle).filter(Vehicle.vehicle_id == record.vehicle_id).update({"status": "Maintenance"})
        elif st in ["completed", "cancelled"]:
            # Check if other in-progress maintenance exists for this vehicle
            other_active = db.query(Maintenance).filter(
                Maintenance.vehicle_id == record.vehicle_id,
                Maintenance.maintenance_id != record.maintenance_id,
                Maintenance.status.ilike("%in progress%"),
            ).first()
            if not other_active:
                db.query(Vehicle).filter(Vehicle.vehicle_id == record.vehicle_id).update({"status": "Available"})

    db.add(record)
    db.commit()
    db.refresh(record)

    try:
        from app.tasks.maintenance import check_maintenance_alerts_sync
        check_maintenance_alerts_sync(db)
    except Exception as e:
        pass

    return record


def delete_maintenance(db: Session, maintenance_id: UUID) -> bool:
    record = get_maintenance_by_id(db, maintenance_id)
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


def get_maintenance_stats(db: Session) -> MaintenanceStats:
    records = db.query(Maintenance).all()
    total = len(records)
    scheduled = sum(1 for r in records if r.status.lower() == "scheduled")
    in_progress = sum(1 for r in records if r.status.lower() in ["in progress", "in_progress"])
    completed = sum(1 for r in records if r.status.lower() == "completed")
    cancelled = sum(1 for r in records if r.status.lower() == "cancelled")
    total_cost = sum(r.cost for r in records)

    return MaintenanceStats(
        total_records=total,
        scheduled=scheduled,
        in_progress=in_progress,
        completed=completed,
        cancelled=cancelled,
        total_cost=round(total_cost, 2),
    )
