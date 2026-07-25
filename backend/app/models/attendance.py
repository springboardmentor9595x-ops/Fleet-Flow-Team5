"""
Attendance table — stub for Milestone 1.

Only the primary key and the FK to `drivers` are defined here.
Attendance columns (date, status) are added once the Driver Management
module's attendance tracking is in scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Attendance attendance_id={self.attendance_id}>"
