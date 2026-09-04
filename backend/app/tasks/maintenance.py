import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.maintenance import Maintenance
from app.models.vehicle import Vehicle
from app.crud import notification as notification_crud
from app.schemas.notification import NotificationCreate

logger = logging.getLogger("fleetflow.tasks")


def check_maintenance_alerts_sync(db: Session) -> dict:
    """
    Synchronous logic to query upcoming and overdue maintenance records,
    deduplicate against existing Notifications, log console alerts,
    and insert new Notification records.
    """
    now = datetime.now(timezone.utc)
    seven_days_ahead = now + timedelta(days=7)

    # Query active maintenance records with a next_service_date set
    active_records = (
        db.query(Maintenance)
        .join(Vehicle, Maintenance.vehicle_id == Vehicle.vehicle_id)
        .filter(
            Maintenance.next_service_date.isnot(None),
            ~Maintenance.status.ilike("%completed%"),
            ~Maintenance.status.ilike("%cancelled%"),
        )
        .all()
    )

    alerts_triggered = 0
    skipped_duplicates = 0
    logs = []

    for record in active_records:
        v = record.vehicle
        reg = v.registration_number if v else "Unknown Vehicle"
        brand_model = f"{v.brand or ''} {v.model or ''}".strip() if v else ""
        due_date_str = record.next_service_date.strftime("%Y-%m-%d %H:%M UTC")

        alert_type = None
        title = None
        msg = None

        if record.next_service_date < now:
            alert_type = "maintenance_overdue"
            title = f"OVERDUE: Maintenance for Vehicle {reg}"
            msg = f"Vehicle {reg} ({brand_model}) has an OVERDUE maintenance service ({record.service_type}) that was due on {due_date_str}."
        elif now <= record.next_service_date <= seven_days_ahead:
            alert_type = "maintenance_upcoming"
            title = f"UPCOMING: Maintenance for Vehicle {reg}"
            msg = f"Vehicle {reg} ({brand_model}) has an UPCOMING maintenance service ({record.service_type}) scheduled on {due_date_str} (within 7 days)."

        if not alert_type:
            continue

        # Step 3a: Check if notification already sent for this maintenance record & alert type
        existing = notification_crud.get_notification_by_maintenance_and_type(
            db, maintenance_id=record.maintenance_id, notification_type=alert_type
        )
        if existing:
            skipped_duplicates += 1
            continue

        # Step 3b: Log alert to console
        alert_console_msg = f"[MAINTENANCE ALERT] {title} | {msg}"
        print(f"\n{'='*80}\n{alert_console_msg}\n{'='*80}\n")
        logger.info(alert_console_msg)
        logs.append(alert_console_msg)

        # Step 3c & Step 4: Record in Notifications table targeted to assigned driver if vehicle is assigned
        driver_user_id = notification_crud.get_driver_user_id(db, v.assigned_driver) if v and v.assigned_driver else None
        if driver_user_id:
            notification_crud.create_notification(
                db,
                NotificationCreate(
                    user_id=driver_user_id,
                    maintenance_id=record.maintenance_id,
                    notification_type=alert_type,
                    title=title,
                    message=f"Vehicle Maintenance: Your assigned vehicle {reg} ({brand_model}) has a {alert_type.replace('maintenance_', '')} service ({record.service_type}) on {due_date_str}.",
                ),
            )
            alerts_triggered += 1

    return {
        "processed_records": len(active_records),
        "alerts_triggered": alerts_triggered,
        "skipped_duplicates": skipped_duplicates,
        "logs": logs,
    }


# Celery Task Definition
try:
    from app.celery_app import celery_app

    @celery_app.task(name="app.tasks.maintenance.check_maintenance_alerts_task")
    def check_maintenance_alerts_task():
        """Celery background periodic task."""
        db = SessionLocal()
        try:
            logger.info("Executing Celery periodic task: check_maintenance_alerts_task")
            result = check_maintenance_alerts_sync(db)
            logger.info(f"Finished check_maintenance_alerts_task: {result}")
            return result
        finally:
            db.close()

except ImportError:
    pass
