import uuid
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    registration_number = Column(String(20), unique=True, nullable=False)
    vehicle_type = Column(String(50), nullable=False)
    brand = Column(String(50))
    model = Column(String(50))
    manufacture_year = Column(Integer)
    fuel_type = Column(String(20))
    capacity = Column(Integer)
    assigned_driver = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"), nullable=True)
    status = Column(String(20), default="Available")

