from uuid import UUID
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class TripCreate(BaseModel):
    vehicle_id: UUID
    driver_id: UUID
    shipment_id: Optional[UUID] = None
    start_location: Optional[str] = None
    destination: Optional[str] = None
    planned_route_type: Optional[str] = "fastest"


class TripEndRequest(BaseModel):
    actual_distance_km: Optional[float] = None


class TripRecalculateRequest(BaseModel):
    current_lat: float
    current_lon: float


class TripOut(BaseModel):
    trip_id: UUID
    vehicle_id: UUID
    driver_id: UUID
    shipment_id: Optional[UUID] = None
    start_location: str
    destination: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    distance: Optional[Decimal] = None
    estimated_duration: Optional[Decimal] = None
    planned_route_type: Optional[str] = "fastest"
    route_geometry: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
