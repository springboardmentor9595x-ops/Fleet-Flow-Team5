import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    tracking_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    source = Column(String(255), nullable=True)
    destination = Column(String(255), nullable=True)
    source_lat = Column(Float, nullable=True)
    source_lng = Column(Float, nullable=True)
    dest_lat = Column(Float, nullable=True)
    dest_lng = Column(Float, nullable=True)
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    customer_email = Column(String(100), nullable=True)
    shipment_weight = Column(Float, nullable=True)
    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.vehicle_id", ondelete="SET NULL"),
        nullable=True,
    )
    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.driver_id", ondelete="SET NULL"),
        nullable=True,
    )
    status = Column(
        String(50),
        nullable=False,
        default="Created",
    )  # Created, Assigned, In Transit, Delayed, Delivered, Cancelled
    expected_delivery_time = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_time = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
