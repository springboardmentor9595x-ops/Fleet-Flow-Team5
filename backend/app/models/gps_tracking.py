"""
GPS Tracking table — stub for Milestone 1.

Only the primary key and the FK to `vehicles` are defined here.
Real-time Tracking columns (latitude, longitude, speed, recorded_time)
are added once that module is in scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GPSTracking(Base):
    __tablename__ = "gps_tracking"

    tracking_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<GPSTracking tracking_id={self.tracking_id}>"
