from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class GPSPing(BaseModel):
    vehicle_id: UUID
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    speed: float | None = 0.0
    heading: float | None = 0.0
    shipment_id: UUID | None = None
    trip_id: UUID | None = None


class GPSLocationRead(BaseModel):
    tracking_id: UUID
    vehicle_id: UUID
    latitude: float
    longitude: float
    speed: float | None = 0.0
    heading: float | None = 0.0
    recorded_time: datetime


class GeofenceEvent(BaseModel):
    event_type: str  # arrived_destination, departed_source, deviation
    vehicle_id: UUID
    shipment_id: UUID | None = None
    message: str
    timestamp: datetime
