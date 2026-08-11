import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ShipmentStatusEnum(str, enum.Enum):
    Created = "Created"
    Assigned = "Assigned"
    InTransit = "In Transit"
    Delayed = "Delayed"
    Delivered = "Delivered"
    Cancelled = "Cancelled"


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tracking_number = Column(String(50), unique=True, nullable=False)
    source = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    source_lat = Column(Numeric(10, 7), nullable=True)
    source_lon = Column(Numeric(10, 7), nullable=True)
    destination_lat = Column(Numeric(10, 7), nullable=True)
    destination_lon = Column(Numeric(10, 7), nullable=True)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=True)
    shipment_weight = Column(Numeric(10, 2), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"), nullable=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"), nullable=True)
    status = Column(Enum(ShipmentStatusEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ShipmentStatusEnum.Created)
    notes = Column(Text, nullable=True)
    expected_delivery = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShipmentHistory(Base):
    __tablename__ = "shipment_history"

    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"), nullable=False)
    status = Column(String(30), nullable=False)
    note = Column(Text, nullable=True)
    changed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    changed_by_name = Column(String(100), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)
