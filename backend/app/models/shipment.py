import uuid
from sqlalchemy import Column, String, ForeignKey
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
