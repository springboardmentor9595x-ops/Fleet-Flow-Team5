import uuid
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    registration_number = Column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )
    vehicle_type = Column(String(50), nullable=True)
    brand = Column(String(50), nullable=True)
    model = Column(String(50), nullable=True)
    manufacture_year = Column(Integer, nullable=True)
    fuel_type = Column(String(20), nullable=True)
    capacity = Column(Integer, nullable=True)
    assigned_driver = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.driver_id", ondelete="SET NULL"),
        nullable=True,
    )
    status = Column(String(20), nullable=False, default="Available")
