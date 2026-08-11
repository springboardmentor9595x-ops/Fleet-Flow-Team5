import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"), nullable=False)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), nullable=True)
    start_location = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    distance = Column(Numeric(10, 2), nullable=True)
    estimated_duration = Column(Numeric(10, 2), nullable=True)
    planned_route_type = Column(String(30), default="fastest")
    route_geometry = Column(Text, nullable=True)
    status = Column(String(20), default="Scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)
