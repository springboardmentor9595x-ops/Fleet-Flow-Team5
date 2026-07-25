import uuid
from datetime import datetime
from sqlalchemy import Column, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class GPSTracking(Base):
    __tablename__ = "gps_tracking"

    tracking_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    speed = Column(Numeric(8, 2))
    recorded_time = Column(DateTime, default=datetime.utcnow)

