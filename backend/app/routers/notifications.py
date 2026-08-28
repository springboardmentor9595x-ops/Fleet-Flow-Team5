from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter()


class NotificationOut(BaseModel):
    notification_id: UUID
    user_id: UUID
    title: str
    message: str
    type: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[NotificationOut])
def list_my_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List notifications for the currently logged-in user."""
    query = db.query(Notification).filter(Notification.user_id == current_user.user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    notif = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == current_user.user_id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.put("/read-all", response_model=dict)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications for the current user as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"status": "success", "message": "All notifications marked as read."}
