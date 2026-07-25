"""
Vehicle Maintenance table — stub for Milestone 1.

Only the primary key and the FK to `vehicles` are defined here.
Maintenance scheduling columns (maintenance_type, service_date,
next_service_date, cost, remarks, status) are added once the Vehicle
Maintenance module is in scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class VehicleMaintenance(Base):
    __tablename__ = "vehicle_maintenance"

    maintenance_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<VehicleMaintenance maintenance_id={self.maintenance_id}>"
