import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Maintenance(Base):
    __tablename__ = "vehicle_maintenance"

    maintenance_id = Column(
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
    service_type = Column(String(100), nullable=False, default="General Service")
    description = Column(Text, nullable=True)
    cost = Column(Float, nullable=False, default=0.0)
    service_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    next_service_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), nullable=False, default="Scheduled")  # Scheduled, In Progress, Completed, Cancelled
    service_center = Column(String(150), nullable=True)
    performed_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    vehicle = relationship("Vehicle", backref="maintenance_records")
