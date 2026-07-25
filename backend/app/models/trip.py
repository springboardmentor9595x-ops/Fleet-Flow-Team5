import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"))
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), nullable=True)
    start_location = Column(String(100))
    destination = Column(String(100))
    start_time = Column(DateTime)
    end_time = Column(DateTime, nullable=True)
    distance = Column(Numeric(10, 2))
    status = Column(String(20), default="Scheduled")

