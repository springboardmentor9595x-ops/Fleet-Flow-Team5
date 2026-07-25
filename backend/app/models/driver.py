"""
Drivers table — stub for Milestone 1.

Only the primary key and the FK back to `users` are defined here so the
schema is structurally complete. Driver-specific columns (license_number,
experience_years, address, status, created_at) are added in Milestone 2
once the Driver Management module is in scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    driver_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), unique=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Driver driver_id={self.driver_id} user_id={self.user_id}>"
