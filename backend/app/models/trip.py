import uuid
from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
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
    shipment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shipments.shipment_id", ondelete="SET NULL"),
        nullable=True,
    )
