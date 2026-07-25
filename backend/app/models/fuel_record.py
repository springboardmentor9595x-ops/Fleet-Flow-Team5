"""
Fuel Records table — stub for Milestone 1.

Only the primary key and the FK to `vehicles` are defined here.
Fuel monitoring columns (fuel_amount, fuel_cost, mileage, refill_date)
are added once that module is in scope.
"""

import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    fuel_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<FuelRecord fuel_id={self.fuel_id}>"
