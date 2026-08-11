import uuid
from datetime import datetime
from sqlalchemy import Column, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class GPSTracking(Base):
    __tablename__ = "gps_tracking"

    tracking_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    speed = Column(Numeric(8, 2), nullable=True)
    heading = Column(Numeric(5, 2), nullable=True)
    altitude = Column(Numeric(8, 2), nullable=True)
    accuracy = Column(Numeric(8, 2), nullable=True)
    recorded_time = Column(DateTime, default=datetime.utcnow)
