from datetime import date, datetime, timedelta
from typing import List, Dict, Any

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.maintenance import VehicleMaintenance
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.user import User, RoleEnum
from app.models.notification import Notification


def process_maintenance_alerts(db) -> List[Dict[str, Any]]:
    """
    Evaluates maintenance records against alert criteria:
    1. 5 days before service date -> 5-day warning notification
    2. 1 day before service date -> 1-day urgent warning notification
    3. Due / Overdue (date <= today) -> Keep triggering notification until status is 'Resolved'
    4. If status is 'Resolved' -> Ignored completely
    """
    today = date.today()
    triggered_alerts = []

    # Get relevant users: Admins and FleetManagers
    manager_users = db.query(User).filter(
        User.role.in_([RoleEnum.Admin, RoleEnum.FleetManager])
    ).all()

    # Query all unresolved maintenance records
    records = db.query(VehicleMaintenance).filter(
        VehicleMaintenance.status.notin_(["Resolved", "resolved"])
    ).all()

    for record in records:
        target_date = record.service_date or record.next_service_date
        if not target_date:
            continue

        delta_days = (target_date - today).days

        # Determine alert level
        alert_info = None
        if delta_days == 5:
            alert_info = {
                "level": "5_DAYS_BEFORE",
                "badge": "warning",
                "days_diff": delta_days,
                "title_prefix": "Upcoming Service (5 Days)",
            }
        elif delta_days == 1:
            alert_info = {
                "level": "1_DAY_BEFORE",
                "badge": "urgent",
                "days_diff": delta_days,
                "title_prefix": "Urgent Service Tomorrow (1 Day)",
            }
        elif delta_days == 0:
            alert_info = {
                "level": "DUE_TODAY",
                "badge": "critical",
                "days_diff": delta_days,
                "title_prefix": "Service Due Today",
            }
        elif delta_days < 0:
            alert_info = {
                "level": "OVERDUE",
                "badge": "critical",
                "days_diff": delta_days,
                "title_prefix": f"Service Overdue by {abs(delta_days)} Day(s)",
            }

        # If it doesn't match 5 days, 1 day, or <= 0 (due/overdue), skip
        if not alert_info:
            continue

        # Get Vehicle details
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == record.vehicle_id).first() if record.vehicle_id else None
        reg_number = vehicle.registration_number if vehicle else "Unknown Vehicle"

        # Find recipient users
        recipient_user_ids = {u.user_id for u in manager_users}
        if vehicle and vehicle.assigned_driver:
            driver = db.query(Driver).filter(Driver.driver_id == vehicle.assigned_driver).first()
            if driver and driver.user_id:
                recipient_user_ids.add(driver.user_id)

        title = f"{alert_info['title_prefix']}: {reg_number}"
        if delta_days > 0:
            message = (
                f"Vehicle {reg_number} is scheduled for '{record.maintenance_type}' on {target_date} "
                f"(in {delta_days} day{'s' if delta_days > 1 else ''}). Current status: {record.status}."
            )
        elif delta_days == 0:
            message = (
                f"Vehicle {reg_number} is DUE TODAY for '{record.maintenance_type}' ({target_date}). "
                f"Status: {record.status}. Please perform service and mark as Resolved."
            )
        else:
            message = (
                f"Vehicle {reg_number} is OVERDUE by {abs(delta_days)} day(s) for '{record.maintenance_type}' "
                f"(Scheduled: {target_date}). Status: {record.status}. Action required immediately until Resolved."
            )

        # Create notifications in the DB and dispatch emails
        from app.core.email import send_notification_email
        for u_id in recipient_user_ids:
            notif = Notification(
                user_id=u_id,
                title=title,
                message=message,
                type=f"MAINTENANCE_{alert_info['level']}",
                is_read=False,
                created_at=datetime.utcnow(),
            )
            db.add(notif)
            
            # Send notification email via SMTP / email log
            target_user = db.query(User).filter(User.user_id == u_id).first()
            if target_user and target_user.email:
                send_notification_email(
                    recipient_email=target_user.email,
                    recipient_name=target_user.full_name or "Fleet Member",
                    role=target_user.role.value if hasattr(target_user.role, 'value') else str(target_user.role),
                    title=title,
                    message=message,
                    notification_type=f"MAINTENANCE_{alert_info['level']}",
                )

        # Update last_notified_date on record
        record.last_notified_date = today


        triggered_alerts.append({
            "maintenance_id": str(record.maintenance_id),
            "vehicle_id": str(record.vehicle_id) if record.vehicle_id else None,
            "registration_number": reg_number,
            "maintenance_type": record.maintenance_type,
            "service_date": str(target_date),
            "days_diff": delta_days,
            "level": alert_info["level"],
            "status": record.status,
            "title": title,
            "message": message,
        })

        print(f"[MAINTENANCE ALERT - {alert_info['level']}] {title} -> {message}")

    db.commit()
    return triggered_alerts


@celery_app.task(name="app.tasks.maintenance.check_maintenance_alerts")
def check_maintenance_alerts():
    db = SessionLocal()
    try:
        alerts = process_maintenance_alerts(db)
        return f"Checked maintenance alerts — {len(alerts)} notification(s) generated."
    finally:
        db.close()

