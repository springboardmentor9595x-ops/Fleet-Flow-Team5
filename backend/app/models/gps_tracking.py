import uuid
from sqlalchemy import Column, Float, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class GPSTracking(Base):
    __tablename__ = "gps_tracking"

    tracking_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"),
        nullable=False,
    )
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, nullable=True, default=0.0)
    heading = Column(Float, nullable=True, default=0.0)
    recorded_time = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
