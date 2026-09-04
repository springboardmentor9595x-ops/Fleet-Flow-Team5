import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    fuel_id = Column(
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
    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.driver_id", ondelete="SET NULL"),
        nullable=True,
    )
    liters = Column(Float, nullable=False, default=0.0)
    cost = Column(Float, nullable=False, default=0.0)
    odometer_km = Column(Float, nullable=False, default=0.0)
    fuel_type = Column(String(50), nullable=False, default="Diesel")  # Diesel, Petrol, Electric, CNG
    fuel_station = Column(String(150), nullable=True)
    receipt_number = Column(String(100), nullable=True)
    fuel_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    vehicle = relationship("Vehicle", backref="fuel_records")
    driver = relationship("Driver", backref="fuel_records")
