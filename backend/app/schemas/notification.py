from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class NotificationBase(BaseModel):
    user_id: UUID | None = None
    maintenance_id: UUID | None = None
    notification_type: str = Field("maintenance_alert", max_length=50)
    title: str = Field("Notification", max_length=150)
    message: str


class NotificationCreate(NotificationBase):
    pass


class NotificationRead(NotificationBase):
    model_config = ConfigDict(from_attributes=True)

    notification_id: UUID
    is_read: bool
    sent_at: datetime
    created_at: datetime
