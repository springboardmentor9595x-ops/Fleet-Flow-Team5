from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.shipment import Shipment, ShipmentStatusEnum
from app.models.notification import Notification
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.core.email import send_notification_email
from datetime import datetime, timedelta


@celery_app.task(name="app.tasks.shipments.check_delayed_shipments")
def check_delayed_shipments():
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        overdue = db.query(Shipment).filter(
            Shipment.status == ShipmentStatusEnum.InTransit,
            Shipment.created_at <= cutoff,
        ).all()

        manager_users = db.query(User).filter(
            User.role.in_([RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher])
        ).all()

        for shipment in overdue:
            shipment.status = ShipmentStatusEnum.Delayed
            title = f"Shipment Delayed: {shipment.tracking_number}"
            message = f"Shipment {shipment.tracking_number} (Customer: {shipment.customer_name}) from {shipment.source} to {shipment.destination} is delayed."

            # Collect recipients
            recipients = {u for u in manager_users}
            if shipment.driver_id:
                drv = db.query(Driver).filter(Driver.driver_id == shipment.driver_id).first()
                if drv and drv.user_id:
                    drv_user = db.query(User).filter(User.user_id == drv.user_id).first()
                    if drv_user:
                        recipients.add(drv_user)

            for u in recipients:
                notif = Notification(
                    user_id=u.user_id,
                    title=title,
                    message=message,
                    type="SHIPMENT_DELAYED",
                    is_read=False,
                    created_at=datetime.utcnow(),
                )
                db.add(notif)
                if u.email:
                    send_notification_email(
                        recipient_email=u.email,
                        recipient_name=u.full_name or "Team Member",
                        role=u.role.value if hasattr(u.role, 'value') else str(u.role),
                        title=title,
                        message=message,
                        notification_type="SHIPMENT_DELAYED",
                    )

            print(f"[SHIPMENT ALERT] {shipment.tracking_number} marked as Delayed — notifications & emails sent.")

        db.commit()
        return f"Checked shipments — {len(overdue)} marked Delayed"
    finally:
        db.close()

