"""
Shipments table — stub for Milestone 1.

Only the primary key and FKs to `vehicles` and `drivers` are defined here.
Shipment Tracking columns (tracking_number, source, destination,
customer_name, shipment_weight, status, created_at) are added once the
Shipment Tracking module is in scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(
        UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"), nullable=True
    )
    driver_id = Column(
        UUID(as_uuid=True), ForeignKey("drivers.driver_id"), nullable=True
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Shipment shipment_id={self.shipment_id}>"
