"""
Vehicles table — stub for Milestone 1.

Only the primary key is defined here. Fleet Management columns
(registration_number, vehicle_type, brand, model, manufacture_year,
fuel_type, capacity, assigned_driver, status, created_at) are added in
Milestone 2 once the Fleet Management module is in scope.
"""

import uuid

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Vehicle vehicle_id={self.vehicle_id}>"
