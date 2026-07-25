"""
Trips table — stub for Milestone 1.

Only the primary key and FKs to `vehicles`, `drivers`, and `shipments` are
defined here. Route Optimization columns (start_location, destination,
start_time, end_time, distance, status) are added once that module is in
scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"))
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id"))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Trip trip_id={self.trip_id}>"
