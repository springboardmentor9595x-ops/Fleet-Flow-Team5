import uuid
from sqlalchemy import Column, String, Numeric, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class VehicleMaintenance(Base):
    __tablename__ = "vehicle_maintenance"

    maintenance_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))
    maintenance_type = Column(String(50))
    service_date = Column(Date)
    next_service_date = Column(Date, nullable=True)
    cost = Column(Numeric(10, 2))
    remarks = Column(Text, nullable=True)
    status = Column(String(20), default="Scheduled")

