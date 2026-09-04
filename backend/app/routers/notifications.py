from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import notification as notification_crud
from app.models.user import User
from app.schemas.notification import NotificationRead

router = APIRouter(tags=["notifications"])


@router.get("/", response_model=list[NotificationRead])
def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationRead]:
    """Fetch recent system and maintenance notifications."""
    return notification_crud.get_notifications(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
    )


@router.get("/unread-count")
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get unread notification count for the currently authenticated user."""
    from app.models.notification import Notification
    from sqlalchemy import and_, or_

    query = db.query(Notification).filter(Notification.is_read == False)

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

    return {"unread_count": query.count()}


@router.patch("/read-all")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Mark all notifications as read for the currently authenticated user."""
    count = notification_crud.mark_all_notifications_read(db, current_user)
    return {"message": "All notifications marked as read", "count": count}


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_single_notification_as_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationRead:
    """Mark a single notification as read."""
    notif = notification_crud.mark_notification_read(db, notification_id, current_user)
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or access forbidden",
        )
    return NotificationRead(
        notification_id=notif.notification_id,
        user_id=notif.user_id,
        maintenance_id=notif.maintenance_id,
        notification_type=notif.notification_type,
        title=notif.title,
        message=notif.message,
        is_read=notif.is_read,
        sent_at=notif.sent_at,
        created_at=notif.created_at,
    )

