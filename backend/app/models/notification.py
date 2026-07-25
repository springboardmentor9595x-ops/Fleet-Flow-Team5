"""
Notifications table — stub for Milestone 1.

Only the primary key and the FK to `users` are defined here.
Notification columns (title, message, type, is_read, created_at) are
added once the Notification module is in scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Notification notification_id={self.notification_id}>"
