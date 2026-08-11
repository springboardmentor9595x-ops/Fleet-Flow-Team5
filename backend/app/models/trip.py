import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, JSON, func
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
    start_location = Column(String(255), nullable=True)
    destination = Column(String(255), nullable=True)
    start_lat = Column(Float, nullable=True)
    start_lng = Column(Float, nullable=True)
    dest_lat = Column(Float, nullable=True)
    dest_lng = Column(Float, nullable=True)
    route_type = Column(String(50), nullable=False, default="fastest")  # fastest, shortest, traffic_avoidance, fuel_efficient
    route_geometry = Column(JSON, nullable=True)  # GeoJSON / coordinate list
    planned_distance_km = Column(Float, nullable=True)
    planned_duration_min = Column(Float, nullable=True)
    actual_distance_km = Column(Float, nullable=True)
    actual_duration_min = Column(Float, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(50),
        nullable=False,
        default="Scheduled",
    )  # Scheduled, In Transit, Completed, Cancelled
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
