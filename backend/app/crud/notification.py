from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.driver import Driver
from app.models.notification import Notification
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.notification import NotificationCreate, NotificationRead


def create_notification(db: Session, notification_in: NotificationCreate) -> Notification:
    db_obj = Notification(
        user_id=notification_in.user_id,
        maintenance_id=notification_in.maintenance_id,
        notification_type=notification_in.notification_type,
        title=notification_in.title,
        message=notification_in.message,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def get_driver_user_id(db: Session, driver_id_or_user_id: UUID | None) -> UUID | None:
    if not driver_id_or_user_id:
        return None
    driver = db.query(Driver).filter(Driver.driver_id == driver_id_or_user_id).first()
    if driver and driver.user_id:
        return driver.user_id
    user = db.query(User).filter(User.user_id == driver_id_or_user_id).first()
    if user:
        return user.user_id
    return None


def notify_shipment_assigned(db: Session, shipment: Shipment, driver_id: UUID) -> list[Notification]:
    created = []
    driver_user_id = get_driver_user_id(db, driver_id)
    if driver_user_id:
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="shipment_assignment",
                title="Shipment Assigned",
                message=f"You have been assigned shipment {shipment.tracking_number} ({shipment.source} -> {shipment.destination}).",
            ),
        )
        created.append(d_notif)
    return created


def notify_trip_assigned(db: Session, trip: Trip, driver_id: UUID) -> list[Notification]:
    created = []
    driver_user_id = get_driver_user_id(db, driver_id)
    if driver_user_id:
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="trip_assignment",
                title="New Trip Assigned",
                message=f"A new trip has been assigned to you ({trip.start_location or 'Origin'} -> {trip.destination or 'Destination'}).",
            ),
        )
        created.append(d_notif)
    return created


def notify_leave_approval(db: Session, leave_req) -> list[Notification]:
    created = []
    driver_user_id = get_driver_user_id(db, leave_req.driver_id)
    if driver_user_id:
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="leave_approval",
                title="Leave Approved",
                message=f"Your leave request from {leave_req.start_date} to {leave_req.end_date} has been approved.",
            ),
        )
        created.append(d_notif)
    return created


def notify_leave_rejection(db: Session, leave_req) -> list[Notification]:
    created = []
    driver_user_id = get_driver_user_id(db, leave_req.driver_id)
    if driver_user_id:
        reason = leave_req.rejection_reason or "Operational requirements"
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="leave_rejection",
                title="Leave Rejected",
                message=f"Your leave request from {leave_req.start_date} to {leave_req.end_date} has been rejected.\n\nReason:\n{reason}",
            ),
        )
        created.append(d_notif)
    return created


def notify_role_change(db: Session, target_user: User, old_role: str, new_role: str) -> Notification:
    return create_notification(
        db,
        NotificationCreate(
            user_id=target_user.user_id,
            notification_type="role_change",
            title="Role Changed",
            message=f"Your FleetFlow role has been changed from {old_role} to {new_role}.",
        ),
    )


def notify_shipment_delivered(db: Session, shipment: Shipment) -> list[Notification]:
    created = []
    driver_user_id = get_driver_user_id(db, shipment.driver_id)
    if driver_user_id:
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="delivery_alert",
                title=f"Shipment Delivered: {shipment.tracking_number}",
                message=f"Your assigned shipment {shipment.tracking_number} has been delivered successfully.",
            ),
        )
        created.append(d_notif)
    return created


def notify_driver_assignment(db: Session, vehicle: Vehicle, driver_id: UUID | None) -> list[Notification]:
    created = []
    driver_user_id = get_driver_user_id(db, driver_id) if driver_id else None
    if driver_user_id:
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="driver_assignment",
                title="Vehicle Assigned",
                message=f"Vehicle {vehicle.registration_number} ({vehicle.brand or ''} {vehicle.model or ''}) has been assigned to you.",
            ),
        )
        created.append(d_notif)
    return created


def notify_shipment_status_change(db: Session, shipment: Shipment, new_status: str) -> list[Notification]:
    created = []
    driver_user_id = get_driver_user_id(db, shipment.driver_id)
    if driver_user_id:
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="shipment_status",
                title="Trip Updated",
                message=f"Your trip status for shipment {shipment.tracking_number} has changed to {new_status}.",
            ),
        )
        created.append(d_notif)
    return created


def notify_route_recalculated(db: Session, trip: Trip) -> list[Notification]:
    created = []
    tracking = "Trip"
    driver_id = trip.driver_id
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            tracking = f"Shipment {shipment.tracking_number}"
            if not driver_id:
                driver_id = shipment.driver_id

    driver_user_id = get_driver_user_id(db, driver_id)
    if driver_user_id:
        d_notif = create_notification(
            db,
            NotificationCreate(
                user_id=driver_user_id,
                notification_type="route_recalculation",
                title=f"Route Recalculated: {tracking}",
                message=f"Your trip route for {tracking} was recalculated and updated.",
            ),
        )
        created.append(d_notif)
    return created


def get_notification_by_maintenance_and_type(
    db: Session, maintenance_id: UUID, notification_type: str
) -> Notification | None:
    """Check if an alert for this exact maintenance record and type has already been sent."""
    return (
        db.query(Notification)
        .filter(
            Notification.maintenance_id == maintenance_id,
            Notification.notification_type == notification_type,
        )
        .first()
    )


def get_notifications(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 50,
) -> list[NotificationRead]:
    """Fetch notifications relevant to current_user, preserving pre-existing system-wide alerts for Admin, FleetManager, Dispatcher."""
    query = db.query(Notification)

    if current_user.role == "Driver":
        query = query.filter(Notification.user_id == current_user.user_id)
    elif current_user.role == "Dispatcher":
        dispatcher_types = ["delivery_alert", "shipment_status", "route_recalculation"]
        query = query.filter(
            or_(
                Notification.user_id == current_user.user_id,
                and_(
                    Notification.user_id.is_(None),
                    Notification.notification_type.in_(dispatcher_types),
                ),
            )
        )
    else:  # Admin, FleetManager
        query = query.filter(
            or_(
                Notification.user_id == current_user.user_id,
                Notification.user_id.is_(None),
            )
        )

    records = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    return [
        NotificationRead(
            notification_id=r.notification_id,
            user_id=r.user_id,
            maintenance_id=r.maintenance_id,
            notification_type=r.notification_type,
            title=r.title,
            message=r.message,
            is_read=r.is_read,
            sent_at=r.sent_at,
            created_at=r.created_at,
        )
        for r in records
    ]


from fastapi import HTTPException, status

def mark_notification_read(db: Session, notification_id: UUID, current_user: User) -> Notification | None:
    query = db.query(Notification).filter(Notification.notification_id == notification_id)
    notif = query.first()
    if not notif:
        return None

    # Permission check: Owner can mark their own read; Admin, FleetManager, Dispatcher can mark system alerts (user_id is None)
    if notif.user_id is not None and notif.user_id != current_user.user_id:
        if current_user.role not in ["Admin", "FleetManager", "Dispatcher"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only mark your own notifications as read.",
            )

    notif.is_read = True
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def mark_all_notifications_read(db: Session, current_user: User) -> int:
    query = db.query(Notification)

    if current_user.role == "Driver":
        query = query.filter(Notification.user_id == current_user.user_id)
    elif current_user.role == "Dispatcher":
        dispatcher_types = ["delivery_alert", "shipment_status", "route_recalculation"]
        query = query.filter(
            or_(
                Notification.user_id == current_user.user_id,
                and_(
                    Notification.user_id.is_(None),
                    Notification.notification_type.in_(dispatcher_types),
                ),
            )
        )
    else:  # Admin, FleetManager
        query = query.filter(
            or_(
                Notification.user_id == current_user.user_id,
                Notification.user_id.is_(None),
            )
        )

    count = query.filter(Notification.is_read == False).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return count


