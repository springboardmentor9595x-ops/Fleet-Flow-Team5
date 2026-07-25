import uuid
from sqlalchemy import Column, Numeric, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    fuel_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"))
    fuel_amount = Column(Numeric(8, 2))
    fuel_cost = Column(Numeric(10, 2))
    mileage = Column(Numeric(8, 2))
    refill_date = Column(Date)

